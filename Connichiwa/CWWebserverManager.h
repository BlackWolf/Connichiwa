//
//  CWWebserver.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "CWWebserverDelegate.h"
@class NLContext, CWDeviceID;



/**
 *  The CWWebserver class represents the local webserver run by Connichiwa in order to run local web applications. 
 *  It is responsible for launching and managing the webserver and acts as a bridge between Objective-C and the server, sending and receiving messages from it over the Connichiwa Communication Protocol (Native Layer).
 *  Only one instance of the webserver should be running on a device.
 */
@interface CWWebserverManager : NSObject

- (instancetype)initWithDocumentRoot:(NSString *)documentRoot;
- (void)startWebserver;

/**
 *  The delegate to receive events send by CWWebserver
 */
@property (readwrite, strong) id<CWWebserverManagerDelegate> delegate;

/**
 *  Path to the folder acting as the root of the web server. '/' on the web server will be mapped to this path. 
 */
@property (readonly) NSString *documentRoot;

- (void)loadWeblibOnWebView:(UIWebView *)webView withLocalIdentifier:(NSString *)identifier;
- (void)sendToWeblib_deviceDetected:(NSString *)identifier;
- (void)sendToWeblib_device:(NSString *)identifier changedDistance:(double)distance;
- (void)sendToWeblib_connectionRequestFailed:(NSString *)identifier;

@end
