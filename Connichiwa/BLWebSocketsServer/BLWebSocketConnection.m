//
//  BLWebSocket.m
//  Connichiwa
//
//  Created by Mario Schreiner on 23/01/15.
//  Copyright (c) 2015 Mario Schreiner. All rights reserved.
//

#import "BLWebSocketConnection.h"



@interface BLWebSocketConnection()

@property (readwrite) int ID;
@property (readwrite) struct libwebsocket *socket;
@property (readwrite, strong) NSMutableArray *outgoingMessagesQueue;

@end

@implementation BLWebSocketConnection

- (instancetype)initWithID:(int)ID socket:(struct libwebsocket *)socket {
    self = [super init];
    
    self.ID = ID;
    self.socket = socket;
    self.outgoingMessagesQueue = [NSMutableArray arrayWithCapacity:0];
    
    return self;
}


#pragma mark Outgoing Messages Queue


- (void)enqueueOutgoingMessage:(NSData *)message {
    @synchronized(self) {
        [self.outgoingMessagesQueue insertObject:message atIndex:0];
    }
}

- (NSData *)dequeueOutgoingMessage {
    @synchronized(self) {
        NSData *msg = [self.outgoingMessagesQueue lastObject];
        
        if (msg == nil) return nil;
        
        [self.outgoingMessagesQueue removeObjectAtIndex:[self.outgoingMessagesQueue indexOfObject:msg]];
        return msg;
    }
}

-(void)removeAllOutgoingMessages {
    [self.outgoingMessagesQueue removeAllObjects];
}



@end
