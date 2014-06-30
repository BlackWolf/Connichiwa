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



typedef NS_ENUM(NSInteger, CWWebserverManagerState)
{
    CWWebserverManagerStateStopped,
    CWWebserverManagerStateStarting,
    CWWebserverManagerStateStarted,
    CWWebserverManagerStatePaused
};



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

@property (readonly) CWWebserverManagerState state;

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

- (void)pauseWebserver;
- (void)resumeWebserver;

@end
