//
//  CWWebLibraryManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 28/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  A delegate protocol that receives different events from the CWWebLibraryManager (and therefore also from the web library)
 */
@protocol CWWebLibraryManagerDelegate <NSObject>

/**
 *  Called when the web library has been loaded and established a connection to the local webserver
 */
- (void)webLibraryIsReady;

/**
 *  Called when the web library requested the connection to another device
 *
 *  @param identifier The identifier of the device that should be used as a remote device
 */
- (void)didReceiveConnectionRequestForRemote:(NSString *)identifier;

/**
 *  Called when the connection to another device was successfully established
 *
 *  @param identifier The identifier of the connected device
 */
- (void)remoteDidConnect:(NSString *)identifier;

@end
