//
//  NWDebug.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



void cwLog(NSString *format, ...);


//Define extended logging functions
//DLog() will only log if the debuglog compiler flag is set to 1, ALog() will always log
//Thanks http://stackoverflow.com/questions/969130/how-to-print-out-the-method-name-and-line-number-and-conditionally-disable-nslog
#ifdef CWDEBUG
#    define DLog(fmt, ...) cwLog((@"%s:%d -- " fmt), (strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1, __LINE__, ##__VA_ARGS__)
#else
#    define DLog(...)
#endif

#define ALog(fmt, ...) cwLog((@"%s:%d -- " fmt), (strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1, __LINE__, ##__VA_ARGS__)

#define ResolveUnused(x) ((void)x)



/**
 *  Class that holds everything we need to nicely debug
 */
@interface CWDebug : NSObject

/**
 *  Executes the given code only when we are in debug mode
 *
 *  @param block The code to execute in debug
 */
+ (void)executeInDebug:(void (^)(void))block;

@end
