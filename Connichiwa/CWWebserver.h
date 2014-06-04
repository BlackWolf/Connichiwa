//
//  CWNodelikeRunner.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class NLContext;



/**
 *  The CWWebserver class represents the local webserver run by Connichiwa in order to run local web applications.
 *  Only one instance of a CWWebserver can started in an application - use the sharedServer method to retrieve that instance.
 */
@interface CWWebserver : NSObject

/**
 *  Returns Retrieves the shared instance of this class. Only one CWWebserver should be used so always use this method to retrieve an instance of CWWebserver.
 *
 *  @return the shared instance of CWWebserver
 */
+ (instancetype)sharedServer;

/**
 *  Starts the Nodelike webserver
 */
- (void)start;

@end
