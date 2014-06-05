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



/**
 *  An instance of CWBeacon sets this device up to act as an iBeacon and make itself discoverable by other devices running a CWBeaconDetector. CWBeacon takes care of waiting for the BT peripheral manager to become ready and then broadcast the correct data over it.
 *  Every device should only act as a single iBeacon - therefore, it is recommended to use the mainBeacon class to retrieve the main beacon instance.
 */
@interface CWBeaconAdvertiser : NSObject <CBPeripheralManagerDelegate>

+ (instancetype)mainBeacon;
- (void)startAdvertising;

@end
