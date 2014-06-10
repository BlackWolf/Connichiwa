//
//  CWBeacon.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <CoreLocation/CoreLocation.h>
#import "CWBeaconAdvertiseDelegate.h"
@class CWBeacon;



/**
 *  An instance of CWBeaconAdvertiser sets this device up to act as an iBeacon and make itself discoverable by other devices running a CWBeaconMonitor. 
 *  CWBeacon takes care of setting BT up and advertising the correct data. 
 *  CWBeacon's can be identified by their major/minor numbers, which are randomly assigned.
 *  Every device should only act as a single iBeacon - therefore, it is recommended to use the mainAdvertiser method to retrieve an instance of CWBeaconAdvertiser.
 */
@interface CWBeaconAdvertiser : NSObject <CBPeripheralManagerDelegate>

@property (readwrite, strong) id<CWBeaconAdvertiserDelegate> delegate;

@property (readonly) CWBeacon *localBeacon;

/**
 *  Returns the main advertiser instance. Since a device should only act as a single iBeacon, this should always be used to get an instance of CWBeaconAdvertiser
 *
 *  @return The main Beacon Advertiser
 */
+ (instancetype)mainAdvertiser;

/**
 *  Make this device start advertising as an iBeacon. It becomes detectable by other Connichiwa devices.
 */
- (void)startAdvertising;

@end
