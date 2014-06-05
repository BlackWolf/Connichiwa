//
//  NWDebug.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



//Define extended logging functions
//DLog() will only log if the debuglog compiler flag is set to 1, ALog() will always log
//Thanks http://stackoverflow.com/questions/969130/how-to-print-out-the-method-name-and-line-number-and-conditionally-disable-nslog
#ifdef CWDEBUG
#    define DLog(fmt, ...) NSLog((@"%s:%d %s -- " fmt), (strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1, __LINE__, __PRETTY_FUNCTION__, ##__VA_ARGS__)
#else
#    define DLog(...)
#endif

#define ALog(fmt, ...) NSLog((@"%s:%d %s -- " fmt), (strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1, __LINE__, __PRETTY_FUNCTION__, ##__VA_ARGS__)



/**
 *  Class that holds everything we need to nicely debug
 */
@interface CWDebug : NSObject

+ (void)executeInDebug:(void (^)(void))block;

@end
