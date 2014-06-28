//
//  CWWebserverManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 10/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWWebserverManager;


/**
 *  A delegate protocol that receives different events from the CWWebserverManager instance
 */
@protocol CWWebserverManagerDelegate <NSObject>

@optional

/**
 *  Called when the webserver was started and is ready to accept requests from web clients
 */
- (void)didStartWebserver;

///**
// *  Called when the web library was loaded and established a connection to the webserver
// */
//- (void)didConnectToWeblib;
//
///**
// *  Called when the web library sent a request to use another device as a remote device
// *
// *  @param identifier The identifier of the device that should be connected
// */
//- (void)didReceiveConnectionRequest:(NSString *)identifier;
//
///**
// *  Called when a remote device successfully established a websocket connection to the web library
// *
// *  @param identifier The identifier of the connected device
// */
//- (void)didConnectToRemoteDevice:(NSString *)identifier;

@end
