//
//  CWBluetoothCentral.h
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "CWBluetoothMonitorDelegate.h"

@interface CWBluetoothMonitor : NSObject

@property (readwrite, strong) id<CWBluetoothMonitorDelegate> delegate;

- (void)startSearching;
- (void)handshakeWebsocketConnection:(NSString *)identifier;

@end
