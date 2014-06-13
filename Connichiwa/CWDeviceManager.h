//
//  CWDeviceManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>
#import "CWDeviceManagerDelegate.h"

@interface CWDeviceManager : NSObject

/**
 *  The delegate object to receive events.
 */
@property (readwrite, strong) id<CWDeviceManagerDelegate> delegate;

+ (instancetype)sharedManager;
- (void)updateDeviceListWithBeaconList:(NSArray *)beacons;
- (void)addOrUpdateDeviceWithBeaconData:(CLBeacon *)beaconData;

@end
