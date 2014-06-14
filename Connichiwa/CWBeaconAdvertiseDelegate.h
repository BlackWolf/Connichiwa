//
//  CWBeaconDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 10/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWDeviceID.h"



@protocol CWBeaconAdvertiserDelegate <NSObject>

@optional
- (void)willStartAdvertisingWithID:(CWDeviceID *)ID;
- (void)didStartAdvertisingWithID:(CWDeviceID *)ID;

@end
