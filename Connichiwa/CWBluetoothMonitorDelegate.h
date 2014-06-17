//
//  CWBluetoothMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWDeviceID.h"

@protocol CWBluetoothMonitorDelegate <NSObject>

- (void)beaconDetectedWithID:(CWDeviceID *)ID inProximity:(NSString *)proximity;
- (void)beaconWithID:(CWDeviceID *)ID changedProximity:(NSString *)proximity;
- (void)beaconLostWithID:(CWDeviceID *)ID;

@end
