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

@end

@implementation BLWebSocketConnection

- (instancetype)initWithID:(int)ID socket:(struct libwebsocket *)socket {
    self = [super init];
    
    self.ID = ID;
    self.socket = socket;
    
    return self;
}



@end
