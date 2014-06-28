//
//  CWWebLibraryManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 28/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol CWWebLibraryManagerDelegate <NSObject>

- (void)webLibraryIsReady;
- (void)didReceiveConnectionRequestForRemote:(NSString *)identifier;
- (void)remoteDidConnect:(NSString *)identifier;

@end
