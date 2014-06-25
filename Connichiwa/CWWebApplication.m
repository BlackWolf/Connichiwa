//
//  CWWebApplication.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebApplication.h"
#import "CWWebserverManager.h"
#import "CWWebserverManagerDelegate.h"
#import "CWBluetoothManager.h"
#import "CWBluetoothManagerDelegate.h"
#import "CWWebApplicationState.h"
#import "CWDebug.h"



int const DEFAULT_WEBSERVER_PORT = 8000;
double const REMOTE_WEBSOCKET_CONNECT_TIMEOUT = 5.0;



@interface CWWebApplication () <CWWebserverManagerDelegate, CWBluetoothManagerDelegate, CWWebApplicationState>

/**
 *  The unique identifier of this device that is used amongst all the different parts of Connichiwa
 */
@property (readwrite, strong) NSString *identifier;

/**
 *  The port the webserver will run on
 */
@property (readwrite) int webserverPort;

/**
 *  The main instance of CWWebserverManager. Runs the local webserver and forwards and receives messages from the web library
 */
@property (readwrite, strong) CWWebserverManager *webserverManager;

/**
 *  The main instance of CWBluetoothManager. Advertises this device via BT, looks for other BT devices and allows for data exchange with other BT devices.
 */
@property (readwrite, strong) CWBluetoothManager *bluetoothManager;

/**
 *  The local UIWebView where the web application will be displayed on
 */
@property (readwrite, strong) UIWebView *localWebView;

/**
 *  Determines if this device is currently running as a remote device for another Connichiwa device.
 */
@property (readwrite) BOOL isRemote;

/**
 *  Contains a list of of devices that we currently try to connect to in order to use them as remote devices. Each entry is a device identifier.
 */
@property (readwrite) NSMutableArray *pendingRemoteDevices;

/**
 *  Contains a list of devices that are currently used as remote devices. Each entry is a device identifier.
 */
@property (readwrite, strong) NSMutableArray *remoteDevices;

@end



@implementation CWWebApplication


/**
 *  Initializes a new CWWebApplication instance. It is not advised to have multiple CWWebApplication instances at the same time
 *
 *  @return A new instance of CWWebApplication
 */
- (instancetype)init
{
    self = [super init];
    
    self.identifier = [[NSUUID UUID] UUIDString];
    
    self.isRemote = NO;
    self.pendingRemoteDevices = [NSMutableArray array];
    self.remoteDevices = [NSMutableArray array];
    
    self.bluetoothManager = [[CWBluetoothManager alloc] initWithApplicationState:self];
    [self.bluetoothManager setDelegate:self];
    
    return self;
}


- (void)launchWithDocumentRoot:(NSString *)documentRoot onWebview:(UIWebView *)webView port:(int)port
{
    self.localWebView = webView;
    self.webserverPort = port;
    
    self.webserverManager = [[CWWebserverManager alloc] initWithDocumentRoot:documentRoot];
    [self.webserverManager setDelegate:self];
    [self.webserverManager startWebserverOnPort:port];
}


- (void)launchWithDocumentRoot:(NSString *)documentRoot onWebview:(UIWebView *)webView;
{
    [self launchWithDocumentRoot:documentRoot onWebview:webView port:DEFAULT_WEBSERVER_PORT];
}


#pragma mark CWWebApplicationState Protocol


/**
 *  See [CWWebApplicationState canBecomeRemote]
 *
 *  @return See [CWWebApplicationState canBecomeRemote]
 */
- (BOOL)canBecomeRemote
{
    return (self.isRemote == NO && [self.pendingRemoteDevices count] == 0 && [self.remoteDevices count] == 0);
}


#pragma mark CWWebserverManagerDelegate


/**
 *  See [CWWebserverManagerDelegate didStartWebserver]
 */
- (void)didStartWebserver
{
    //Open 127.0.0.1, which will load the Connichiwa Web Library on this device and initiate the local websocket connection
    //The webserver will report back to us by calling didConnectToWeblib
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", self.webserverPort]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    [self.localWebView loadRequest:localhostURLRequest];
}


/**
 *  See [CWWebserverManagerDelegate didConnectToWeblib]
 */
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


/**
 *  See [CWWebserverManagerDelegate didReceiveConnectionRequest:]
 *
 *  @param deviceIdentifier See [CWWebserverManagerDelegate didReceiveConnectionRequest:]
 */
