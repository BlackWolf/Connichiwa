//
//  CWBluetoothConnection.m
//  Connichiwa
//
//  Created by Mario Schreiner on 18/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothConnection.h"
#import "CWDebug.h"



//double const RSSI_MOVING_AVERAGE_ALPHA = 0.125;
double const RSSI_MOVING_AVERAGE_ALPHA = 0.03125;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.0225;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.015625;




@interface CWBluetoothConnection ()

@property (readwrite, strong) CBPeripheral *peripheral;
@property (readwrite) double averageRSSI;
@property (readwrite) double savedRSSI;
@property (readwrite, strong) NSDate *savedRSSIDate;

@end



@implementation CWBluetoothConnection


@synthesize identifier = _identifier;


- (instancetype)init
{
    [NSException raise:@"Bluetooth connection cannot be instantiated without a peripheral" format:@"Bluetooth connection cannot be instantiated without a peripheral. Use -initWithPeripheral: instead."];
    
    return nil;
}


- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
{
    self = [super init];
    
    self.state = CWBluetoothConnectionStateDiscovered;
    self.peripheral = peripheral;
    self.averageRSSI = 0;
    
    return self;
}


- (void)addNewRSSIMeasure:(double)rssi
{
//    DLog(@"Adding RSSI %f with current average %f", rssi, self.averageRSSI);
    
    //An RSSI value of 127 (0x7f) means the RSSI could not be read.
    //We sometimes get this value - it's nothing bad as long as it doesn't occur too often, just ignore it
    if (rssi == 127) return;
    
    //We use an exponential weighted moving average to compensate for outlier of the RSSI but still react quickly to heavy distance changes
    //Formula: (1-α)*oldAverage + α*newSample ; with α being the weighting factor of new samples (bigger α means new values are adapted more quickly, but the average is more vulnerable to outlier)
    if (self.averageRSSI == 0) self.averageRSSI = rssi;
    else self.averageRSSI = (1.0-RSSI_MOVING_AVERAGE_ALPHA) * self.averageRSSI + RSSI_MOVING_AVERAGE_ALPHA * rssi;
    
}


- (void)saveCurrentRSSI
{
    self.savedRSSI = self.averageRSSI;
    self.savedRSSIDate = [NSDate date];
}


- (NSTimeInterval)timeSinceRSSISave
{
    if (self.savedRSSIDate == nil) return DBL_MAX;
    
    return [[NSDate date] timeIntervalSinceDate:self.savedRSSIDate];
}


- (BOOL)isReady
{
    return (self.state != CWBluetoothConnectionStateDiscovered && self.state != CWBluetoothConnectionStateErrored);
}


#pragma mark Getter & Setter


- (NSString *)identifier
{
    return _identifier;
}


- (void)setIdentifier:(NSString *)identifier
{
    //TODO do this?
    //if (_identifier != nil) [NSException raise:@"Identifier of BT Connection cannot be changed" format:@"The Identifier of a CWBluetoothConnection can be set only once."];
    
    _identifier = identifier;
}

@end
