//
//  CWBluetoothAdvertiserDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWDeviceID.h"



@protocol CWBluetoothAdvertiserDelegate <NSObject>

- (void)willStartAdvertisingWithID:(CWDeviceID *)ID;
- (void)didStartAdvertisingWithID:(CWDeviceID *)ID;

@end
