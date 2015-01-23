//
//  BLWebSocket.h
//  Connichiwa
//
//  Created by Mario Schreiner on 23/01/15.
//  Copyright (c) 2015 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "BLWebSocketsServer.h"
#import "libwebsockets.h"



@interface BLWebSocketConnection : NSObject

@property (readonly) int ID;
@property (readonly) struct libwebsocket *socket;
@property (readwrite, copy) BLWebSocketsHandleRequestBlock handleRequestBlock;
@property (readwrite, strong) NSMutableData *currentMessage;

- (instancetype)initWithID:(int)ID socket:(struct libwebsocket *)socket;

@end
