//
//  CWBeacon.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBeaconAdvertiser.h"
#import "CWDeviceID.h"
#import "CWDebug.h"
#import "CWConstants.h"



@interface CWBeaconAdvertiser ()

@property (readwrite, strong) CWDeviceID *myID;

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
        //To identify beacons, we randomize the major/minor and pray to god no other beacon happens to have the same
        NSNumber *myMajor = [NSNumber numberWithUnsignedShort:(uint16_t)arc4random()];
        NSNumber *myMinor = [NSNumber numberWithUnsignedShort:(uint16_t)arc4random()];
        self.myID = [[CWDeviceID alloc] initWithMajor:myMajor minor:myMinor];

        self.beaconRegion = [[CLBeaconRegion alloc] initWithProximityUUID:[[NSUUID alloc] initWithUUIDString:BEACON_UUID]
                                                                    major:[self.myID.major unsignedShortValue]
                                                                    minor:[self.myID.minor unsignedShortValue]
                                                               identifier:@""];
        NSDictionary *advertismentData = [self.beaconRegion peripheralDataWithMeasuredPower:nil];
        
        DLog(@"Peripheral Manager state changed to PoweredOn - Advertising as iBeacon (%@.%@)...", self.myID.major, self.myID.minor);
        
        if ([self.delegate respondsToSelector:@selector(willStartAdvertisingWithID:)]) [self.delegate willStartAdvertisingWithID:self.myID];
        [self.peripheralManager startAdvertising:advertismentData];
        if ([self.delegate respondsToSelector:@selector(didStartAdvertisingWithID:)]) [self.delegate didStartAdvertisingWithID:self.myID];
    }
    
    [CWDebug executeInDebug:^{
        if ([manager state] == CBPeripheralManagerStateUnknown) DLog(@"Peripheral Manager state changed to Unknown");
        else if ([manager state] == CBPeripheralManagerStateResetting) DLog(@"Peripheral Manager state changed to Resetting");
        else if ([manager state] == CBPeripheralManagerStateUnsupported) DLog(@"Peripheral Manager state changed to Unsupported");
        else if ([manager state] == CBPeripheralManagerStateUnauthorized) DLog(@"Peripheral Manager state changed to Unauthorized");
        else if ([manager state] == CBPeripheralManagerStatePoweredOff) DLog(@"Peripheral Manager state changed to PoweredOff");
    }];
}

@end
