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
@protocol CWWebserverDelegate <NSObject>

@optional

/**
 *  Clled after the webserver reported that the websocket connection to the local web view was successfully established. After that, messages can be send to the web library through that websocket connection.
 */
- (void)localWebsocketWasOpened;

@end
