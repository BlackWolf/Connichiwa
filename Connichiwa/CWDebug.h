//
//  NWDebug.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



void cwLogNew(int priority, NSString *source, NSString *file, int line, NSString *format, ...);

//_CWLog() is a low-level macro that will only log if the CWDEBUG compiler flag is set to 1
//Thanks http://stackoverflow.com/questions/969130/how-to-print-out-the-method-name-and-line-number-and-conditionally-disable-nslog
#ifdef CWDEBUG
#    define _CWLog(prio, source, file, line, format, ...) cwLogNew(prio, source, file, line, format, ##__VA_ARGS__)
#else
#    define _CWLog(...)
#endif

//CWLog is a higher-level logging macro to be used by the native layer
#define CWLog(prio, format, ...) _CWLog(prio, @"NATIVE", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//BTLog is a higher-level logging macro to be used by BT-related functions in the native layer
#define BTLog(prio, format, ...) _CWLog(prio, @"BLUETOOTH", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//ErrLog is a higher-level logging macro to be used to log errors
#define ErrLog(format, ...) _CWLog(1, @"ERROR", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//ResolveUnused can be used to make a variable "used" and therefore prevent a debugger warning
//This should only be used on variables that are only used in debug mode, as the compiler will warn in release mode for those vars
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
