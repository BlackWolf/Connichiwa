//
//  CWBluetoothTransferManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 07/07/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol CWBluetoothTransferManagerDelegate <NSObject>

- (void)didReceiveMessage:(NSData *)data fromPeripheral:(CBPeripheral *)peripheral withCharacteristic:(CBCharacteristic *)characteristic;

@end
