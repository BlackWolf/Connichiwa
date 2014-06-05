//
//  CWBundle.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  Class for working with Connichiwa-related resources that can be found in the ConnichiwaResources.bundle
 */
@interface CWBundle : NSObject

/**
 *  Returns the NSBundle object for the ConnichiwaResources.bundle
 *
 *  @return an NSBundle for the Connichiwa resource bundle
 */
+ (NSBundle *)bundle;

@end
