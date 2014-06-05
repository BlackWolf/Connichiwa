//
//  CWNodelikeRunner.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class NLContext, CWBeacon;



/**
 *  The CWWebserver class represents the local webserver run by Connichiwa in order to run local web applications. It launches the webserver and acts as a bridge between Objective-C and the server, sending and receiving messages from it over a defined protocol.
 *  Only one instance of a CWWebserver can run in an application - use the sharedServer method to retrieve that instance.
 */
@interface CWWebserver : NSObject

//CONTINUE HERE - MAKE SURE WE START ONLY ONCE
//@property (readonly) BOOL started;

/**
 *  Returns Retrieves the shared instance of this class. Only one CWWebserver should be used so always use this method to retrieve an instance of CWWebserver.
 *
 *  @return the shared instance of CWWebserver
 */
+ (instancetype)sharedServer;

- (void)startWithDocumentRoot:(NSString *)documentRoot;

- (void)sendBeaconInfo:(CWBeacon *)beacon;

@end
