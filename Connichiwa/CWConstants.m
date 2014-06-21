//
//  CWConstants.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWConstants.h"



int const WEBSERVER_PORT = 8000;

NSString *const BLUETOOTH_SERVICE_UUID = @"AE11E524-2034-40F8-96D3-5E1028526348";
NSString *const BLUETOOTH_INITIAL_CHARACTERISTIC_UUID = @"22F445BE-F162-4F9B-804C-1636D7A24462";
NSString *const BLUETOOTH_IP_CHARACTERISTIC_UUID = @"8F627B80-B760-440C-880D-EFE99CFB6436";

int const DEFAULT_MEASURED_BLUETOOTH_POWER = -62;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.125;
double const RSSI_MOVING_AVERAGE_ALPHA = 0.03125;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.0225;
//double const RSSI_MOVING_AVERAGE_ALPHA = 0.015625;

#ifdef CWDEBUG
    NSJSONWritingOptions const JSON_WRITING_OPTIONS = NSJSONWritingPrettyPrinted;
#else
    NSJSONWritingOptions const JSON_WRITING_OPTIONS = kNilOptions;
#endif