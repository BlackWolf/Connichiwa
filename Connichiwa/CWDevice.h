//
//  CWDevice.h
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>

@interface CWDevice : NSObject

// iBeacon Info (see CLBeacon)
@property (readonly) NSNumber *major;
@property (readonly) NSNumber *minor;
@property (readonly) CLProximity proximity;
@property (readonly) CLLocationAccuracy accuracy;
@property (readonly) NSInteger rssi;

- (instancetype)initWithBeaconData:(CLBeacon *)beaconData;
- (BOOL)updateBeaconData:(CLBeacon *)beaconData;
- (NSString *)proximityString;

@end
