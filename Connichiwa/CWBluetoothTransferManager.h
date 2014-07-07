//
//  CWBluetoothTransferManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 07/07/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "CWBluetoothTransferManagerDelegate.h"

@interface CWBluetoothTransferManager : NSObject

/**
 *  The delegate that receives events by this class
 */
@property (readwrite) id<CWBluetoothTransferManagerDelegate> delegate;

- (instancetype)initWithPeripheralManager:(CBPeripheralManager *)peripheralManager;
- (void)sendData:(NSData *)data toCentral:(CBCentral *)central withCharacteristic:(CBMutableCharacteristic *)characteristic;
- (void)sendData:(NSData *)data toPeripheral:(CBPeripheral *)peripheral withCharacteristic:(CBCharacteristic *)characteristic;
- (void)receivedData:(NSData *)chunk fromPeripheral:(CBPeripheral *)peripheral withCharacteristic:(CBCharacteristic *)characteristic;
- (void)canContinueSendingToCentrals;

@end
