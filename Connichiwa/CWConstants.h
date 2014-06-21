//
//  CWConstants.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  The Port the local webserver is running on. The websocket server will run on this port + 1
 */
extern int const WEBSERVER_PORT;



/**
 *  The UUID used to advertise our Connichiwa BT Service.
 *  Must be the same on all devices.
 */
extern NSString *const BLUETOOTH_SERVICE_UUID;

/**
 *  The UUID used to advertise the Connichiwa BT Characteristic for the data transfer of initial device data from peripheral to central.
 *  Must be the same on all devices.
 */
extern NSString *const BLUETOOTH_INITIAL_CHARACTERISTIC_UUID;

/**
 *  The UUID used to advertise the Connichiwa BT Characteristic for the transfer of the network interface IPs from central to peripheral.
 *  Must be the same on all devices.
 */
extern NSString *const BLUETOOTH_IP_CHARACTERISTIC_UUID;



/**
 *  The default "measured power" assumes for BT transmitters. This is the RSSI of the transmitter at a distance of 1m
 */
extern int const DEFAULT_MEASURED_BLUETOOTH_POWER;

/**
 *  The α value used when calculating the moving average for the BT Connection RSSI.
 *  The higher this value, the faster changes to device distances will be adapted, but the more vulnerable the distance is to outlier
 */
extern double const RSSI_MOVING_AVERAGE_ALPHA;



/**
 *  The options used when creating JSON strings. In debug mode, we use a pretty representation, otherwise a shorter, less readable presentation
 */
extern NSJSONWritingOptions const JSON_WRITING_OPTIONS;

