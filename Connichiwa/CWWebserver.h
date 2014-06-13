//
//  CWNodelikeRunner.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CWWebserverDelegate.h"
@class NLContext, CWBeacon, CWDevice;



/**
 *  The CWWebserver class represents the local webserver run by Connichiwa in order to run local web applications. It launches the webserver and acts as a bridge between Objective-C and the server, sending and receiving messages from it over the Connichiwa Communication Protocol (Native Layer).
 *  Only one instance of a CWWebserver can run in an application - always use the sharedServer method to retrieve that instance.
 */
@interface CWWebserver : NSObject

@property (readwrite, strong) id<CWWebserverDelegate> delegate;

/**
 *  Path to the folder acting as the root of the web server. '/' on the web server will be mapped to this path. 
 */
@property (readonly) NSString *documentRoot;

//CONTINUE HERE - MAKE SURE WE START ONLY ONCE
//@property (readonly) BOOL started;

/**
 *  Returns the shared instance of this class. Only one CWWebserver should be used so always use this method to retrieve an instance of CWWebserver.
 *
 *  @return the shared instance of CWWebserver
 */
+ (instancetype)sharedServer;

/**
 *  Launch the webserver with the given document root.
 *
 *  @param documentRoot A path that will be mapped to the root path of the web server. Your web application should be there.
 */
- (void)startWithDocumentRoot:(NSString *)documentRoot;

- (void)sendLocalInfo:(CWBeacon *)localBeacon;

/**
 *  Sends information about a CWBeacon to the web library.
 *
 *  @param beacon The CWBeacon to send
 */
- (void)sendDeviceInfo:(CWDevice *)device;

@end
