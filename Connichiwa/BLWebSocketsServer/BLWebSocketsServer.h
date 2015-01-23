//
//  BLWebSocketServer.h
//  LibWebSocket
//
//  Created by Benjamin Loulier on 1/22/13.
//  Copyright (c) 2013 Benjamin Loulier. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NSData *(^BLWebSocketsHandleRequestBlock)(int id, NSData * requestData);

@interface BLWebSocketsServer : NSObject

@property (atomic, assign, readonly) BOOL isRunning;

+ (BLWebSocketsServer *)sharedInstance;

- (void)startListeningOnPort:(int)port withProtocolName:(NSString *)protocolName andCompletionBlock:(void(^)(NSError *error))completionBlock;
- (void)stopWithCompletionBlock:(void(^)())completionBlock;
- (void)setDefaultHandleRequestBlock:(BLWebSocketsHandleRequestBlock)handleRequestBlock;
- (void)setHandleRequestBlock:(BLWebSocketsHandleRequestBlock)handleRequestBlock forSession:(int)user;
- (void)push:(NSData *)data toSession:(int)session;
- (void)pushToAll:(NSData *)data;

@end
