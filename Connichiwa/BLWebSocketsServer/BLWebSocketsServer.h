//
//  BLWebSocketServer.h
//  LibWebSocket
//
//  Created by Benjamin Loulier on 1/22/13.
//  Copyright (c) 2013 Benjamin Loulier. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^BLWebSocketsHandleRequestBlock)(int connectionID, NSData *messageData);

@interface BLWebSocketsServer : NSObject

@property (atomic, assign, readonly) BOOL isRunning;

+ (BLWebSocketsServer *)sharedInstance;

- (void)startListeningOnPort:(int)port withProtocolName:(NSString *)protocolName andCompletionBlock:(void(^)(NSError *error))completionBlock;
- (void)stopWithCompletionBlock:(void(^)())completionBlock;
- (void)setDefaultHandleRequestBlock:(BLWebSocketsHandleRequestBlock)handleRequestBlock;
- (void)setHandleRequestBlock:(BLWebSocketsHandleRequestBlock)handleRequestBlock forConnection:(int)user;
- (void)push:(NSData *)data toConnection:(int)connectionID;
- (void)pushToAll:(NSData *)data;

@end
