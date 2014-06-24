//
//  CWWebApplicationState.h
//  Connichiwa
//
//  Created by Mario Schreiner on 24/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol CWWebApplicationState <NSObject>

@property (readonly, strong) NSString *identifier;

- (BOOL)isRemote;
- (BOOL)canBecomeRemote;

@end
