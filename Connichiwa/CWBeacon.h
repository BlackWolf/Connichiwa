//
//  CWBeacon.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>



@interface CWBeacon : NSObject

@property (readonly) NSNumber *major;
@property (readonly) NSNumber *minor;
@property (readonly) NSString *proximity;

- (instancetype)initWithMajor:(NSNumber *)major minor:(NSNumber *)minor proximity:(CLProximity)proximity;

@end
