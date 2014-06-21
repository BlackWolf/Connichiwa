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



typedef NS_ENUM(NSInteger, CWBluetoothConnectionState)
{
    CWBluetoothConnectionStateDiscovered,
    CWBluetoothConnectionStateReady,
    CWBluetoothConnectionStateInitialConnecting,
    CWBluetoothConnectionStateInitialWaitingForData,
    CWBluetoothConnectionStateInitialDone,
    CWBluetoothConnectionStateConnectionRequested,
    CWBluetoothConnectionStateConnectionIPsSent,
    CWBluetoothConnectionStateConnectionDone,
    CWBluetoothConnectionStateErrored
};



@interface CWBluetoothConnection : NSObject

@property (readwrite) CWBluetoothConnectionState state;
@property (readwrite, strong) NSString *identifier;
@property (readonly) CBPeripheral *peripheral;
@property (readonly) double averageRSSI;
@property (readonly) double savedRSSI;

- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral;
- (void)addNewRSSIMeasure:(double)rssi;
- (BOOL)isReady;
- (void)saveCurrentRSSI;
- (NSTimeInterval)timeSinceRSSISave;

@end
