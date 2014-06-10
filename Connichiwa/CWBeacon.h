//
//  CWBeacon.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>



/**
 *  Encapsulates Connichiwa-related information about an iBeacon
 */
@interface CWBeacon : NSObject

/**
 *  The major value of the beacon's identifier number. Can be used to uniquely identify a beacon.
 */
@property (readonly) NSNumber *major;

/**
 *  The minor value of the beacon's identifier number. Can be used to uniquely identify a beacon.
 */
@property (readonly) NSNumber *minor;

/**
 *  A string determining a rough distance from this device to the beacon. Can be "far", "near", "immediate" or "unknown".
 *  For a beacon that represents the local device, this will always be "unknown"
 */
@property (readonly) NSString *proximity;

/**
 *  Create a new CWBeacon with the given information
 *
 *  @param major     The major value
 *  @param minor     The minor value
 *  @param proximity The proximity string
 *
 *  @return A new instance of CWBeacon that stores the given information
 */
- (instancetype)initWithMajor:(NSNumber *)major minor:(NSNumber *)minor proximity:(CLProximity)proximity;

@end
