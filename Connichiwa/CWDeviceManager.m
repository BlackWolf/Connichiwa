//
//  CWDeviceManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWDeviceManager.h"
#import "CWDevice.h"
#import "CWDebug.h"



@interface CWDeviceManager ()

@property (readwrite, strong) NSMutableArray *devices;

@end

@implementation CWDeviceManager


+ (instancetype)sharedManager
{
    static dispatch_once_t token;
    static id sharedInstance;
    dispatch_once(&token, ^{
        sharedInstance = [[self alloc] init];
    });
    
    return sharedInstance;
}


- (instancetype)init
{
    self = [super init];
    
    self.devices = [[NSMutableArray alloc] init];
    
    return self;
}


- (void)updateDeviceListWithBeaconList:(NSArray *)beacons
{
    NSMutableArray *beaconList = [beacons mutableCopy];
    
    DLog(@"Checking beacon list with %lu entries against %lu existing devices", [beaconList count], [self.devices count]);
    
    for (CWDevice *existingDevice in self.devices)
    {
        //Check if the device is still in the beacon list
        //If yes, update, if not, we consider the device disconnected
        BOOL deviceStillThere = NO;
        for (CLBeacon *beacon in beaconList)
        {
            if ([beacon.major isEqualToNumber:existingDevice.major] && [beacon.minor isEqualToNumber:existingDevice.minor])
            {
                //[existingDevice updateBeaconData:beacon];
                [self addOrUpdateDeviceWithBeaconData:beacon];
                [beaconList removeObject:beacon];
                deviceStillThere = YES;
            }
        }
        
        if (deviceStillThere == NO)
        {
            [self.devices removeObject:existingDevice];
        }
    }
    
    //All beacons still in the list must be new
    for (CLBeacon *newBeacon in beaconList)
    {
        [self addOrUpdateDeviceWithBeaconData:newBeacon]; //TODO change to add only, we know its not an update
    }
}


- (void)addOrUpdateDeviceWithBeaconData:(CLBeacon *)beaconData
{
    NSString *key = [self _keyForBeacon:beaconData];
    //CWDevice *existingDevice = self.devices[key];
    CWDevice *existingDevice;
    
    for (CWDevice *device in self.devices)
    {
        if ([device.major isEqualToNumber:beaconData.major] && [device.minor isEqualToNumber:beaconData.minor])
        {
            existingDevice = device;
            break;
        }
    }
    
    if (existingDevice == nil)
    {
        CWDevice *newDevice = [[CWDevice alloc] initWithBeaconData:beaconData];
        //self.devices[key] = newDevice;
        [self.devices addObject:newDevice];
        
        if ([self.delegate respondsToSelector:@selector(deviceUpdated:)])
        {
            [self.delegate deviceUpdated:newDevice];
        }
    }
    else
    {
        BOOL madeChanges = [existingDevice updateBeaconData:beaconData];
        
        if (madeChanges)
        {
            if ([self.delegate respondsToSelector:@selector(deviceUpdated:)])
            {
                [self.delegate deviceUpdated:existingDevice];
            }
        }
    }
}

- (NSString *)_keyForBeacon:(CLBeacon *)beacon
{
    return [NSString stringWithFormat:@"%@.%@", beacon.major, beacon.minor];
}

//
// TODO
//
// Move AdvertiserDelegate to here - give the ability to set the local device and inform the delegate
//

@end
