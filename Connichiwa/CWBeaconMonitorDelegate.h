//
//  CWBeaconMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWBeacon;



@protocol CWBeaconMonitorDelegate <NSObject>

@optional
- (void)beaconUpdated:(CWBeacon *)beacon;

@end
