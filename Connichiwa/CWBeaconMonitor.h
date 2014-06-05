//
//  CWBeaconDetector.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>
#import "CWBeaconMonitorDelegate.h"



/**
 *  An instance of this class is responsible for detecting and managing other Connichiwa devices via iBeacon. Devices are stored in CWRemoteDevice objects. If a device is detected, leaves or its properties change, this is reported to CWBeaconMonitor's delegate. 
 */
@interface CWBeaconMonitor : NSObject <CLLocationManagerDelegate>

@property (readwrite, weak) id<CWBeaconMonitorDelegate> delegate;

+ (instancetype)mainDetector;
- (void)startMonitoring;

@end
