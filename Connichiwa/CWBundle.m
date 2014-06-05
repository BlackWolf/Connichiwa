//
//  CWBundle.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBundle.h"



@implementation CWBundle


+ (NSBundle *)bundle
{
    //Grab bundle only once
    static dispatch_once_t token;
    static NSBundle *frameworkBundle;
    dispatch_once(&token, ^{
        NSString *mainBundlePath = [[NSBundle mainBundle] resourcePath];
        NSString *frameworkBundlePath = [mainBundlePath stringByAppendingPathComponent:@"ConnichiwaResources.bundle"];
        frameworkBundle = [NSBundle bundleWithPath:frameworkBundlePath];
    });
    
    return frameworkBundle;
}

@end
