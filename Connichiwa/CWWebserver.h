//
//  CWWebserver.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWWebserverDelegate.h"
@class NLContext, CWDeviceID;



/**
 *  The CWWebserver class represents the local webserver run by Connichiwa in order to run local web applications. 
 *  It is responsible for launching and managing the webserver and acts as a bridge between Objective-C and the server, sending and receiving messages from it over the Connichiwa Communication Protocol (Native Layer).
 *  Only one instance of the webserver should be running on a device.
 */
@interface CWWebserver : NSObject

/**
 *  The delegate to receive events send by CWWebserver
 */
@property (readwrite, strong) id<CWWebserverDelegate> delegate;

/**
 *  Path to the folder acting as the root of the web server. '/' on the web server will be mapped to this path. 
 */
@property (readonly) NSString *documentRoot;

/**
 *  Launch the webserver with the given document root.
 *
 *  @param documentRoot A path that will be mapped to the root path of the web server. Your web application should be there.
 */
- (void)startWithDocumentRoot:(NSString *)documentRoot;

/**
 *  Sends a message to the web application with the ID this device is advertised under
 *
 *  @param ID The ID of this device
 */
- (void)sendLocalID:(CWDeviceID *)ID;

/**
 *  Sends a message to the web application and informs it of a new device detected nearby
 *
 *  @param ID        The ID of the detected device
 *  @param proximity A string describing the distance between this device and the detected device
 */
- (void)sendNewBeaconWithID:(CWDeviceID *)ID inProximity:(NSString *)proximity;

/**
 *  Sends a message to the web application and informs it of a change of the proximity of a device nearby
 *
 *  @param ID        The ID of the device that changed
 *  @param proximity A string describing the new distance between this device and the detected device
 */
- (void)sendBeaconWithID:(CWDeviceID *)ID newProximity:(NSString *)proximity;

/**
 *  Sends a message to the web application and informs it of a nearby device that was lost
 *
 *  @param ID        The ID of the lost device
 */
- (void)sendLostBeaconWithID:(CWDeviceID *)ID;

@end
