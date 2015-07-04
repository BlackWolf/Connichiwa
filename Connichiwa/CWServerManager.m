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
@property (strong, readwrite) GCDWebServer *webServer;
@property (strong, readwrite) BLWebSocketsServer *websocketServer;
@property (readwrite) int localWebsocketID;
@property (strong, readwrite) NSMutableDictionary *websocketIdentifiers;
@property (strong, readwrite) NSMutableArray *masterBacklog;

@end



@implementation CWServerManager


- (instancetype)init
{
    self = [super init];
    
    self.state = CWServerManagerStateStopped;
    
    return self;
}


- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port
{
    CWLog(1, @"Webserver is starting with document root %@ on port %d", documentRoot, port);

    self.state = CWServerManagerStateStarting;
    
    self.documentRoot = documentRoot;
    self.localWebsocketID = -1;
    self.websocketIdentifiers = [NSMutableDictionary dictionary];
    self.masterBacklog = [NSMutableArray array];

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
        NSDictionary *message = [CWUtil dictionaryFromJSONData:messageData];
//        NSLog(@"GOT MESSAGE %@", [[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding]);
        
        //If the message identifies the local weblib's websocket, save its ID
        if ([[message objectForKey:@"_name"] isEqualToString:@"_master_identification"]) {
//            NSLog(@"SET LOCAL ID TO %d", connectionID);
            weakSelf.localWebsocketID = connectionID;
        }
        
        //In any case, if this message identifies any websocket, write the
        //ID and connection into out lookup dictionary
        if ([[message objectForKey:@"_name"] isEqualToString:@"_master_identification"] ||
            [[message objectForKey:@"_name"] isEqualToString:@"_remote_identification"]) {
            //Save the Connichiwa identifier that belongs to the websocket connection
            [weakSelf.websocketIdentifiers setObject:[NSNumber numberWithInt:connectionID] forKey:[message objectForKey:@"identifier"]];
            
            //Make sure events from this websocket are handled by the appropiate handler from now on
            [weakSelf.websocketServer setOnMessageHandler:[weakSelf onIdentifiedWebsocketMessage] forConnection:connectionID];
            [weakSelf.websocketServer setOnCloseHandler:[weakSelf onIdentifiedWebsocketClosed] forConnection:connectionID];
        }
        
        //If the message identifies the local weblib's websocket, we can send
        //any message that arrived for it before this point
        if ([[message objectForKey:@"_name"] isEqualToString:@"_master_identification"]) {
            for (NSDictionary *backlog in self.masterBacklog) {
                int backlogCnnectionID = [[backlog objectForKey:@"connectionID"] intValue];
                WSLog(4, @"Delivering backlogged message from %@ to master", [self identifierForConnectionID:backlogCnnectionID]);
                [self _deliverMessage:[backlog objectForKey:@"messageData"] fromConnection:backlogCnnectionID];
            }
        }
    };
}

- (BLWebSocketOnMessageHandler)onIdentifiedWebsocketMessage {
    __weak typeof(self) weakSelf = self;
    
    return ^void (int connectionID, NSData *messageData) {
        if (self.localWebsocketID < 0) {
            //Master is not ready yet, backlog the message until he is
            WSLog(4, @"Backlogging message from %@ to master: %@", [self identifierForConnectionID:connectionID],[[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding]);
            [self.masterBacklog addObject:@{ @"connectionID" : @(connectionID), @"messageData" : messageData}];
        } else {
            //Everything ready, deliver message
            [weakSelf _deliverMessage:messageData fromConnection:connectionID];
        }
    };
}


- (void)_deliverMessage:(NSData *)messageData fromConnection:(int)connectionID {
    NSDictionary *message = [CWUtil dictionaryFromJSONData:messageData];
    
//    NSNumber *value = [NSNumber numberWithInt:connectionID];
    WSLog(4, @"Websocket message from %@ to %@: %@", [self identifierForConnectionID:connectionID], [message objectForKey:@"_target"],[[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding]);
    
    //For identified websocket messages, the server basically acts as a message relay
    //Check where the message is supposed to be sent to and deliver it
    NSString *target = [message objectForKey:@"_target"];
    
    //Messages with target broadcast are sent to everyone
    //the _broadcastToSource key decides if the messages is sent back to
    //its source
    if ([target isEqualToString:@"broadcast"]) {
        BOOL backToSource = [[message objectForKey:@"_broadcastToSource"] boolValue];
        if (backToSource) {
            [self.websocketServer pushMessageToAll:messageData];
        } else {
            [self.websocketServer pushMessageToAll:messageData except:@[ @(connectionID) ]];
        }
        
        return;
    }
    
    //For all other targets, just try to deliver to the right websocket
    [self.websocketServer pushMessage:messageData toConnection:[self connectionIDForIdentifier:target]];
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
    NSNumber *connectionID = [self.websocketIdentifiers objectForKey:targetIdentifier];
    if (connectionID == nil) {
        return -1;
    }
    return [connectionID intValue];
}


- (NSString *)identifierForConnectionID:(int)targetID {
    for (NSString *identifier in self.websocketIdentifiers.allKeys) {
        int currentID = [[self.websocketIdentifiers objectForKey:identifier] intValue];
        if (currentID == targetID) return identifier;
    }
    
    return nil;
}

@end
