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
 *  Represents the state of the webserver controlled by this manager
 */
typedef NS_ENUM(NSInteger, CWWebserverManagerState)
{
    /**
     *  The webserver is stopped
     */
    CWWebserverManagerStateStopped,
    /**
     *  The webserver is starting
     */
    CWWebserverManagerStateStarting,
    /**
     *  The webserver has started and accepts connections
     */
    CWWebserverManagerStateStarted,
    /**
     *  The webserver is currently suspended - it is still running but does not accept connections
     */
    CWWebserverManagerStateSuspended
};



/**
 *  The CWWebserverManager class represents the local webserver run by Connichiwa in order to run local web applications.
 *  It is responsible for launching and managing the webserver that offers an HTTP and Websocket server. The manager also receives information about established or closed websocket connections.
 *  Only one instance of the webserver should be running on a device.
 */
@interface CWWebserverManager : NSObject


/**
 *  The delegate to receive events by this class
 */
@property (readwrite, strong) id<CWWebserverManagerDelegate> delegate;

/**
 *  The current state of this manager
 */
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

/**
 *  Calling this method actually launches the webserver and initializes the HTTP and Websocket servers. The root of the webserver will be mapped to the given document root, the HTTP server will run on the given port and the websocket server will run on the given port + 1
 *
 *  @param documentRoot The document root that contains the files that the webserver is supposed to serve
 *  @param port         The port the HTTP server will run
 */
- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port;

/**
 *  Puts the webserver in a suspended state where it closes all remote connections and does not accept new ones
 */
- (void)suspendWebserver;

/**
 *  Resumes the webserver if it is in suspended state, making it possible to establish remote connections again
 */
- (void)resumeWebserver;

@end
