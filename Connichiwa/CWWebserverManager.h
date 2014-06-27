//
//  CWWebserverManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWWebserverManagerDelegate.h"
@class NLContext;



/**
 *  The CWWebserverManager class represents the local webserver run by Connichiwa in order to run local web applications.
 *  It is responsible for launching and managing the webserver and acts as a bridge between Objective-C and the server, sending and receiving messages from it over the Connichiwa Communication Protocol (Native Layer).
 *  Only one instance of the webserver should be running on a device.
 */
@interface CWWebserverManager : NSObject


/**
 *  The delegate to receive events by this class
 */
@property (readwrite, strong) id<CWWebserverManagerDelegate> delegate;

/**
 *  Path to the folder acting as the root of the web server. '/' on the web server will be mapped to this path. 
 */
@property (readonly) NSString *documentRoot;

/**
 *  Initialize a new CWWebserverManager instance with the given document root (should point to the path where the web application resides). Calling this does not actually start the webserver, use startWebserver to do so.
 *
 *  @param documentRoot The document root of the webserver, usually pointing to the path of the web application. '/' on the web server will be mapped to this path.
 *
 *  @return A new CWWebserverManager instance
 */
- (instancetype)initWithDocumentRoot:(NSString *)documentRoot;

- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port;

/**
 *  Starts the webserver, making it possible for web clients to connect to it
 */
/**
 *  Starts the webserver on the given port, making it possible for web clients to connect to it
 *
 *  @param port The port the webserver should listen on. Note that the websocket server will listen on this + 1
 */
- (void)startWebserverOnPort:(int)port;

/**
 *  Sends the given identifier to the web library and tells the web library this is the identifier of this device. Should usually only be called once in the application's life cycle and only with the correct identifier, otherwise results are undefined.
 *
 *  @param identifier The identifier that represents this device amongst Connichiwa
 */
- (void)sendToWeblib_localIdentifier:(NSString *)identifier;

/**
 *  Sends a message to the web library telling it about a newly detected, nearby device with the given identifier
 *
 *  @param identifier The identifier of the device that was detected
 */
- (void)sendToWeblib_deviceDetected:(NSString *)identifier;

/**
 *  Sends a message to the web library telling it that the distance of a previously detected device has changes
 *
 *  @param identifier The identifier of the device whose distance changes
 *  @param distance   The new distance of the device in meters
 */
- (void)sendToWeblib_device:(NSString *)identifier changedDistance:(double)distance;

- (void)sendToWeblib_deviceLost:(NSString *)identifier;

/**
 *  Sends a message to the web library telling it that a request to use another device as a remote device has failed
 *
 *  @param identifier The identifier of the device that should have been used as a remote device
 */
- (void)sendToWeblib_connectionRequestFailed:(NSString *)identifier;

@end
