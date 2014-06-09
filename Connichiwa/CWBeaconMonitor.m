//
//  CWBeaconDetector.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBeaconMonitor.h"
#import "CWBeacon.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBeaconMonitor ()

/**
 *  CLLocationManager looks for iBeacons and reports found beacons to its delegate
 */
@property (readwrite, strong) CLLocationManager *locationManager;

/**
 *  Represents a template of the beacons we are looking for
 */
@property (readwrite, strong) CLBeaconRegion *beaconRegion;

@end



@implementation CWBeaconMonitor


+ (instancetype)mainMonitor
{
    static dispatch_once_t token;
    static id sharedInstance;
    dispatch_once(&token, ^{
        sharedInstance = [[self alloc] init];
    });
    
    return sharedInstance;
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
    
    self.locationManager = [[CLLocationManager alloc] init];
    self.locationManager.delegate = self;
    
    //Define the region template the location manager will search for - UUID is required
    self.beaconRegion = [[CLBeaconRegion alloc] initWithProximityUUID:[[NSUUID alloc] initWithUUIDString:BEACON_UUID] identifier:@""];
    [self.beaconRegion setNotifyOnEntry:YES];
    [self.beaconRegion setNotifyOnExit:YES];
    [self.beaconRegion setNotifyEntryStateOnDisplay:YES];
    
    //Make the location manager look for that region
    [self.locationManager startMonitoringForRegion:self.beaconRegion];
    [self.locationManager startRangingBeaconsInRegion:self.beaconRegion]; //TODO should this be moved to didEnter/ExitRegion?
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
        if ([beacons count] > 0) DLog(@"%lu iBeacons found nearby", (unsigned long)[beacons count]);
    }];
    
    for (CLBeacon *beacon in beacons)
    {
        if (beacon.proximity == CLProximityUnknown) continue;
        //TODO check if this beacon is us by checking major/minor... just in case
        
        CWBeacon *connichiwaBeacon = [[CWBeacon alloc] initWithMajor:beacon.major minor:beacon.minor proximity:beacon.proximity];
        
        DLog(@"DELEGATE IS %@", self.delegate);
        [self.delegate beaconUpdated:connichiwaBeacon];
        
        [CWDebug executeInDebug:^{
            NSString *distanceString;
            switch (beacon.proximity)
            {
                case CLProximityUnknown:    distanceString = @"unknown";    break;
                case CLProximityImmediate:  distanceString = @"immediate";  break;
                case CLProximityNear:       distanceString = @"near";       break;
                case CLProximityFar:        distanceString = @"far";        break;
            }
            
            DLog(@"Detected beacon (%@.%@) at %@ distance",  beacon.major, beacon.minor, distanceString);
            DLog(@"Signal strength is %li with an accuracy of %.2f", (long)beacon.rssi, beacon.accuracy);
        }];
    }
}

@end
