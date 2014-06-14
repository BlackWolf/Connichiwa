//
//  CWDeviceID.h
//  Connichiwa
//
//  Created by Mario Schreiner on 14/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface CWDeviceID : NSObject

@property (readonly) NSNumber *major;
@property (readonly) NSNumber *minor;

- (instancetype)initWithMajor:(NSNumber *)major minor:(NSNumber *)minor;

@end
