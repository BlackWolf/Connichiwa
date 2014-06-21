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
    CWBluetoothConnectionStateInitialConnecting,
    CWBluetoothConnectionStateInitialWaitingForData,
    CWBluetoothConnectionStateInitialDone,
    CWBluetoothConnectionStateIPConnecting,
    CWBluetoothConnectionStateIPSent,
    CWBluetoothConnectionStateIPDone,
    CWBluetoothConnectionStateErrored,
    CWBluetoothConnectionStateUnknown
};



@interface CWBluetoothConnection : NSObject

@property (readwrite) CWBluetoothConnectionState state;
@property (readwrite, strong) NSString *identifier;
@property (readwrite) int measuredPower;
@property (readonly) CBPeripheral *peripheral;
@property (readonly) double averageRSSI;
@property (readonly) double lastSentRSSI;

- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral;
- (void)addNewRSSIMeasure:(double)rssi;
- (void)didSendDistance;
- (NSTimeInterval)timeSinceLastSentRSSI;
- (double)averageDistance;
- (double)lastSentDistance;
- (BOOL)isReady;

@end
