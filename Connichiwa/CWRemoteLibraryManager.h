//
//  RemoteLibraryManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import "CWWebApplicationState.h"
#import "CWRemoteLibraryManagerDelegate.h"



/**
 *  The state of this device as a remote device
 */
typedef NS_ENUM(NSInteger, CWRemoteLibraryManagerState)
{
    /**
     *  This device is not connected to any other device as a remote
     */
    CWRemoteLibraryManagerStateDisconnected,
    /**
     *  The device is currently connecting to another device as a remote
     */
    CWRemoteLibraryManagerStateConnecting,
    /**
     *  The device is currently used as a remote
     */
    CWRemoteLibraryManagerStateConnected,
    /**
     *  The device is currently disconnecting from another device and about to give up its remote state
     */
    CWRemoteLibraryManagerStateDisconnecting,
    /**
     *  The device has been soft-disconnected from another device - it is considered the same as the Disconnected state, but the connection is not physically closed yet
     */
    CWRemoteLibraryManagerStateSoftDisconnected
};



/**
 *  The RemoteLibraryManager manages this device as a remote device. It is responsible for making sure that we connect to another device as a remote if the device requested it - it manages the remote webview, receives (and delegates) messages from the remote web library and also sends messages to the remote web library.
 *  In order to do all that, the manager needs a dedicated UIWebView where it will connect to a Connichiwa master device and retrieve the remote web library when requested. This will allow the master device to send messages to this device.
 */
@interface CWRemoteLibraryManager : NSObject


/**
 *  The delegate this class sends events to
 */
@property (readwrite, strong) id<CWRemoteLibraryManagerDelegate> delegate;

/**
 *  The remote webview where the connection to remote devices will be established. Must be set to a UIWebView that is not used for any other purposes. This class will become the delegate of that UIWebView. Also, the UIWebView will automatically be hidden/unhidden depending on the remote state of this devie.
 */
@property (readwrite, strong) UIWebView *webView;

/**
 *  Initializes a new manager with the given application state
 *
 *  @param appState The application state object of this application
 *
 *  @return a new manager instance
 */
- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState;

/**
 *  Determines if this device is currently active as a remote
 *
 *  @return true if we are currently connected as a remote device, otherwise false
 */
- (BOOL)isActive;

- (void)sendProximityStateChanged:(BOOL)proximityState;

/**
 *  Connects us as a remote device to the connichiwa webserver at the given URL
 *
 *  @param URL The URL of a connichiwa webserver
 */
- (void)connectToServer:(NSURL *)URL;

/**
 *  Disconnects this device from its currently connected master device if it is connected
 */
- (void)disconnect;

@end
