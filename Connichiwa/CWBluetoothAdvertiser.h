//
//  CWBluetoothPeripheral.h
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "CWBluetoothAdvertiserDelegate.h"

@interface CWBluetoothAdvertiser : NSObject

@property (readwrite, strong) id<CWBluetoothAdvertiserDelegate> delegate;

- (void)startAdvertising;

@end
