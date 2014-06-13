//
//  CWWebApplication.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebApplication.h"
#import "CWWebserver.h"
#import "CWDeviceManager.h"
#import "CWDeviceManagerDelegate.h"
#import "CWBeaconMonitor.h"
#import "CWBeaconAdvertiser.h"
#import "CWBeaconAdvertiseDelegate.h"
#import "CWWebserverDelegate.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebApplication () <CWWebserverDelegate, CWBeaconAdvertiserDelegate, CWDeviceManagerDelegate>

/**
 *  The Connichiwa Webserver instance that runs our local webserver and communicates with the web library
 */
@property (readwrite, strong) CWWebserver *webserver;

@property (readwrite, strong) CWDeviceManager *deviceManager;

/**
 *  The CWBeaconAdvertiser instance that makes this device discoverable over iBeacon
 */
@property (readwrite, strong) CWBeaconAdvertiser *beaconAdvertiser;

/**
 *  The CWBeaconMonitor instance that looks for other Connichiwa devices
 */
@property (readwrite, strong) CWBeaconMonitor *beaconMonitor;

/**
 *  The local UIWebView where the web application will be displayed on
 */
@property (readwrite, strong) UIWebView *localWebView;

@end



@implementation CWWebApplication


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot onWebView:(UIWebView *)webView
{
    self = [super init];
    
    self.localWebView = webView;
    
    self.webserver = [CWWebserver sharedServer];
    [self.webserver setDelegate:self];
    
    self.deviceManager = [CWDeviceManager sharedManager];
    [self.deviceManager setDelegate:self];
    
    [self.webserver startWithDocumentRoot:documentRoot];
    
    //The webserver started - now show the master's view by opening 127.0.0.1, which will also load the Connichiwa Web Library on this device and initiate the local websocket connection
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", WEBSERVER_PORT]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    
    [self.localWebView loadRequest:localhostURLRequest];
    
    return self;
}


- (void)_startBeaconAdvertising
{
    self.beaconAdvertiser = [CWBeaconAdvertiser mainAdvertiser];
    [self.beaconAdvertiser setDelegate:self];
    [self.beaconAdvertiser startAdvertising];
}


- (void)_startBeaconMonitoring
{
    //Start up iBeacon: Advertise this device and start looking for other devices
    self.beaconMonitor = [CWBeaconMonitor mainMonitor];
    [self.beaconMonitor startMonitoring];
}


#pragma mark CWWebserverDelegate


- (void)localWebsocketWasOpened
{
    [self _startBeaconAdvertising];
}


#pragma mark CWBeaconAdvertiserDelegate


- (void)didStartAdvertising:(CWBeacon *)localBeacon
{
    [self.webserver sendLocalInfo:localBeacon];
    [self _startBeaconMonitoring];
}


#pragma mark CWDeviceManagerDelegate


/**
 *  See [CWBeaconMonitorDelegate beaconUpdated:]
 *
 * @param beacon See [CWBeaconMonitorDelegate beaconUpdated:]
 */
- (void)deviceUpdated:(CWDevice *)device
{
    [self.webserver sendDeviceInfo:device];
    //[self.webserver sendBeaconInfo:beacon];
}

@end
