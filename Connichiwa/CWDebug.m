//
//  NWDebug.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWDebug.h"



@implementation CWDebug


+ (void)executeInDebug:(void (^)(void))block
{
    #ifdef CWDEBUG
        block();
    #endif
}

@end
