//
//  CWBluetoothManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  A delegate protocol that receives different events from the CWBluetoothManager instance
 */
@protocol CWBluetoothManagerDelegate <NSObject>

@optional

/**
 *  Called when the manager successfully started scanning for other BT devices
 */
- (void)didStartScanning;

/**
 *  Called when the manager successfully started advertising this device to other BT device with the given identifier
 *
 *  @param identifier The identifier under wich we are advertised to other devices
 */
- (void)didStartAdvertisingWithIdentifier:(NSString *)identifier;

/**
 *  Called when a new device was detected
 *
 *  @param identifier The identifier of the newly detected device
 */
- (void)deviceDetected:(NSString *)identifier information:(NSDictionary *)deviceInfo;

/**
 *  Called when the distance of a previously detected device changed
 *
 *  @param identifier The identifier of the changed device
 *  @param distance   The new distance of the device in meters
 */
- (void)device:(NSString *)identifier changedDistance:(double)distance;

/**
 *  Called when a previously detected device was lost
 *
 *  @param identifier The identifier of the lost device
 */
- (void)deviceLost:(NSString *)identifier;

/**
 *  Called when we received an URL that points to another Connichiwa web application
 *
 *  @param URL The URL of the remote Connichiwa web application
 */
- (void)didReceiveDeviceURL:(NSURL *)URL;

/**
 *  Called when we finished sending our network interface addresses to another device in order to use it as a remote device. 
 *
 *  @param deviceIdentifier The identifier of the device that received the addresses
 *  @param success          YES if the device reported a success for at least one of the addresses, NO if none of the addresses were accepted by the remote device
 */
- (void)didSendNetworkAddresses:(NSString *)deviceIdentifier success:(BOOL)success;

@end
