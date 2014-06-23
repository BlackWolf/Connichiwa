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


- (void)didReceiveDeviceURL:(NSURL *)URL;
{
    NSURL *extendedURL = [URL URLByAppendingPathComponent:@"remote" isDirectory:YES];
    NSString *queryString = [NSString stringWithFormat:@"identifier=%@", self.bluetoothManager.identifier];
    NSString *finalURLString = [[NSString alloc] initWithFormat:@"%@index.html%@%@", [extendedURL absoluteString], [extendedURL query] ? @"&" : @"?", queryString];
    NSURL *finalURL = [NSURL URLWithString:finalURLString];
    
    NSURLRequest *URLRequest = [NSURLRequest requestWithURL:finalURL];
    [self.remoteWebView setHidden:NO];
    [self.remoteWebView loadRequest:URLRequest];
}


- (void)didSendNetworkAddresses:(NSString *)deviceIdentifier success:(BOOL)success
{
    if (success)
    {
        [self performSelector:@selector(remoteDeviceConnectionTimeout:) withObject:deviceIdentifier afterDelay:10.0];
    }
    else
    {
        [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
    }
}


- (void)remoteDeviceConnectionTimeout:(NSString *)deviceIdentifier
{
    //TODO check if the device is connected, if not:
    
    //Although we successfully sent our network address to the remote device, it did not connect to the weblib
    //We consider the connection attempt a failure
    [self.webserverManager sendToWeblib_connectionRequestFailed:deviceIdentifier];
}


- (void)didReceiveNetworkAddresses:(NSArray *)ips
{
    //TODO dispatch this
    
    //Wohoo, we recieved some IPs. So another device wants to use us, huh?
    //Figure out an IP that works and open that IP in a webview
//    for (NSString *ip in ips)
//    {
//        NSHTTPURLResponse *response = nil;
//        NSError *error = nil;
//        
//        NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://%@:%d/check", ip, WEBSERVER_PORT]];
//        NSMutableURLRequest *request = [NSMutableURLRequest
//                                        requestWithURL:url
//                                        cachePolicy:NSURLRequestReloadIgnoringLocalAndRemoteCacheData
//                                        timeoutInterval:5.0];
//        [request setHTTPMethod:@"HEAD"];
//        
//        DLog(@"Checking URL %@", url);
//        [NSURLConnection sendSynchronousRequest:request returningResponse:&response error:&error];
//        if ([response statusCode] == 200)
//        {
//            //We found the correct IP!
//            DLog(@"Found working URL: %@", url);
//            if (self.remoteWebView != nil)
//            {
//                NSURL *realURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://%@:%d", ip, WEBSERVER_PORT]];
//                NSURLRequest *realURLRequest = [NSURLRequest requestWithURL:realURL];
//                [self.remoteWebView setHidden:NO];
//                [self.remoteWebView loadRequest:realURLRequest];
//            }
//        }
//    }
}

@end
