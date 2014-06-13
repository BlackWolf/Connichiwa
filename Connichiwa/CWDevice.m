//
//  CWDevice.m
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWDevice.h"



@interface CWDevice ()

@property (readwrite, strong) NSNumber *major;
@property (readwrite, strong) NSNumber *minor;
@property (readwrite) CLProximity proximity;
@property (readwrite) CLLocationAccuracy accuracy;
@property (readwrite) NSInteger rssi;

@end

@implementation CWDevice


- (instancetype)initWithBeaconData:(CLBeacon *)beaconData
{
    self = [super init];
    
    self.major = beaconData.major;
    self.minor = beaconData.minor;
    [self updateBeaconData:beaconData];
    
    return self;
}


- (BOOL)updateBeaconData:(CLBeacon *)beaconData
{
    //major/minor identifies this device, it cannot be changed
    if ([self.major isEqualToNumber:beaconData.major] == NO || [self.minor isEqualToNumber:beaconData.minor] == NO) return NO;
    
    BOOL wasUpdated = NO;
    if (self.proximity != beaconData.proximity)
    {
        self.proximity = beaconData.proximity;
        wasUpdated = YES;
    }
    /*if (self.rssi != beaconData.rssi)
    {
        self.rssi = beaconData.rssi;
        wasUpdated = YES;
    }
    if (self.accuracy != beaconData.accuracy)
    {
        self.accuracy = beaconData.accuracy;
        wasUpdated = YES;
    }*/
    
    return wasUpdated;
}

- (NSString *)proximityString
{
    switch (self.proximity)
    {
        case CLProximityFar:
            return @"far";
            break;
        case CLProximityNear:
            return @"near";
            break;
        case CLProximityImmediate:
            return @"immediate";
            break;
        default:
            return @"unknown";
    }
}

@end
