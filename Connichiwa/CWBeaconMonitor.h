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
 *  Monitors the proximity for other Connichiwa beacons. If found, it reports beacons to its delegate.
 *  Only one instance of the monitor should be active at all time, therefore always use mainMonitor to get an instance of this class.
 */
@interface CWBeaconMonitor : NSObject <CLLocationManagerDelegate>

/**
 *  The delegate object to receive events.
 */
@property (readwrite, strong) id<CWBeaconMonitorDelegate> delegate;

/**
 *  Returns the main instance of this class. Should always be used to retrieve an instance of CWBeaconMonitor.
 *
 *  @return the main monitor instance
 */
+ (instancetype)mainMonitor;

/**
 *  Starts monitor for other devices and sending events to the delegate if devices are found, lost or change.
 */
- (void)startMonitoring;

@end
