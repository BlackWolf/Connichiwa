//
//  CWBeaconDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 10/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWDeviceID.h"



/**
 *  A delegate protocol that receives events about this devices role as a connichiwa beacon by the CWBeaconAdvertiser instance
 */
@protocol CWBeaconAdvertiserDelegate <NSObject>

@optional

/**
 *  Called before this device starts advertising itself to other devices
 *
 *  @param ID The ID under which this device will advertise itself
 */
- (void)willStartAdvertisingWithID:(CWDeviceID *)ID;

/**
 *  Called after this device started advertising itself to other devices
 *
 *  @param ID The ID under which the device is know advertising itself
 */
- (void)didStartAdvertisingWithID:(CWDeviceID *)ID;

@end
