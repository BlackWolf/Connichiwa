//
//  CWBeaconMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWDevice;



/**
 *  Delegate for CWBeaconMonitor. Implementing this protocol allows to receive events about discovered and changed beacons from CWBeaconMonitor.
 */
@protocol CWDeviceManagerDelegate <NSObject>

@optional
- (void)deviceUpdated:(CWDevice *)device;

@end
