//
//  BLWebSocketServer.h
//  LibWebSocket
//
//  Created by Benjamin Loulier on 1/22/13.
//  Copyright (c) 2013 Benjamin Loulier. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^BLWebSocketOnMessageHandler)(int connectionID, NSData *messageData);
typedef void (^BLWebSocketOnCloseHandler)(int connectionID);

@interface BLWebSocketsServer : NSObject

@property (atomic, assign, readonly) BOOL isRunning;

+ (BLWebSocketsServer *)sharedInstance;

- (void)startListeningOnPort:(int)port withProtocolName:(NSString *)protocolName andCompletionBlock:(void(^)(NSError *error))completionBlock;
- (void)stopWithCompletionBlock:(void(^)())completionBlock;
- (void)setDefaultOnMessageHandler:(BLWebSocketOnMessageHandler)handler;
- (void)setOnMessageHandler:(BLWebSocketOnMessageHandler)handler forConnection:(int)user;
- (void)setOnCloseHandler:(BLWebSocketOnCloseHandler)handler forConnection:(int)connectionID;
- (void)pushMessage:(NSData *)message toConnection:(int)connectionID;
- (void)pushMessageToAll:(NSData *)message;
- (void)pushMessageToAll:(NSData *)message except:(NSArray *)exceptions;

@end
