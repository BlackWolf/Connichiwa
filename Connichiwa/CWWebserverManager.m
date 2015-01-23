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
@property (readwrite) int localSession;
@property (strong, readwrite) NSMutableDictionary *sessionIdentifiers;

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
    self.sessionIdentifiers = [NSMutableDictionary dictionary];
    
    // Create server
    self.webServer = [[GCDWebServer alloc] init];
    
    [self.webServer
     addGETHandlerForBasePath:@"/"
     directoryPath:self.documentRoot
     indexFilename:@"index.html"
     cacheAge:0
     allowRangeRequests:YES];
    
    NSMutableString *resourcePath = [[[CWBundle bundle] bundlePath] mutableCopy];
    
    [self.webServer
     addGETHandlerForBasePath:@"/connichiwa/"
     directoryPath:[resourcePath stringByAppendingPathComponent:@"weblib"]
     indexFilename:nil
     cacheAge:0
     allowRangeRequests:YES];
    
    [self.webServer
     addGETHandlerForBasePath:@"/connichiwa/scripts/"
     directoryPath:[resourcePath stringByAppendingPathComponent:@"scripts"]
     indexFilename:nil
     cacheAge:0
     allowRangeRequests:YES];
    
    [self.webServer addGETHandlerForPath:@"/remote" filePath:[resourcePath stringByAppendingPathComponent:@"remote.html"] isAttachment:NO cacheAge:0 allowRangeRequests:YES];
    
    [self.webServer
     addHandlerForMethod:@"GET" path:@"/check" requestClass:[GCDWebServerRequest class] processBlock:^GCDWebServerResponse *(GCDWebServerRequest* request) {
         return [GCDWebServerResponse responseWithStatusCode:200];
     }];

//    [self.webServer
//     addGETHandlerForBasePath:@"/gallery/"
//     directoryPath:[[self.documentRoot mutableCopy] stringByAppendingPathExtension:@"gallery/"]
//     indexFilename:@"index.html"
//     cacheAge:0
//     allowRangeRequests:YES];
    
    // Add a handler to respond to GET requests on any URL
//    [self.webServer addDefaultHandlerForMethod:@"GET"
//                              requestClass:[GCDWebServerRequest class]
//                              processBlock:^GCDWebServerResponse *(GCDWebServerRequest* request) {
//                                  
//                                  return [GCDWebServerDataResponse responseWithHTML:@"<html><body><p>Hello World</p> <img src='/sound.png'></body></html>"];
//                                  
//                              }];
    
    
    self.websocketServer = [BLWebSocketsServer sharedInstance];
    
    __weak typeof(self) weakSelf = self;
    static NSString *nexttarget;
    [self.websocketServer setDefaultHandleRequestBlock:^NSData *(int session, NSData *requestData) {
        NSString *string = [[NSString alloc] initWithData:requestData encoding:NSUTF8StringEncoding];
        NSLog(@"GOT A MESSAGE: %@", string);
        NSDictionary *msg = [CWUtil dictionaryFromJSONData:requestData];
        
        if ([[msg objectForKey:@"_name"] isEqualToString:@"localinfo"]) {
            NSLog(@"FOUND LOCAL INFO");
            weakSelf.localSession = session;
            
            NSString *identifier = [msg objectForKey:@"identifier"];
            [weakSelf.sessionIdentifiers setObject:[NSNumber numberWithInt:session] forKey:identifier];
            
            // onLocalMessage
            [weakSelf.websocketServer setHandleRequestBlock:^NSData *(int session, NSData *requestData) {
                NSDictionary *msg = [CWUtil dictionaryFromJSONData:requestData];
                NSString *target = [msg objectForKey:@"_target"];
                if ([target isEqualToString:@"broadcast"]) {
                    NSLog(@"BROADCASTING LOCAL MESSAGE");
                    [weakSelf.websocketServer pushToAll:requestData];
                } else {
                    int targetSession = [[weakSelf.sessionIdentifiers objectForKey:target] intValue];
                    NSLog(@"SENDING LOCAL MESSAGE TO %@ (%d)", target, targetSession);
                    [weakSelf.websocketServer push:requestData toSession:targetSession];
                }
                return nil;
            } forSession:session];
        }
        
        if ([[msg objectForKey:@"_name"] isEqualToString:@"remoteinfo"]) {
            NSLog(@"FOUND REMOTE INFO");
            
            NSString *identifier = [msg objectForKey:@"identifier"];
            [weakSelf.sessionIdentifiers setObject:[NSNumber numberWithInt:session] forKey:identifier];
            
            // onRemoteMessage
            [weakSelf.websocketServer setHandleRequestBlock:^NSData *(int session, NSData *requestData) {
                NSDictionary *msg = [CWUtil dictionaryFromJSONData:requestData];
                
                if ([[msg objectForKey:@"_name"] isEqualToString:@"_nexttarget"]) {
                    //Remember next target
                    nexttarget = [msg objectForKey:@"_target"];
                    return nil;
                }
                if ([[msg objectForKey:@"_target"] isEqualToString:@"broadcast"]) {
                    NSLog(@"BROADCASTING REMOTE MESSAGE");
                    [weakSelf.websocketServer pushToAll:requestData];
                } else {
                    NSString *target = [msg objectForKey:@"_target"];
                    
                    if (target == nil) target = nexttarget;
                    
                    int targetSession;
                    if ([target isEqualToString:@"master"]) {
                        targetSession = weakSelf.localSession;
                    } else {
                        targetSession = [[weakSelf.sessionIdentifiers objectForKey:target] intValue];
                    }
                    NSLog(@"SENDING REMOTE MESSAGE TO %@ (%d): %@", target, targetSession, @"");
                    [weakSelf.websocketServer push:requestData toSession:targetSession];
                }
                return nil;
            } forSession:session];
            
            //Relay remote info to the local weblib
            [weakSelf.websocketServer push:requestData toSession:weakSelf.localSession];
        }
        
        return nil;
    }];
    
