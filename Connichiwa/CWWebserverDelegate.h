//
//  CWWebserverDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 10/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  A delegate protocol that receives different events from the CWWebserver instance
 */
@protocol CWWebserverManagerDelegate <NSObject>

@optional

- (void)receivedConnectionRequest:(NSString *)deviceIdentifier;

/**
 *  Called after the webserver reported that the websocket connection to the local web library was successfully established. After this, it is possible to send messages to the web library through CWWebserverManager
 */
- (void)didEstablishWeblibWebsocketConnection;

@end
