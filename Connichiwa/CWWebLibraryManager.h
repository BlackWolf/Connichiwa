//
//  CWWebLibraryManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import "CWWebApplicationState.h"
#import "CWWebLibraryManagerDelegate.h"



/**
 *  Represents the loading state of the web library on the web library's UIWebView
 */
typedef NS_ENUM(NSInteger, CWWebLibraryManagerState)
{
    /**
     *  This device is not connected to the web library
     */
    CWWebLibraryManagerStateDisconnected,
    /**
     *  This device is currently connecting to the web library
     */
    CWWebLibraryManagerStateConnecting,
    /**
     *  This device has established a connection to the web library
     */
    CWWebLibraryManagerStateConnected,
    /**
     *  This device is currently disconnecting from the web library
     */
    CWWebLibraryManagerStateDisconnecting
};



/**
 *  The WebLibraryManager is responsible for creating the web library, making sure the web library properly connects to the local webserver and to communicate with the web library by both receiving (and delegating) callbacks from it and sending messages to it.
 *  In order to do that, the manager needs a dedicated UIWebView on which the local web application will be opened and where the web library will therefore be loaded.
 */
@interface CWWebLibraryManager : NSObject

/**
 *  The delegate this class sends events to
 */
@property (readwrite, strong) id<CWWebLibraryManagerDelegate> delegate;

/**
 *  A dedicated UIWebView that is used to show the web application. This webview must not be used for anything else and this manager will set itself as the delegate of the webview.
 */
@property (readwrite, strong) UIWebView *webView;

/**
 *  Initializes a new manager with the given application state
 *
 *  @param appState The state of this connichiwa application
 *
 *  @return a new CWWebLibraryManager instance
 */
- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState;

/**
 *  Launches the web application and therefore the web library on this classes webView. Once connected, the web library can never be disconnected during the runtime of the application. If the web library is disconnected, an exception will be thrown and the execution of the application will stop.
 */
- (void)connect;

/**
 *  Sends information to the web library that a remote device was detected via BT
 *
 *  @param identifier The unique connichiwa identifier of the detected device
 */
- (void)sendDeviceDetected:(NSString *)identifier information:(NSDictionary *)deviceInfo;

/**
 *  Sends information to the web library that a previously detected device has changed its distance to this device
 *
 *  @param identifier The identifier of the device
 *  @param distance   The new distance in meters
 */
- (void)sendDevice:(NSString *)identifier changedDistance:(double)distance;

/**
 *  Sends information to the web library that a previously detected device was lost
 *
 *  @param identifier The identifier of the lost device
 */
- (void)sendDeviceLost:(NSString *)identifier;

/**
 *  Sends information to the web library that a requested connection to another device failed
 *
 *  @param identifier The identifier of the device that could not be connected
 */
- (void)sendRemoteConnectFailed:(NSString *)identifier;

/**
 *  Sends information to the web library that a connected remote device did disconnect
 *
 *  @param identifier The identifier of the disconnected device
 */
- (void)sendRemoteDisconnected:(NSString *)identifier;

/**
 *  Determines if the web library is currently running
 *
 *  @return true if a connection to the web library exists, otherwise false
 */
- (BOOL)isActive;

@end
