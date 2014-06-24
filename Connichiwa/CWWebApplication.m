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

@property (readwrite, strong) NSString *identifier;

/**
 *  The Connichiwa Webserver instance that runs our local webserver and communicates with the web library
 */
@property (readwrite, strong) CWWebserverManager *webserverManager;

@property (readwrite, strong) CWBluetoothManager *bluetoothManager;

/**
 *  The local UIWebView where the web application will be displayed on
 */
@property (readwrite, strong) UIWebView *localWebView;

@property (readwrite) BOOL isRemote;
@property (readwrite) BOOL remoteConnectionRequestPending;
@property (readwrite, strong) NSMutableArray *remoteDevices;

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
    
    self.identifier = [[NSUUID UUID] UUIDString];
    
    self.localWebView = webView;
    
    self.isRemote = NO;
    self.remoteConnectionRequestPending = NO;
    self.remoteDevices = [NSMutableArray array];
    
    self.bluetoothManager = [[CWBluetoothManager alloc] init];
    [self.bluetoothManager setDelegate:self];
    
    //Initialize and start the webserver. When finished, it will call the managerDidStartWebserver: callback
    self.webserverManager = [[CWWebserverManager alloc] initWithDocumentRoot:documentRoot];
    [self.webserverManager setDelegate:self];
    [self.webserverManager startWebserver];
    
    return self;
}


#pragma mark CWWebApplicationState Protocol


- (BOOL)canBecomeRemote
{
    return (self.isRemote == NO && self.remoteConnectionRequestPending == NO && [self.remoteDevices count] == 0);
}


#pragma mark CWWebserverDelegate


- (void)didStartWebserver
{
    //Open 127.0.0.1, which will load the Connichiwa Web Library on this device and initiate the local websocket connection
    //The webserver will report back to us by calling didConnectToWeblib
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", WEBSERVER_PORT]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    [self.localWebView loadRequest:localhostURLRequest];
}


- (void)didConnectToWeblib
{
    //Weblib is ready to receive infos about detected devices, so let's start detecting and being detected
    //BT events will be send to us by the CWBluetoothManager via callbacks and we can then forward important events to the weblib
    [self.webserverManager sendToWeblib_localIdentifier:self.identifier];
    
    [self.bluetoothManager startAdvertising];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.bluetoothManager performSelector:@selector(startScanning) withObject:nil afterDelay:0.5]; //BT starts freaking out without a small delay, no idea why
    });
}

- (void)didReceiveConnectionRequest:(NSString *)deviceIdentifier
{
    if ([self.remoteDevices containsObject:deviceIdentifier])
    {
        [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
        return;
    }
    
    //
    // TODO we need to convert pending to an int, because we could send requests to multiple devices, and the first one that succeeds would set this to NO
    // TODO insert checks everywhere: when getting a connection request we need to check if we are no remote, if we didReceiveDeviceURL (and will become a remote) we need to make the final check if we canBecomeRemote etc.
    //
    //
    self.remoteConnectionRequestPending = YES;
    [self.bluetoothManager sendNetworkAddressesToDevice:deviceIdentifier];
}


- (void)didConnectToRemoteDevice:(NSString *)identifier
{
    self.remoteConnectionRequestPending = NO;
    [self.remoteDevices addObject:identifier];
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


- (void)didReceiveDeviceURL:(NSURL *)URL;
{
    self.isRemote = YES;
    
    //URL is in the form http://IP:PORT - we need to make it http://IP:PORT/remote/index.html?identifier=ID
    //This will make it retrieve the remote library of the other device and send our identifier to the other device's weblib
    NSURL *extendedURL = [URL URLByAppendingPathComponent:@"remote" isDirectory:YES];
    NSString *queryString = [NSString stringWithFormat:@"identifier=%@", self.identifier];
    NSString *finalURLString = [[NSString alloc] initWithFormat:@"%@index.html%@%@", [extendedURL absoluteString], [extendedURL query] ? @"&" : @"?", queryString];
    NSURL *finalURL = [NSURL URLWithString:finalURLString];
    
    NSURLRequest *URLRequest = [NSURLRequest requestWithURL:finalURL];
    [self.remoteWebView setHidden:NO];
    [self.remoteWebView loadRequest:URLRequest];
}


- (void)c:(NSString *)deviceIdentifier success:(BOOL)success
{
    //If we successfully transferred our IPs wait for the remote library to connect to us
    //If the transfer failed or the remote lib won't connect, we will report a connection failure
    if (success && [self.remoteDevices containsObject:deviceIdentifier] == NO)
    {
        [self performSelector:@selector(remoteDeviceConnectionTimeout:) withObject:deviceIdentifier afterDelay:10.0];
    }
    else
    {
        self.remoteConnectionRequestPending = NO;
        [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
    }
}


- (void)remoteDeviceConnectionTimeout:(NSString *)deviceIdentifier
{
    if ([self.remoteDevices containsObject:deviceIdentifier]) return;
    
    //Although we successfully sent our network address to the remote device, it did not connect to the weblib
    self.remoteConnectionRequestPending = NO;
    [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
}

@end
