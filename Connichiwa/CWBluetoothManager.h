//
//  CWBluetoothManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "CWBluetoothManagerDelegate.h"



@interface CWBluetoothManager : NSObject

@property (readwrite) id<CWBluetoothManagerDelegate> delegate;
@property (readonly) NSString *identifier;

- (void)startScanning;
- (void)startAdvertising;
- (void)stopScanning;
- (void)stopAdvertising;
- (void)sendNetworkAddressesToDevice:(NSString *)deviceIdentifier;

@end