//    [self.websocketServer setHandleRequestBlock:^NSData *(int id, NSData *requestData) {
//        NSLog(@"IT TOTALLY WORKS!!");
//        return requestData;
//    } forSession:0];
    
    [self.webServer startWithPort:port bonjourName:nil];
//    dispatch_async(dispatch_get_main_queue(), ^{
        [self.websocketServer startListeningOnPort:(port+1) withProtocolName:nil andCompletionBlock:^(NSError *error) { [self _receivedFromServer_serverDidStart]; }];
//    });
    
//    [self _receivedFromServer_serverDidStart];
    
//    self.nodelikeContext = [[NLContext alloc] initWithVirtualMachine:[[JSVirtualMachine alloc] init]];
//    
//    //Register JS error handler
//    self.nodelikeContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
//        dispatch_async(dispatch_get_main_queue(), ^{
//            _CWLog(1, @"WEBSERVER", @"?????", -1, @"JAVASCRIPT ERROR: %@. Stack: %@", e, [e valueForProperty:@"stack"]);
//        });
//    };
//    
//    id logger = ^(NSString *logMessage)
//    {
//        NSArray *components = [logMessage componentsSeparatedByString:@"|"]; //array should contain: prio, message
//        if ([components count] != 2)
//        {
//            _CWLog(1, @"WEBSERVER", @"?????", -1, logMessage);
//        }
//        else
//        {
//            _CWLog([[components objectAtIndex:0] intValue], @"WEBSERVER", @"?????", -1, [components objectAtIndex:1]);
//        }
//    };
//    self.nodelikeContext[@"console"][@"log"] = logger;
//    self.nodelikeContext[@"console"][@"error"] = logger;
//    //TODO we should add the other console types (warn, ...) and maybe format them specially
//    
//    [self _registerJSCallbacks];
//    
//    //Pass some infos to the webserver
//    self.nodelikeContext[@"HTTP_PORT"] = [NSString stringWithFormat:@"%d", port];
//    self.nodelikeContext[@"DOCUMENT_ROOT"] = self.documentRoot;
//    self.nodelikeContext[@"RESOURCES_PATH"] = [[CWBundle bundle] bundlePath];
//    
//    //Start the actual webserver by executing our Node.JS server script
//    NSString *serverScriptPath = [[CWBundle bundle] pathForResource:@"server" ofType:@"js"];
//    NSString *serverScript = [NSString stringWithContentsOfFile:serverScriptPath encoding:NSUTF8StringEncoding error:nil];
//    
//    [self.nodelikeContext evaluateScript:serverScript];
//    [self.nodelikeContext evaluateScript:@"startListening();"];
//    [NLContext runEventLoopAsyncInContext:self.nodelikeContext];
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
