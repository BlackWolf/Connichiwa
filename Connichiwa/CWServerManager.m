//
//  CWWebserverManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWServerManager.h"
#import "GCDWebServer.h"
#import "GCDWebServerDataResponse.h"
#import "BLWebSocketsServer.h"
#import "CWUtil.h"
#import "CWBundle.h"
#import "CWDebug.h"



@interface CWServerManager ()

@property (readwrite) CWServerManagerState state;

@property (readwrite, strong) NSString *documentRoot;

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) GCDWebServer *webServer;
@property (strong, readwrite) BLWebSocketsServer *websocketServer;
@property (readwrite) int localWebsocketID;
@property (strong, readwrite) NSMutableDictionary *websocketIdentifiers;
@property (nonatomic, strong, readwrite) NSMutableArray *masterBacklog;

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



@implementation CWServerManager


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot
{
    self = [super init];
    
    self.state = CWServerManagerStateStopped;
    self.documentRoot = documentRoot;
    self.localWebsocketID = -1;
    self.masterBacklog = [NSMutableArray array];
    
    return self;
}


- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port
{
    CWLog(1, @"Webserver is starting with document root %@ on port %d", documentRoot, port);

    self.state = CWServerManagerStateStarting;
    
    self.documentRoot = documentRoot;
    self.websocketIdentifiers = [NSMutableDictionary dictionary];

    //
    // WEBSERVER
    //
    
    self.webServer = [[GCDWebServer alloc] init];
    [GCDWebServer setLogLevel:1]; 
    
    //Set up all the path handlers of the webserver that will deliver our files
    //Note that they are hand3560led in LIFO order, so the last handler will be checked first,
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
    [self.websocketServer setDefaultOnMessageHandler:[self onUnidentifiedWebsocketMessage]];
    
    //
    // GO
    //
    
    [self.webServer startWithPort:port bonjourName:nil];
    [self.websocketServer startListeningOnPort:(port+1) withProtocolName:nil andCompletionBlock:^(NSError *error) {
        CWLog(1, @"HTTP & Websocket server did start");
        
        self.state = CWServerManagerStateStarted;
        
        if ([self.delegate respondsToSelector:@selector(didStartWebserver)])
        {
            [self.delegate didStartWebserver];
        }
    }];
}


- (void)suspendWebserver
{
    if (self.state != CWServerManagerStateStarted) return;
    
    CWLog(1, @"Webserver is suspended, all remotes are soft-disconnected");
    
    //Make the server send a _softDisconnect message to all remotes
    self.state = CWServerManagerStateSuspended;
//    [self.nodelikeContext evaluateScript:@"softDisconnectAllRemotes();"];
}


- (void)resumeWebserver
{
    CWLog(1, @"Webserver is resumed");
    
    // When we suspended, we soft disconnected all remotes
    // On resume, we don't need to do anything - we just make it possible for remotes to connect again
    // Furthermore, the local web library connection will automatically reconnect without us doing anything
    self.state = CWServerManagerStateStarted;
}

#pragma mark Websocket Callbacks

