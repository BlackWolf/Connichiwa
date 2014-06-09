//
//  CWBeacon.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBeaconAdvertiser.h"
#import "CWDebug.h"
#import "CWConstants.h"



@interface CWBeaconAdvertiser ()

@property (readwrite, strong) NSNumber *major;
@property (readwrite, strong) NSNumber *minor;

/**
 *  Core Bluetooth Peripheral Manager, responsible for advertising the iBeacon
 */
@property (readwrite, strong) CBPeripheralManager *peripheralManager;

/**
 *  Represents the local region that our beacon creates
 */
@property (readwrite, strong) CLBeaconRegion *beaconRegion;

@end



@implementation CWBeaconAdvertiser


+ (instancetype)mainAdvertiser
{
    static dispatch_once_t token;
    static id sharedInstance;
    dispatch_once(&token, ^{
        sharedInstance = [[self alloc] init];
    });
    
    return sharedInstance;
}


- (void)startAdvertising
{
    DLog(@"Initializing CBPeripheralManager...");
    
    //We have to wait for the CBPeripheralManager to get ready before we can start broadcasting
    //When the manager was powered on, it will call peripheralManagerDidUpdateState: on its delegate
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:dispatch_get_main_queue()];
}


#pragma mark CBPeripheralManagerDelegate


/**
 *  Called by CBPeripheralManager when its power state changes
 *
 *  @param manager The CBPeripheralManager instance that changed
 */
- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)manager
{
    if ([manager state] == CBPeripheralManagerStatePoweredOn)
    {
        //Powered On - We can start advertising as an iBeacon
        //To identify beacons, we randomize the major/minor and pray to god no other beacon happens to have the same major/minor
        uint16_t randomMajor = arc4random();
        uint16_t randomMinor = arc4random();
        self.beaconRegion = [[CLBeaconRegion alloc] initWithProximityUUID:[[NSUUID alloc] initWithUUIDString:BEACON_UUID]
                                                                    major:randomMajor
                                                                    minor:randomMinor
                                                               identifier:@""];
        NSDictionary *advertismentData = [self.beaconRegion peripheralDataWithMeasuredPower:nil];
        
        [self.peripheralManager startAdvertising:advertismentData];
        
        DLog(@"Peripheral Manager state changed to PoweredOn - Advertising as iBeacon (%d.%d)...", randomMajor, randomMinor);
    }
    
    [CWDebug executeInDebug:^{
        if ([manager state] == CBPeripheralManagerStateUnknown) DLog(@"Peripheral Manager state changed to Unknown");
        else if ([manager state] == CBPeripheralManagerStateResetting) DLog(@"Peripheral Manager state changed to Resetting");
        else if ([manager state] == CBPeripheralManagerStateUnsupported) DLog(@"Peripheral Manager state changed to Unsupported");
        else if ([manager state] == CBPeripheralManagerStateUnauthorized) DLog(@"Peripheral Manager state changed to Unauthorized");
        else if ([manager state] == CBPeripheralManagerStatePoweredOff) DLog(@"Peripheral Manager state changed to PoweredOff");
    }];
}


#pragma mark Setter & Getter


@synthesize major = _major, minor = _minor; //TODO why do we need this?


- (NSNumber *)major
{
    return _major;
}


- (void)setMajor:(NSNumber *)major
{
    _major = major;
}


- (NSNumber *)minor
{
    return _minor;
}


- (void)setMinor:(NSNumber *)minor
{
    _minor = minor;
}

@end
