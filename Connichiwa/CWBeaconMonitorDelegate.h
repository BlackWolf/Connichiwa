//
//  CWBeaconMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWBeacon;



/**
 *  Delegate for CWBeaconMonitor. Implementing this protocol allows to receive events about discovered and changed beacons from CWBeaconMonitor.
 */
@protocol CWBeaconMonitorDelegate <NSObject>

@optional
/**
 *  Called by CWBeaconMonitor when the data of a beacon updated. This can mean that a new beacon arrived, left or an existing beacon changed (for example its proximity). This method might be called for a beacon even when no changes occured.
 *
 *  @param beacon The beacon that changed
 */
- (void)beaconUpdated:(CWBeacon *)beacon;

@end
