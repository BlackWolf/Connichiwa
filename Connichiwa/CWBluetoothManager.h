//
//  CWBluetoothManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <UIKit/UIKit.h>
#import "CWBluetoothManagerDelegate.h"
#import "CWWebApplicationState.h"



/**
 *  The CWBluetoothManager represents this device as a BT device. It can advertise this device to other devices and monitor for other devices. Furthermore, the delegate
 *  is notified of important events, for example detected devices, changes in device distance or established connections.
 *
 *  There are two major features when it comes to communicating with other BT devices: The initial data transfer and the IP data transfer.
 *
 *  The initial data transfer is used to receive information about another device - most importantly this includes the other device's unique identifier (which is different from the BT identifier, as the BT identifier is NOT unique). The device's unique identifier can be used to identify the device across all Connichiwa components - this means the identifier will also be sent to the web library and web application. As every remote device needs to have an identifier, the initial data transfer is invoked automatically by this manager when a new device is detected. There is no manual way to trigger the transfer and there is no way to prevent it. Once the initial data of a device was received, the device is reported to the delegate via [CWBluetoothManagerDelegate deviceDetected:].
 *  Technically, the initial data transfer is invoked by our central subscribing to the other device's peripheral's initial BT characteristic. The other device will take a subscription to that characteristic as a request for the initial data and begin the data transfer. Therefore, the initial data transfer is a peripheral->central data transfer. Once the initial data transfer is complete, the BT connection to the device will be cut.
 *
 *  The IP data transfer is not triggered automatically, but can be triggered by calling the sendNetworkAddressesToDevice: method. This will trigger a connect to the other device and we  will then transfer our network interface addresses to the other device - one of those should work to connect to our local webserver, but it is the responsibility of the other device to figure our the correct address and actually connect to it. Once the other device received the addresses, it will find the correct one and report it on the other device via [CWBluetoothManagerDelegate didReceiveDeviceURL:]. Connecting to that IP on the other device will allow us to use that device as a remote device.
 *  Technically, this is achieved by our central subscribing to the other device's peripheral's IP BT characteristic. The IP characteristic is writeable and therefore allows us to send our network interface addresses to the other device. All other data sent will be ignored.
 */
@interface CWBluetoothManager : NSObject

/**
 *  The delegate that receives events by this class
 */
@property (readwrite) id<CWBluetoothManagerDelegate> delegate;

/**
 *  Determines if the device is currently scanning for other BT devices
 */
@property (readonly) BOOL isScanning;

/**
 *  Intializes a new CWBluetoothManager
 *
 *  @param appState A CWWebApplicationState implementation that allows the BT Manager to access the global state
 *
 *  @return A new instance of CWBluetoothManager
 */
- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState;

/**
 *  Starts scanning for other, nearby devices
 */
- (void)startScanning;

/**
 *  Starts advertising this device with the unique identifier stored in the application state. Will make this device detectable by other BT devices.
 */
- (void)startAdvertising;

/**
 *  Stops scanning for other devices
 */
- (void)stopScanning;

/**
 *  Stops advertising this device
 */
- (void)stopAdvertising;

/**
 *  Determines if the device is currently advertising itself to other BT devices
 *
 *  @return true if the device is currently advertising over BT, otherwise false
 */
- (BOOL)isAdvertising;

/**
 *  Tells the BTManager to send our network interface addresses to the device with the given identifier. The manager will then try to establish a BT connection to that device and transfer the network addresses. This is effectively a request to use the given device as a remote device.
 *
 *  @param deviceIdentifier The identifier of the other device
 */
- (void)sendNetworkAddressesToDevice:(NSString *)deviceIdentifier;

@end
