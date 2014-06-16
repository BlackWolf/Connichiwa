//
//  CWDeviceID.m
//  Connichiwa
//
//  Created by Mario Schreiner on 14/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWDeviceID.h"



@interface CWDeviceID ()

@property (readwrite, strong) NSNumber *major;
@property (readwrite, strong) NSNumber *minor;

@end



@implementation CWDeviceID


/**
 *  An ID without a major and minor part is invalid, therefore using this method will throw an exception immediatly.
 *
 *  @return nil
 */
- (instancetype)init
{
    [NSException raise:@"Cannot initialize CWDeviceID without a major and minor" format:@"Cannot initialize CWDeviceID without a major and minor"];
    
    return nil;
}


- (instancetype)initWithMajor:(NSNumber *)major minor:(NSNumber *)minor
{
    self = [super init];
    
    self.major = major;
    self.minor = minor;
    
    return self;
}

@end
