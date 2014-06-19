//
//  CWBluetoothConnection.h
//  Connichiwa
//
//  Created by Mario Schreiner on 18/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
@class CBPeripheral, CWDeviceID;



@interface CWBluetoothConnection : NSObject

@property (readwrite, strong) NSString *identifier;
@property (readonly) CBPeripheral *peripheral;
@property (readonly) double averageRSSI;
@property (readonly) double savedRSSI;

- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral;
- (void)addNewRSSIMeasure:(double)rssi;
- (BOOL)hasIdentifier;
- (void)saveCurrentRSSI;
- (NSTimeInterval)timeSinceRSSISave;

@end
