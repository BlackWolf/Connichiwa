//
//  CWBeacon.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBeacon.h"



@interface CWBeacon ()

@property (readwrite, strong) NSNumber *major;
@property (readwrite, strong) NSNumber *minor;
@property (readwrite, strong) NSString *proximity;

@end



@implementation CWBeacon


- (instancetype)initWithMajor:(NSNumber *)major minor:(NSNumber *)minor proximity:(CLProximity)proximity
{
    self = [super init];
    
    self.major = major;
    self.minor = minor;
    
    switch (proximity) {
        case CLProximityImmediate: self.proximity = @"immediate"; break;
        case CLProximityNear: self.proximity = @"near"; break;
        case CLProximityFar: self.proximity = @"far"; break;
        default: self.proximity = @"unknown";
        
    }
    
    return self;
}

@end
