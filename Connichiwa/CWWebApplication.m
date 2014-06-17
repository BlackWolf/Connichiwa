//
//  CWWebApplication.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebApplication.h"
#import "CWWebserver.h"
#import "CWBeaconMonitor.h"
#import "CWBeaconMonitorDelegate.h"
#import "CWBeaconAdvertiser.h"
#import "CWBeaconAdvertiseDelegate.h"
#import "CWWebserverDelegate.h"
#import "CWBluetoothMonitor.h"
#import "CWBluetoothMonitorDelegate.h"
#import "CWBluetoothAdvertiser.h"
#import "CWBluetoothAdvertiserDelegate.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebApplication () <CWWebserverDelegate, CWBeaconAdvertiserDelegate, CWBeaconMonitorDelegate, CWBluetoothAdvertiserDelegate, CWBluetoothMonitorDelegate>

/**
 *  The Connichiwa Webserver instance that runs our local webserver and communicates with the web library
 */
@property (readwrite, strong) CWWebserver *webserver;

/**
 *  The CWBeaconAdvertiser instance that makes this device discoverable over iBeacon
 */
@property (readwrite, strong) CWBeaconAdvertiser *beaconAdvertiser;

/**
 *  The CWBeaconMonitor instance that looks for other Connichiwa devices
 */
@property (readwrite, strong) CWBeaconMonitor *beaconMonitor;

@property (readwrite, strong) CWBluetoothMonitor *bluetoothCentral;

@property (readwrite, strong) CWBluetoothAdvertiser *bluetoothPeripheral;

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
    
    self.webserver = [[CWWebserver alloc] init];
    [self.webserver setDelegate:self];
    [self.webserver startWithDocumentRoot:documentRoot];
    
    //The webserver started - now show the master's view by opening 127.0.0.1, which will also load the Connichiwa Web Library on this device and initiate the local websocket connection
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", WEBSERVER_PORT]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    
    [self.localWebView loadRequest:localhostURLRequest];
    
    return self;
}


- (void)_startBeaconAdvertising
{
    if (self.beaconAdvertiser != nil) return;
    
//    self.beaconAdvertiser = [[CWBeaconAdvertiser alloc] init];
//    [self.beaconAdvertiser setDelegate:self];
//    [self.beaconAdvertiser startAdvertising];
    
    self.bluetoothPeripheral = [[CWBluetoothAdvertiser alloc] init];
    [self.bluetoothPeripheral setDelegate:self];
    [self.bluetoothPeripheral startAdvertising];
}


- (void)_startBeaconMonitoring
{
    if (self.beaconMonitor != nil) return;
    
//    self.beaconMonitor = [[CWBeaconMonitor alloc] init];
//    [self.beaconMonitor setDelegate:self];
//    [self.beaconMonitor startMonitoring];
    
    self.bluetoothCentral = [[CWBluetoothMonitor alloc] init];
    [self.bluetoothCentral setDelegate:self];
    [self.bluetoothCentral startSearching];
}


#pragma mark CWWebserverDelegate


/**
 *  See [CWWebserverDelegate localWebsocketWasOpened]
 */
- (void)localWebsocketWasOpened
{
    [self _startBeaconAdvertising];
}


#pragma mark CWBeaconAdvertiserDelegate


/**
 *  See [CWBeaconAdvertiserDelegate didStartAdvertisingWithID:]
 *
 *  @param ID See [CWBeaconAdvertiserDelegate didStartAdvertisingWithID:]
 */
- (void)didStartAdvertisingWithID:(CWDeviceID *)ID
{
    [self.webserver sendLocalID:ID];
    [self _startBeaconMonitoring];
}


#pragma mark CWBeaconMonitorDelegate


/**
 *  See [CWBeaconMonitorDelegate beaconDetectedWithID:inProximity:]
 *
 *  @param ID        See [CWBeaconMonitorDelegate beaconDetectedWithID:inProximity:]
 *  @param proximity See [CWBeaconMonitorDelegate beaconDetectedWithID:inProximity:]
 */
- (void)beaconDetectedWithID:(CWDeviceID *)ID inProximity:(NSString *)proximity
{
    [self.webserver sendNewBeaconWithID:ID inProximity:proximity];
}


/**
 *  See [CWBeaconMonitorDelegate beaconDetectedWithID:inProximity:]
 *
 *  @param ID        See [CWBeaconMonitorDelegate beaconDetectedWithID:inProximity:]
 *  @param proximity See [CWBeaconMonitorDelegate beaconDetectedWithID:inProximity:]
 */
- (void)beaconWithID:(CWDeviceID *)ID changedProximity:(NSString *)proximity
{
    [self.webserver sendBeaconWithID:ID newProximity:proximity];
}


/**
 *  See [CWBeaconMonitorDelegate beaconLostWithID:]
 *
 *  @param ID See [CWBeaconMonitorDelegate beaconLostWithID:]
 */
- (void)beaconLostWithID:(CWDeviceID *)ID
{
    [self.webserver sendLostBeaconWithID:ID];
}

@end
