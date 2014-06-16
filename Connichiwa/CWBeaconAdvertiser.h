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
@class CWDeviceID;



/**
 *  An instance of CWBeaconAdvertiser sets this device up to act as an iBeacon over BTLE and make itself discoverable by other devices running a CWBeaconMonitor.
 *  When advertising, CWBeaconAdvertiser assigns a random CWDeviceID to this beacon which is transmitted with the iBeacon package and can be picked up by other devices.
 *  Every device should only act as a single iBeacon - it is not recommended to create multiple instances of this class, which will yield undefined results.
 */
@interface CWBeaconAdvertiser : NSObject <CBPeripheralManagerDelegate>

/**
 *  Delegate that receives events from CWBeaconAdvertiser
 */
@property (readwrite, strong) id<CWBeaconAdvertiserDelegate> delegate;

/**
 *  The unique ID that this beacon advertises
 */
@property (readonly) CWDeviceID *myID;

/**
 *  Make this device start advertising as an iBeacon. It becomes detectable by other Connichiwa devices.
 */
- (void)startAdvertising;

@end
