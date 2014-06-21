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
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebApplication () <CWWebserverManagerDelegate>

/**
 *  The Connichiwa Webserver instance that runs our local webserver and communicates with the web library
 */
@property (readwrite, strong) CWWebserverManager *webserver;

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
    
    self.webserver = [[CWWebserverManager alloc] init];
    [self.webserver setDelegate:self];
    [self.webserver startWithDocumentRoot:documentRoot];
    
    //The webserver started - now show the master's view by opening 127.0.0.1, which will also load the Connichiwa Web Library on this device and initiate the local websocket connection
    //When the local websocket connection was established, the webserver will call the didEstablishWeblibWebsocketConnection callback
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", WEBSERVER_PORT]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    [self.localWebView loadRequest:localhostURLRequest];
    
    return self;
}


- (void)_startBeaconAdvertising
{
//    if (self.beaconAdvertiser != nil) return;
    
//    self.beaconAdvertiser = [[CWBeaconAdvertiser alloc] init];
//    [self.beaconAdvertiser setDelegate:self];
//    [self.beaconAdvertiser startAdvertising];
    
//    self.bluetoothPeripheral = [[CWBluetoothAdvertiser alloc] init];
//    [self.bluetoothPeripheral setDelegate:self];
//    [self.bluetoothPeripheral startAdvertising];
    
    [self.bluetoothManager startAdvertising];
//    [self.bluetoothManager startScanning];
    dispatch_async(dispatch_get_main_queue(), ^{
    [self performSelector:@selector(_startBeaconMonitoring) withObject:nil afterDelay:0.5];
    });
}


- (void)_startBeaconMonitoring
{
//    if (self.beaconMonitor != nil) return;
    
//    self.beaconMonitor = [[CWBeaconMonitor alloc] init];
//    [self.beaconMonitor setDelegate:self];
//    [self.beaconMonitor startMonitoring];
    
//    self.bluetoothCentral = [[CWBluetoothMonitor alloc] init];
//    [self.bluetoothCentral setDelegate:self];
//    [self.bluetoothCentral startSearching];
    
    [self.bluetoothManager startScanning];
}


#pragma mark CWWebserverDelegate


- (void)receivedConnectionRequest:(NSString *)deviceIdentifier
{
//    [self.bluetoothCentral handshakeWebsocketConnection:deviceIdentifier];
}


/**
 *  See [CWWebserverDelegate localWebsocketWasOpened]
 */
- (void)didEstablishWeblibWebsocketConnection
{
    [self _startBeaconAdvertising];
}


#pragma mark CWBluetoothAdvertiserDelegate


- (void)didStartAdvertisingWithIdentifier:(NSString *)identifier
{
    [self.webserver sendLocalIdentifier:identifier];
    [self _startBeaconMonitoring];
}


#pragma mark CWBluetoothMonitorDelegate


- (void)deviceDetectedWithIdentifier:(NSString *)identifier
{
    [self.webserver sendDetectedDeviceWithIdentifier:identifier];
}


- (void)deviceWithIdentifier:(NSString *)identifier changedDistance:(double)distance
{
    [self.webserver sendDeviceWithIdentifier:identifier changedDistance:distance];
}


- (void)deviceLostWithIdentifier:(NSString *)identifier
{
    [self.webserver sendLostDeviceWithIdentifier:identifier];
}

@end
