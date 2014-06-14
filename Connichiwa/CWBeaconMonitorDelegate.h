//
//  CWBeaconMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 14/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWDeviceID;

@protocol CWBeaconMonitorDelegate <NSObject>

- (void)beaconDetectedWithID:(CWDeviceID *)ID inProximity:(NSString *)proximity;
- (void)beaconWithID:(CWDeviceID *)ID changedProximity:(NSString *)proximity;
- (void)beaconLostWithID:(CWDeviceID *)ID;

@end
