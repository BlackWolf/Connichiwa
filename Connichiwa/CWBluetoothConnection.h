//
//  CWBluetoothConnection.h
//  Connichiwa
//
//  Created by Mario Schreiner on 18/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
@class CBPeripheral, CWDeviceID;



typedef NS_ENUM(NSInteger, CWBluetoothConnectionInitialDataState)
{
    CWBluetoothConnectionInitialDataStateMissing,
    CWBluetoothConnectionInitialDataStateConnecting,
    CWBluetoothConnectionInitialDataStateConnected,
    CWBluetoothConnectionInitialDataStateReceived
};

typedef NS_ENUM(NSInteger, CWBluetoothConnectionIPWriteState)
{
    CWBluetoothConnectionIPWriteStateDisconnected,
    CWBluetoothConnectionIPWriteStateConnecting,
    CWBluetoothConnectionIPWriteStateConnected,
    CWBluetoothConnectionIPWriteStateSent
};



/**
 *  Each instance of this class is a data container for the bluetooth-related data of a connection to another device. "Connection" does not necessarily mean a fully established connection in this case. An instance of CWBluetoothConnection can also represent a device that has been detected nearby but no connection is established, or a device that has been seen previously but that was lost. Besides that, this class stores the state of the connection to another device, its received initial data, can receive new RSSI measurements for the device or keep track of send and received data.
 */
@interface CWBluetoothConnection : NSObject

@property (readwrite) CWBluetoothConnectionInitialDataState initialDataState;

@property (readwrite) CWBluetoothConnectionIPWriteState IPWriteState;

@property (readwrite) BOOL didError;

/**
 *  The unique Connichiwa identifier of the other device
 */
@property (readwrite, strong) NSString *identifier;

@property (readwrite, strong) NSString *name;

/**
 *  The measured power of the other device's BT transmitter, used to calculate the distance to the other device
 */
@property (readwrite) int measuredPower;

/**
 *  The CBPeripheral instance associated with the device represented by this connection
 */
@property (readonly) CBPeripheral *peripheral;

/**
 *  Saves the date this device was last seen via Bluetooth
 */
@property (readonly) NSDate *lastSeen;

/**
 *  The current average RSSI, results in a number of algorithms applied to RSSI measurements in order to compensate for outliers and jitter
 */
@property (readonly) double averageRSSI;

/**
 *  The average RSSI at the point were didSendDistance was last called
 */
@property (readonly) double lastSentRSSI;

@property (readwrite) int connectionTries;

/**
 *  Initializes a new CWBluetoothConnection for the given CBPeripheral. For each CBPeripheral, and therefore for each discovered device, only one CWBluetoothConnection should be created
 *
 *  @param peripheral The CBPeriphal that represents this device in the BT environment
 *
 *  @return A new CWBluetoothConnection instance
 */
- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral;

/**
 *  Adds a new RSSI measurement to this device's RSSI. Using different algorithms, outlier RSSI's or jittering is reduce, the results of this algorithms can be found by retrieving averageRSSI from this class. Note that the original RSSI measurements can not be restored.
 *
 *  @param rssi The measured RSSI for the device
 */
- (void)addNewRSSIMeasure:(double)rssi;

/**
 *  Should be called every time the device is detected via Bluetooth, remembers when the device was last seen
 */
- (void)updateLastSeen;

/**
 *  This should be called after the distance of this device was send to other Connichiwa components. It will save the current time and the current averageRSSI and make them available via lastSentRSSI and timeSinceLastSentRSSI. This can be used to determine the time passed or the RSSI change since the last RSSI send.
 */
- (void)didSendDistance;

/**
 *  The amount of time that elapsed since the last time didSendDistance was called
 *
 *  @return A time interval in seconds
 */
- (NSTimeInterval)timeSinceLastSentRSSI;

/**
 *  The averageRSSI transformed into a distance
 *
 *  @return The distance of the device according to averageRSSI, in meters
 */
- (double)averageDistance;

/**
 *  The lastSentRSSI transformed into a distance
 *
 *  @return The distance of the device when the RSSI was last sent, in meters
 */
- (double)lastSentDistance;

/**
 *  Determines if the device is ready to be used by other Connichiwa components
 *
 *  @return YES if the device can be used by other Connichiwa components, otherwise NO
 */
- (BOOL)isReady;

@end