- (void)didReceiveConnectionRequest:(NSString *)deviceIdentifier
{
    if ([self.pendingRemoteDevices containsObject:deviceIdentifier]) return;
    
    if (self.isRemote == YES || [self.remoteDevices containsObject:deviceIdentifier])
    {
        [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
        return;
    }
    
    [self.pendingRemoteDevices addObject:deviceIdentifier];
    [self.bluetoothManager sendNetworkAddressesToDevice:deviceIdentifier];
}


/**
 *  See [CWWebserverManagerDelegate didConnectToRemoteDevice:]
 *
 *  @param identifier See [CWWebserverManagerDelegate didConnectToRemoteDevice:]
 */
- (void)didConnectToRemoteDevice:(NSString *)identifier
{
    [self.pendingRemoteDevices removeObject:identifier];
    [self.remoteDevices addObject:identifier];
}


#pragma mark CWBluetoothManagerDelegate


/**
 *  See [CWBluetoothManagerDelegate deviceDetected:]
 *
 *  @param identifier See [CWBluetoothManagerDelegate deviceDetected:]
 */
- (void)deviceDetected:(NSString *)identifier
{
    [self.webserverManager sendToWeblib_deviceDetected:identifier];
}


/**
 *  See [CWBluetoothManagerDelegate device:changedDistance:]
 *
 *  @param identifier See [CWBluetoothManagerDelegate device:changedDistance:]
 *  @param distance   See [CWBluetoothManagerDelegate device:changedDistance:]
 */
- (void)device:(NSString *)identifier changedDistance:(double)distance
{
    [self.webserverManager sendToWeblib_device:identifier changedDistance:distance];
}


/**
 *  See [CWBluetoothManagerDelegate didReceiveDeviceURL:]
 *
 *  @param URL See [CWBluetoothManagerDelegate didReceiveDeviceURL:]
 */
- (void)didReceiveDeviceURL:(NSURL *)URL;
{
    if ([self canBecomeRemote] == NO) return;
        
    //This is it, the moment we have all been waiting for: Switching to remote state!
    self.isRemote = YES;
    DLog(@"!! SWITCHING INTO REMOTE STATE");
    
    //URL is in the form http://IP:PORT - we need to make it http://IP:PORT/remote/index.html?identifier=ID
    //This will make it retrieve the remote library of the other device and send our identifier to the other device's weblib
    NSURL *extendedURL = [URL URLByAppendingPathComponent:@"remote" isDirectory:YES];
    NSString *queryString = [NSString stringWithFormat:@"identifier=%@", self.identifier];
    NSString *finalURLString = [[NSString alloc] initWithFormat:@"%@index.html%@%@", [extendedURL absoluteString], [extendedURL query] ? @"&" : @"?", queryString];
    NSURL *finalURL = [NSURL URLWithString:finalURLString];
    
    NSURLRequest *URLRequest = [NSURLRequest requestWithURL:finalURL];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.remoteWebView setHidden:NO];
        [self.remoteWebView loadRequest:URLRequest];
    });
}


/**
 *  See [CWBluetoothManagerDelegate didSendNetworkAddresses:success:]
 *
 *  @param deviceIdentifier See [CWBluetoothManagerDelegate didSendNetworkAddresses:success:]
 *  @param success          See [CWBluetoothManagerDelegate didSendNetworkAddresses:success:]
 */
- (void)didSendNetworkAddresses:(NSString *)deviceIdentifier success:(BOOL)success
{
    //If we successfully transferred our IPs wait for the remote library to connect to us
    //If the transfer failed or the remote lib won't connect, we will report a connection failure
    if (success && [self.remoteDevices containsObject:deviceIdentifier] == NO)
    {
        [self performSelector:@selector(remoteDeviceConnectionTimeout:) withObject:deviceIdentifier afterDelay:REMOTE_WEBSOCKET_CONNECT_TIMEOUT];
    }
    else
    {
        [self.pendingRemoteDevices removeObject:deviceIdentifier];
        [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
    }
}


#pragma mark Timers


/**
 *  Called when the timer that waits for a remote device to connect via websocket expires. If the device did not establish a websocket connection by the time this is called, it usually means something went wrong and we can consider the device connection as a failure.
 *
 *  @param deviceIdentifier The identifier of the device where the timer expires
 */
- (void)remoteDeviceConnectionTimeout:(NSString *)deviceIdentifier
{
    if ([self.remoteDevices containsObject:deviceIdentifier]) return;
    
    [self.pendingRemoteDevices removeObject:deviceIdentifier];
    [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
}

@end
