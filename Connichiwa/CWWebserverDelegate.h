//
//  CWWebserverDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 10/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol CWWebserverDelegate <NSObject>

@optional
- (void)localWebsocketWasOpened;

@end
