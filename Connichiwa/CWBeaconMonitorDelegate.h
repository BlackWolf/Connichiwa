//
//  CWBeaconMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 14/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWDeviceID;



/**
 *  A delegate protocol that receives events about nearby detected connichiwa beacons (devices) by the CWBeaconMonitor instance
 */
@protocol CWBeaconMonitorDelegate <NSObject>

@optional

/**
 *  Called when a new, previously unknown beacon was detected nearby
 *
 *  @param ID        The ID of the newly detected device
 *  @param proximity A string describing the distance between this device and the detected device
 */
- (void)beaconDetectedWithID:(CWDeviceID *)ID inProximity:(NSString *)proximity;

/**
 *  Called when a known beacon changes its proximity
 *
 *  @param ID        The ID of the beacon that changed
 *  @param proximity A string describing the new distance between this device and the detected device
 */
- (void)beaconWithID:(CWDeviceID *)ID changedProximity:(NSString *)proximity;

/**
 *  Called when a known beacon was shutdown or went out of range
 *
 *  @param ID The ID of the lost beacon
 */
- (void)beaconLostWithID:(CWDeviceID *)ID;

@end