- (BLWebSocketOnMessageHandler)onUnidentifiedWebsocketMessage {
    __weak typeof(self) weakSelf = self;
    
    return ^void (int connectionID, NSData *messageData) {
//            @synchronized(weakSelf) {
        NSDictionary *message = [CWUtil dictionaryFromJSONData:messageData];
//        NSLog(@"GOT MESSAGE %@", [[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding]);
        //If the message identifies the local weblib's websocket, save its ID
        if ([[message objectForKey:@"_name"] isEqualToString:@"localinfo"]) {
//            NSLog(@"SET LOCAL ID");
            weakSelf.localWebsocketID = connectionID;
        }
        
        if ([[message objectForKey:@"_name"] isEqualToString:@"localinfo"] || [[message objectForKey:@"_name"] isEqualToString:@"remoteinfo"]) {
            //Save the Connichiwa identifier that belongs to the websocket connection
            [weakSelf.websocketIdentifiers setObject:[NSNumber numberWithInt:connectionID] forKey:[message objectForKey:@"identifier"]];
            
            //Make sure events from this websocket are handled by the appropiate handler from now on
            [weakSelf.websocketServer setOnMessageHandler:[weakSelf onIdentifiedWebsocketMessage] forConnection:connectionID];
            [weakSelf.websocketServer setOnCloseHandler:[weakSelf onIdentifiedWebsocketClosed] forConnection:connectionID];
            
            //Forward the message to the local weblibrary so it knows about the device
            //It might happen that we receive remoteinfo messages before localinfo messages
            //(if they arrive between the websocket server starting and the localinfo message
            //arriving). If this happens, backlog the messages and send them later
//            NSLog(@"ID %d", weakSelf.localWebsocketID);
            if (weakSelf.localWebsocketID != -1) {
                [weakSelf.websocketServer pushMessage:messageData toConnection:weakSelf.localWebsocketID];
            } else {
                [self.masterBacklog addObject:messageData];
            }
        }
        
        if ([[message objectForKey:@"_name"] isEqualToString:@"localinfo"]) {
            //If we backlogged messages that arrived for the master before this
            //point, send them now that the master has connected
            for (NSData *backlogMessage in self.masterBacklog) {
//                NSLog(@"SENDING BACKLOGGED MESSAGE %@", [[NSString alloc] initWithData:backlogMessage encoding:NSUTF8StringEncoding]);
                [weakSelf.websocketServer pushMessage:backlogMessage toConnection:weakSelf.localWebsocketID];
            }
        }
//            }
    };
}

- (BLWebSocketOnMessageHandler)onIdentifiedWebsocketMessage {
    __weak typeof(self) weakSelf = self;
    
    return ^void (int connectionID, NSData *messageData) {
        NSDictionary *message = [CWUtil dictionaryFromJSONData:messageData];
        
        NSNumber *value = [NSNumber numberWithInt:connectionID];
        WSLog(4, @"Websocket message from %@ to %@: %@", [self.websocketIdentifiers allKeysForObject:value][0], [message objectForKey:@"_target"],[[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding]);
        
        //For identified websocket messages, the server basically acts as a message relay
        //Check where the message is supposed to be sent to and deliver it
        NSString *target = [message objectForKey:@"_target"];
        if ([target isEqualToString:@"broadcast"]) {
            [weakSelf.websocketServer pushMessageToAll:messageData];
        } else {
            [weakSelf.websocketServer pushMessage:messageData toConnection:[weakSelf connectionIDForIdentifier:target]];
        }
    };
}

- (BLWebSocketOnCloseHandler)onIdentifiedWebsocketClosed {
    __weak typeof(self) weakSelf = self;
    
    return ^void (int connectionID) {
        if (connectionID == self.localWebsocketID) {
            ErrLog(@"ERROR! LOCAL WEBSOCKET CLOSED!");
            //TODO: What to do here? This shouldn't happen!
        } else {
            //Find the remote websocket that was closed and report the close to our delegate
            NSString *identifier = [weakSelf identifierForConnectionID:connectionID];
            if (identifier != nil) {
                WSLog(3, @"Remote websocket did close (%@)", identifier);
                if ([weakSelf.delegate respondsToSelector:@selector(remoteDidDisconnect:)])
                {
                    [weakSelf.delegate remoteDidDisconnect:identifier];
                }
                
                [weakSelf.websocketIdentifiers removeObjectForKey:identifier];
            }
        }
    };
}


- (int)connectionIDForIdentifier:(NSString *)targetIdentifier {
    if ([targetIdentifier isEqualToString:@"master"]) {
        return self.localWebsocketID;
    }
    return [[self.websocketIdentifiers objectForKey:targetIdentifier] intValue];
}


- (NSString *)identifierForConnectionID:(int)targetID {
    for (NSString *identifier in self.websocketIdentifiers.allKeys) {
        int currentID = [[self.websocketIdentifiers objectForKey:identifier] intValue];
        if (currentID == targetID) return identifier;
    }
    
    return nil;
}

@end
