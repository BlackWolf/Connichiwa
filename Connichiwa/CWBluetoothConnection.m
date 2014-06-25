//
//  CWBluetoothConnection.m
//  Connichiwa
//
//  Created by Mario Schreiner on 18/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothConnection.h"
#import "CWDebug.h"



/**
 *  The default "measured power" assumes for BT transmitters. This is the RSSI of the transmitter at a distance of 1m
 */
int const DEFAULT_MEASURED_BLUETOOTH_POWER = -62;

/**
 *  The α value used when calculating the moving average for the BT Connection RSSI.
 *  The higher this value, the faster changes to device distances will be adapted, but the more vulnerable the distance is to outlier
 */
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.125;
double const RSSI_MOVING_AVERAGE_ALPHA = 0.03125;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.0225;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.015625;



@interface CWBluetoothConnection ()

@property (readwrite, strong) CBPeripheral *peripheral;
@property (readwrite) double averageRSSI;
@property (readwrite) double lastSentRSSI;

/**
 *  The date where didSendDistance was called last, used to calculate the result of timeSinceLastSentRSSI
 */
@property (readwrite, strong) NSDate *lastSentRSSIDate;

@end



@implementation CWBluetoothConnection


@synthesize identifier = _identifier;


/**
 *  Should not be used, a CWBluetoothConnection without a CBPeripheral is invalid. Calling this method will raise an exception immediatly
 *
 *  @return nil
 */
- (instancetype)init
{
    [NSException raise:@"Bluetooth connection cannot be instantiated without a peripheral" format:@"Bluetooth connection cannot be instantiated without a peripheral. Use -initWithPeripheral: instead."];
    
    return nil;
}


- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
{
    self = [super init];
    
    self.state = CWBluetoothConnectionStateUnknown;
    self.peripheral = peripheral;
    self.averageRSSI = 0;
    
    self.measuredPower = DEFAULT_MEASURED_BLUETOOTH_POWER;
    
    self.pendingIPWrites = 0;
    
    return self;
}


- (void)addNewRSSIMeasure:(double)rssi
{
//    double oldRSSI = self.averageRSSI;
    
    //An RSSI value of 127 (0x7f) means the RSSI could not be read.
    //We sometimes get this value - it's nothing bad as long as it doesn't occur too often, just ignore it
    if (rssi == 127) return;
    
    //We use an exponential weighted moving average to compensate for outlier of the RSSI but still react quickly to heavy distance changes
    //Formula: (1-α)*oldAverage + α*newSample ; with α being the weighting factor of new samples (bigger α means new values are adapted more quickly, but the average is more vulnerable to outlier)
    if (self.averageRSSI == 0) self.averageRSSI = rssi;
    else self.averageRSSI = (1.0-RSSI_MOVING_AVERAGE_ALPHA) * self.averageRSSI + RSSI_MOVING_AVERAGE_ALPHA * rssi;
    
//    DLog(@"Added RSSI %.0f to average %.0f, equals new average %.0f (%.3f m)", rssi, oldRSSI, self.averageRSSI, self.averageDistance);
    
}


- (void)didSendDistance
{
    //Save the RSSI and date that was sent
    self.lastSentRSSI = self.averageRSSI;
    self.lastSentRSSIDate = [NSDate date];
}


- (NSTimeInterval)timeSinceLastSentRSSI
{
    if (self.lastSentRSSIDate == nil) return DBL_MAX;
    
    return [[NSDate date] timeIntervalSinceDate:self.lastSentRSSIDate];
}


- (double)averageDistance
{
    return [CWBluetoothConnection _distanceForMeasuredPower:self.measuredPower RSSI:self.averageRSSI];
}


- (double)lastSentDistance
{
    return [CWBluetoothConnection _distanceForMeasuredPower:self.measuredPower RSSI:self.lastSentRSSI];
}


- (BOOL)isReady
{
    //We consider the device ready when it finished receiving its initial data and didn't error
    return (self.state != CWBluetoothConnectionStateUnknown
            && self.state != CWBluetoothConnectionStateInitialConnecting
            && self.state != CWBluetoothConnectionStateInitialWaitingForData
            && self.state != CWBluetoothConnectionStateErrored);
}


#pragma mark Helper


/**
 *  Calculates the distance for a given RSSI and a given measured power. It then returns the distance in meters as a double. Please note that there are several algorithms that do this (the exact algorithm used by Apple in their iBeacon implementation is unknown) and that the result can vary HEAVILY. In a good environment, this can be quite accurate but if there are a lot for devices nearby, the distance between the two devices is large or there are obstacles between the two devices, this calculation can lead to very wrong results.
 *  The current algorithm is based on http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing/20434019#20434019
 *
 *  @param power The measured power for the device the RSSI belongs to
 *  @param RSSI  The RSSI that should be converted into a distance
 *
 *  @return The distance calculated based on the RSSI and measured power, in meters
 */
+ (double)_distanceForMeasuredPower:(int)power RSSI:(double)RSSI
{
    if (RSSI == 0.0)
    {
        return -1.0;
    }
    
    //Based on http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing/20434019#20434019
    double distance = -1;
    double ratio = RSSI*1.0/power;
    if (ratio < 1.0) distance = pow(ratio, 10);
    else             distance = (0.89976) * pow(ratio, 7.7095) + 0.111;
    
    //Taken from https://github.com/sandeepmistry/node-bleacon/blob/master/lib/bleacon.js
    //    double distance = pow(12.0, 1.5 * ((rssi / power) - 1));
    
    return distance;
}


#pragma mark Getter & Setter


- (NSString *)identifier
{
    return _identifier;
}


- (void)setIdentifier:(NSString *)identifier
{
    if ([identifier isEqualToString:_identifier]) return;
    
    if (_identifier != nil) [NSException raise:@"Identifier of BT Connection cannot be changed" format:@"The Identifier of a CWBluetoothConnection can be set only once."];
    
    _identifier = identifier;
}

@end
