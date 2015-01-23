//
//  CWWebserverManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebserverManager.h"
#import <Nodelike/NLContext.h>
#import "GCDWebServer.h"
#import "GCDWebServerDataResponse.h"
#import "BLWebSocketsServer.h"
#import "CWUtil.h"
#import "CWBundle.h"
#import "CWDebug.h"



@interface CWWebserverManager ()

@property (readwrite) CWWebserverManagerState state;

@property (readwrite, strong) NSString *documentRoot;

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) NLContext *nodelikeContext;
@property (strong, readwrite) GCDWebServer *webServer;
@property (strong, readwrite) BLWebSocketsServer *websocketServer;
@property (readwrite) int localWebsocketID;
@property (strong, readwrite) NSMutableDictionary *websocketIdentifiers;

/**
 *  Registers callback functions that the webserver script can call to execute native methods
 */
- (void)_registerJSCallbacks;

/**
 *  Called by the webserver script if the server finished starting up and is ready to accept HTTP and Websocket connections
 */
- (void)_receivedFromServer_serverDidStart;

/**
 *  Called by the webserver script if the websocket connection of a remote device was closed (the remote disconnected)
 *
 *  @param identifier The device identifier of the device to which the connection was closed
 */
- (void)_receivedFromServer_remoteWebsocketDidClose:(NSString *)identifier;

@end



@implementation CWWebserverManager


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot
{
    self = [super init];
    
    self.state = CWWebserverManagerStateStopped;
    self.documentRoot = documentRoot;
    
    return self;
}


- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port
{
    CWLog(1, @"Webserver is starting with document root %@ on port %d", documentRoot, port);
    
    self.state = CWWebserverManagerStateStarting;
    
    self.documentRoot = documentRoot;
    self.websocketIdentifiers = [NSMutableDictionary dictionary];

    //
    // WEBSERVER
    //
    
    self.webServer = [[GCDWebServer alloc] init];
    
    //Set up all the path handlers of the webserver that will deliver our files
    //Note that they are handled in LIFO order, so the last handler will be checked first,
    //and the server will then walk up until it finds a handler that fits
    NSMutableString *resourcePath = [[[CWBundle bundle] bundlePath] mutableCopy];
    
    //Map documentRoot to the root (/), which will deliver the actual web application
    [self.webServer addGETHandlerForBasePath:@"/"
                               directoryPath:self.documentRoot
                               indexFilename:@"index.html"
                                    cacheAge:0
                          allowRangeRequests:YES];
    
    //Serve the Connichiwa Web Libraries under /connichiwa
    [self.webServer addGETHandlerForBasePath:@"/connichiwa/"
                               directoryPath:[resourcePath stringByAppendingPathComponent:@"weblib"]
                               indexFilename:nil
                                    cacheAge:0
                          allowRangeRequests:YES];
    
    //Serve additional Connichiwa scripts under /connichiwa/scripts
    [self.webServer addGETHandlerForBasePath:@"/connichiwa/scripts/"
                               directoryPath:[resourcePath stringByAppendingPathComponent:@"scripts"]
                               indexFilename:nil
                                    cacheAge:0
                          allowRangeRequests:YES];
    
    //Serve the file accessed by remote devices under /remote
    [self.webServer addGETHandlerForPath:@"/remote"
                                filePath:[resourcePath stringByAppendingPathComponent:@"remote.html"]
                            isAttachment:NO
                                cacheAge:0
                      allowRangeRequests:YES];
    
    //Deliver a minimal 200 response for /check, which can be used to check if this server exists
    [self.webServer addHandlerForMethod:@"GET" path:@"/check"
                           requestClass:[GCDWebServerRequest class]
                           processBlock:^GCDWebServerResponse *(GCDWebServerRequest* request) {
         return [GCDWebServerResponse responseWithStatusCode:200];
     }];
    
    //
    // WEBSOCKET SERVER
    //
    
    self.websocketServer = [BLWebSocketsServer sharedInstance];
    
    //Set the default handlers for unidentified connections
    //A connection is considered "unidentified" as long as we can't map it to a connichiwa device identifier
    //This mapping can be done once we received either the localinfo or remoteinfo message from a device
    [self.websocketServer setDefaultHandleRequestBlock:[self onUnidentifiedWebsocketMessage]];
    
    [self.webServer startWithPort:port bonjourName:nil];
    [self.websocketServer startListeningOnPort:(port+1) withProtocolName:nil andCompletionBlock:^(NSError *error) { [self _receivedFromServer_serverDidStart]; }];
}


