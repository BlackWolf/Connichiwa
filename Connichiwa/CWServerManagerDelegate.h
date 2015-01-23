//
//  CWWebserverManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 10/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CWServerManager;


/**
 *  A delegate protocol that receives different events from the CWWebserverManager instance
 */
@protocol CWServerManagerDelegate <NSObject>

@optional

/**
 *  Called when the webserver was started and is ready to accept requests from web clients
 */
- (void)didStartWebserver;

/**
 *  Called when a remote device disconnected from the webserver
 *
 *  @param identifier The identifier of the disconnected device
 */
- (void)remoteDidDisconnect:(NSString *)identifier;

@end
