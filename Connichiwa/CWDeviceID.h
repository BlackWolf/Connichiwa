//
//  CWDeviceID.h
//  Connichiwa
//
//  Created by Mario Schreiner on 14/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  Represents a unique ID for a connichiwa device. Each ID is made up of a major and a minor part and need to be unique among the different devices.
 */
@interface CWDeviceID : NSObject

/**
 *  The major part of the ID
 */
@property (readonly) NSNumber *major;

/**
 *  The minor part of the ID
 */
@property (readonly) NSNumber *minor;

/**
 *  Creates a new ID with the given major and minor.
 *
 *  @param major The major part of the ID
 *  @param minor The minor part of the ID
 *
 *  @return A new ID instance
 */
- (instancetype)initWithMajor:(NSNumber *)major minor:(NSNumber *)minor;

@end