- (void)suspendWebserver
{
    if (self.state != CWWebserverManagerStateStarted) return;
    
    CWLog(1, @"Webserver is suspended, all remotes are soft-disconnected");
    
    //Make the server send a _softDisconnect message to all remotes
    self.state = CWWebserverManagerStateSuspended;
    [self.nodelikeContext evaluateScript:@"softDisconnectAllRemotes();"];
}


- (void)resumeWebserver
{
    CWLog(1, @"Webserver is resumed");
    
    // When we suspended, we soft disconnected all remotes
    // On resume, we don't need to do anything - we just make it possible for remotes to connect again
    // Furthermore, the local web library connection will automatically reconnect without us doing anything
    self.state = CWWebserverManagerStateStarted;
}

#pragma mark Websocket Callbacks

- (BLWebSocketsHandleRequestBlock)onUnidentifiedWebsocketMessage {
    __weak typeof(self) weakSelf = self;
    
    return ^void (int connectionID, NSData *messageData) {
        NSDictionary *message = [CWUtil dictionaryFromJSONData:messageData];
        
        //Check if the message identifies the local weblib's websocket
        //If so, save this websocket as the local one
        if ([[message objectForKey:@"_name"] isEqualToString:@"localinfo"]) {
            weakSelf.localWebsocketID = connectionID;
        }
        
        if ([[message objectForKey:@"_name"] isEqualToString:@"localinfo"] || [[message objectForKey:@"_name"] isEqualToString:@"remoteinfo"]) {
            //Save the Connichiwa identifier that belongs to the websocket connection
            [weakSelf.websocketIdentifiers setObject:[NSNumber numberWithInt:connectionID] forKey:[message objectForKey:@"identifier"]];
            
            //Make sure messages from this websocket are handled by the appropiate handler from now on
            [weakSelf.websocketServer setHandleRequestBlock:[weakSelf onIdentifiedWebsocketMessage] forConnection:connectionID];
            
            //Push the message to the local weblibrary, so it knows about the device
            [weakSelf.websocketServer push:messageData toConnection:weakSelf.localWebsocketID];
            
        }
    };
}

- (BLWebSocketsHandleRequestBlock)onIdentifiedWebsocketMessage {
    __weak typeof(self) weakSelf = self;
    
    return ^void (int connectionID, NSData *messageData) {
        NSDictionary *message = [CWUtil dictionaryFromJSONData:messageData];
        
        //For identified websocket messages, the server basically acts as a message relay
        //Check where the message is supposed to be sent to and deliver it
        NSString *target = [message objectForKey:@"_target"];
        if ([target isEqualToString:@"broadcast"]) {
            [weakSelf.websocketServer pushToAll:messageData];
        } else {
            int targetConnection = [[weakSelf.websocketIdentifiers objectForKey:target] intValue];
            [weakSelf.websocketServer push:messageData toConnection:targetConnection];
        }
    };
}


#pragma mark WebView Communication


- (void)_registerJSCallbacks
{
    if (self.nodelikeContext == nil) return;
    
    __weak typeof(self) weakSelf = self;
    
    self.nodelikeContext[@"nativeCallServerDidStart"] = ^(NSString *identifier) {
        [weakSelf _receivedFromServer_serverDidStart];
    };
    
    self.nodelikeContext[@"nativeCallRemoteWebsocketDidClose"] = ^(NSString *identifier) {
        [weakSelf _receivedFromServer_remoteWebsocketDidClose:identifier];
    };
}


- (void)_receivedFromServer_serverDidStart
{
    CWLog(1, @"Webserver did start");
    
    self.state = CWWebserverManagerStateStarted;
    
    if ([self.delegate respondsToSelector:@selector(didStartWebserver)])
    {
        [self.delegate didStartWebserver];
    }
}


- (void)_receivedFromServer_remoteWebsocketDidClose:(NSString *)identifier
{
    CWLog(3, @"Webserver reports a remote websocket did close");
    
    if ([self.delegate respondsToSelector:@selector(remoteDidDisconnect:)])
    {
        [self.delegate remoteDidDisconnect:identifier];
    }
}

@end
