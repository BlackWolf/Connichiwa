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
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebApplication () <CWBeaconMonitorDelegate>

@property (readwrite, strong) CWWebserver *webserver;
@property (readwrite, strong) CWBeaconMonitor *beaconMonitor;
@property (readwrite, strong) UIWebView *localWebView;

@end



@implementation CWWebApplication


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot onWebView:(UIWebView *)webView
{
    self = [super init];
    
    self.documentRoot = documentRoot;
    self.localWebView = webView;
    
    self.webserver = [CWWebserver sharedServer];
    [self.webserver startWithDocumentRoot:self.documentRoot];
    
    //The webserver started - now show the master's view by opening 127.0.0.1, which will also load the Connichiwa Web Library on this device
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", WEBSERVER_PORT]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    
    [self.localWebView loadRequest:localhostURLRequest];
    
    [[CWBeaconAdvertiser mainBeacon] startAdvertising];
    self.beaconMonitor = [CWBeaconMonitor mainMonitor];
    [self.beaconMonitor setDelegate:self];
    [self.beaconMonitor startMonitoring];
    
    return self;
}


#pragma mark CWBeaconMonitorDelegate


- (void)beaconUpdated:(CWBeacon *)beacon
{
    [self.webserver sendBeaconInfo:beacon];
}

@end
