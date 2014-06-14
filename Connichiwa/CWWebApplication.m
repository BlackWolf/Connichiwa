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
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebApplication () <CWWebserverDelegate, CWBeaconAdvertiserDelegate, CWBeaconMonitorDelegate>

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
    
    self.beaconAdvertiser = [[CWBeaconAdvertiser alloc] init];
    [self.beaconAdvertiser setDelegate:self];
    [self.beaconAdvertiser startAdvertising];
}


- (void)_startBeaconMonitoring
{
    if (self.beaconMonitor != nil) return;
    
    self.beaconMonitor = [[CWBeaconMonitor alloc] init];
    [self.beaconMonitor setDelegate:self];
    [self.beaconMonitor startMonitoring];
}


#pragma mark CWWebserverDelegate


- (void)localWebsocketWasOpened
{
    [self _startBeaconAdvertising];
}


#pragma mark CWBeaconAdvertiserDelegate


- (void)didStartAdvertisingWithID:(CWDeviceID *)ID
{
    [self.webserver sendLocalID:ID];
    [self _startBeaconMonitoring];
}


#pragma mark CWBeaconMonitorDelegate


- (void)beaconDetectedWithID:(CWDeviceID *)ID inProximity:(NSString *)proximity
{
    [self.webserver sendNewBeaconWithID:ID inProximity:proximity];
}


- (void)beaconWithID:(CWDeviceID *)ID changedProximity:(NSString *)proximity
{
    [self.webserver sendBeaconWithID:ID newProximity:proximity];
}


- (void)beaconLostWithID:(CWDeviceID *)ID
{
    [self.webserver sendLostBeaconWithID:ID];
}

@end
