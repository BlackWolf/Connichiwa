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

- (void)remoteDidDisconnect:(NSString *)identifier;
@end
