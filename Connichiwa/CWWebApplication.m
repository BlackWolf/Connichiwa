//
//  CWWebApplication.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebApplication.h"
#import "CWWebserverManager.h"
#import "CWWebserverDelegate.h"
#import "CWBluetoothManager.h"
#import "CWBluetoothManagerDelegate.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebApplication () <CWWebserverManagerDelegate, CWBluetoothManagerDelegate>

/**
 *  The Connichiwa Webserver instance that runs our local webserver and communicates with the web library
 */
@property (readwrite, strong) CWWebserverManager *webserverManager;

@property (readwrite, strong) CWBluetoothManager *bluetoothManager;

/**
 *  The local UIWebView where the web application will be displayed on
 */
@property (readwrite, strong) UIWebView *localWebView;

/**
 *  Advises the CWBeaconAdvertiser to start advertising this device as a connichiwa beacon
 */
- (void)_startBeaconAdvertising;

/**
 *  Advises this device to start looking for other connichiwa devices around it
 */
- (void)_startBeaconMonitoring;

@end



@implementation CWWebApplication


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot onWebView:(UIWebView *)webView
{
    self = [super init];
    
    self.localWebView = webView;
    
    self.bluetoothManager = [[CWBluetoothManager alloc] init];
    [self.bluetoothManager setDelegate:self];
    
    //Initialize and start the webserver. When finished, it will call the managerDidStartWebserver: callback
    self.webserverManager = [[CWWebserverManager alloc] initWithDocumentRoot:documentRoot];
    [self.webserverManager setDelegate:self];
    [self.webserverManager startWebserver];
    
    return self;
}


#pragma mark CWWebserverDelegate


- (void)managerDidStartWebserver:(CWWebserverManager *)webserverManager
{
    [self.webserverManager loadWeblibOnWebView:self.localWebView withLocalIdentifier:self.bluetoothManager.identifier];
}


- (void)managerDidLoadWeblib:(CWWebserverManager *)webserverManager
{
    //Now that the weblib is loaded and can accept messages we can start monitor for other devices and advertising to other devices
    //BT events will be send to us by the CWBluetoothManager via callbacks and we can then forward important events to the weblib
    //For some reason, BT starts freaking out if we call startAdvertising and startScanning together, therefore we delay the scanning a little
    [self.bluetoothManager startAdvertising];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.bluetoothManager performSelector:@selector(startScanning) withObject:nil afterDelay:0.5];
    });
}

- (void)managerDidReceiveConnectionRequest:(NSString *)deviceIdentifier
{
    [self.bluetoothManager sendNetworkAddressesToDevice:deviceIdentifier];
}


#pragma mark CWBluetoothManagerDelegate

- (void)deviceDetected:(NSString *)identifier
{
    [self.webserverManager sendToWeblib_deviceDetected:identifier];
}


- (void)device:(NSString *)identifier changedDistance:(double)distance
{
    [self.webserverManager sendToWeblib_device:identifier changedDistance:distance];
}

@end
