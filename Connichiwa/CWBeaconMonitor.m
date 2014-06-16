//
//  CWBeaconDetector.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBeaconMonitor.h"
#import "CWDeviceID.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBeaconMonitor ()

/**
 *  CLLocationManager looks for iBeacons and reports found beacons to its delegate
 */
@property (readwrite, strong) CLLocationManager *locationManager;

/**
 *  Represents a template of beacons we are searching for around us
 */
@property (readwrite, strong) CLBeaconRegion *beaconRegion;

/**
 *  An array of currently detected beacons
 */
@property (readwrite, strong) NSArray *currentBeacons;

/**
 *  Returns a string describing the proximity of a beacon
 *
 *  @param proximity The CLProximity as returned by a CLBeacon
 *
 *  @return A string value describing the proximity
 */
- (NSString *)_stringForProximity:(CLProximity)proximity;

@end



@implementation CWBeaconMonitor


/**
 *  Creates a new instance of this class. It is not advised to have multiple advertiser active on a single device, you should only create this class once.
 *
 *  @return A new instance of this class.
 */
- (instancetype)init
{
    self = [super init];
    
    self.locationManager = [[CLLocationManager alloc] init];
    self.locationManager.delegate = self;
    
    //Define the region template we will look for - UUID is required
    self.beaconRegion = [[CLBeaconRegion alloc] initWithProximityUUID:[[NSUUID alloc] initWithUUIDString:BEACON_UUID] identifier:@""];
    
    self.currentBeacons = @[];
    
    return self;
}


- (void)startMonitoring
{
    if ([CLLocationManager isMonitoringAvailableForClass:[CLBeaconRegion class]])
    {
        DLog(@"Start monitoring for iBeacons...");
    }
    else
    {
        DLog(@"Device doesn't seem to have iBeacon capabilities. We cannot monitor!");
        return;
    }
    
    [self.beaconRegion setNotifyOnEntry:YES];
    [self.beaconRegion setNotifyOnExit:YES];
    [self.beaconRegion setNotifyEntryStateOnDisplay:YES];
    
    [self.locationManager startMonitoringForRegion:self.beaconRegion];
    [self.locationManager startRangingBeaconsInRegion:self.beaconRegion];
}


- (NSString *)_stringForProximity:(CLProximity)proximity
{
    NSString *proximityString;
    switch (proximity)
    {
        case CLProximityUnknown:    proximityString = @"unknown";    break;
        case CLProximityImmediate:  proximityString = @"immediate";  break;
        case CLProximityNear:       proximityString = @"near";       break;
        case CLProximityFar:        proximityString = @"far";        break;
    }
    
    return proximityString;
}


#pragma mark CLLocationManagerDelegate


/**
 *  Called by CLLocationManager when we cross the border of a beacon and enter its range
 *
 *  @param manager The CLLocationManager instance that detected the change
 *  @param region The region that was entered
 */
- (void)locationManager:(CLLocationManager *)manager didEnterRegion:(CLRegion *)region
{
    [CWDebug executeInDebug:^{
        if (region == self.beaconRegion) DLog(@"Connichiwa iBeacon region entered");
        else DLog(@"Non-Connichiwa iBeacon region entered");
    }];
}


/**
 *  Called by CLLocationManager when we cross the border of a beacon and exit its range
 *
 *  @param manager The CLLocationManager instance that detected the change
 *  @param region The region that was exited
 */
- (void)locationManager:(CLLocationManager *)manager didExitRegion:(CLRegion *)region
{
    [CWDebug executeInDebug:^{
        if (region == self.beaconRegion) DLog(@"Connichiwa iBeacon region exited");
        else DLog(@"Non-Connichiwa iBeacon region exited");
    }];
}


/**
 *  Called by CLLocationManager constantly to report found beacons in our beaconRegion. We get an array of beacons here and then check for new and changed beacons, which we then report to our delegate.
 *  Note that this method is also called with an empty beacon array
 *
 *  @param manager The CLLocationManager instance that detected the beacons
 *  @param beacons The array of found beacons
 *  @param region  The region in which the beacons where detected - should be the same as our beaconRegion
 */
- (void)locationManager:(CLLocationManager *)manager didRangeBeacons:(NSArray *)beacons inRegion:(CLBeaconRegion *)region
{
    [CWDebug executeInDebug:^{
        if ([beacons count] > 0) DLog(@"%lu iBeacons detected nearby", (unsigned long)[beacons count]);
        for (CLBeacon *beacon in beacons)
        {
            ResolveUnused(beacon);
            DLog(@"Beacon (%@.%@) ranged at %@ distance (Signal strength %li ; accuracy %.2f)",
                 beacon.major,
                 beacon.minor,
                 [self _stringForProximity:beacon.proximity],
                 (long)beacon.rssi,
                 beacon.accuracy);
        }
    }];
    
    //When a beacon is shut down, it first goes to unknown proximity and then disappears about 5-10 seconds later
    //To speedup beacon loss events, we therefore treat beacons at unknown proximity as lost beacons
    NSMutableArray *newBeacons = [beacons mutableCopy];
    for (CLBeacon *beacon in newBeacons)
    {
        if (beacon.proximity == CLProximityUnknown) [newBeacons removeObject:beacon];
    }
    
    NSMutableArray *oldBeacons = [self.currentBeacons mutableCopy];
    self.currentBeacons = newBeacons;
    
    //Compare the new beacon and old beacon list
    //  Beacons only in the new list are new devices
    //  Beacons only in the old list are lost devices
    //  Beacons in both lists are updated devices
    for (CLBeacon *currentBeacon in self.currentBeacons)
    {
        BOOL isNew = YES;
        for (CLBeacon *oldBeacon in oldBeacons)
        {
            if ([currentBeacon.major isEqualToNumber:oldBeacon.major] && [currentBeacon.minor isEqualToNumber:oldBeacon.minor])
            {
                if (currentBeacon.proximity != oldBeacon.proximity)
                {
                    CWDeviceID *currentBeaconID = [[CWDeviceID alloc] initWithMajor:currentBeacon.major minor:currentBeacon.minor];
                    NSString *proximityString = [self _stringForProximity:currentBeacon.proximity];
                    if ([self.delegate respondsToSelector:@selector(beaconWithID:changedProximity:)]) [self.delegate beaconWithID:currentBeaconID changedProximity:proximityString];
                }
                [oldBeacons removeObject:oldBeacon];
                isNew = NO;
                break;
            }
        }
        
        if (isNew)
        {
            CWDeviceID *currentBeaconID = [[CWDeviceID alloc] initWithMajor:currentBeacon.major minor:currentBeacon.minor];
            NSString *proximityString = [self _stringForProximity:currentBeacon.proximity];
            if ([self.delegate respondsToSelector:@selector(beaconDetectedWithID:inProximity:)]) [self.delegate beaconDetectedWithID:currentBeaconID inProximity:proximityString];
        }
    }
    //All updated beacons were removed, therefore only lost beacons remain
    for (CLBeacon *oldBeacon in oldBeacons)
    {
        CWDeviceID *oldBeaconID = [[CWDeviceID alloc] initWithMajor:oldBeacon.major minor:oldBeacon.minor];
        if ([self.delegate respondsToSelector:@selector(beaconLostWithID:)]) [self.delegate beaconLostWithID:oldBeaconID];
    }
}

@end
