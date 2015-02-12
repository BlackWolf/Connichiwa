//
//  NWDebug.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



void _cwLogNew(int priority, NSString *source, NSString *file, int line, NSString *format, ...);

//_CWLog() is a low-level macro that will only log if the CWDEBUG compiler flag is set to 1
//Thanks http://stackoverflow.com/questions/969130/how-to-print-out-the-method-name-and-line-number-and-conditionally-disable-nslog
#ifdef DEBUG
#    define _CWLog(prio, source, file, line, format, ...) _cwLogNew(prio, source, file, line, format, ##__VA_ARGS__)
#else
#    define _CWLog(...) //we don't need this but it saves us a method call
#endif

//CWLog is a higher-level logging macro to be used by the native layer
#define CWLog(prio, format, ...) _CWLog(prio, @"NATIVE", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//BTLog is a higher-level logging macro to be used by BT-related functions in the native layer
#define BTLog(prio, format, ...) _CWLog(prio, @"BLUETOOTH", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//HTTPLog is a higher-level logging macro to be used by HTTP Server-related functions in the native layer
#define HTTPLog(prio, format, ...) _CWLog(prio, @"HTTP", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//WSLog is a higher-level logging macro to be used by Websocket-related functions in the native layer
#define WSLog(prio, format, ...) _CWLog(prio, @"WEBSOCKET", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//MCLog is a higher-level logging macro to be used by Multipeer Connectivity-related functions in the native layer
#define MCLog(prio, format, ...) _CWLog(prio, @"MULTIPEER", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//WLLog is a higher-level logging macro to be used by messages sent from the JavaScript WebLibrary
#define WLLog(prio, format, ...) _CWLog(prio, @"WEBLIB",@"?????", -1, format, ##__VA_ARGS__)

//ErrLog is a higher-level logging macro to be used to log errors
#define ErrLog(format, ...) _CWLog(1, @"ERROR", @((strrchr(__FILE__, '/') ? : __FILE__ - 1) + 1), __LINE__, format, ##__VA_ARGS__)

//ResolveUnused can be used to make a variable "used" and therefore prevent a debugger warning
//This should only be used on variables that are only used in debug mode, as the compiler will warn in release mode for those vars
#define ResolveUnused(x) ((void)x)



/**
 *  Class that holds everything we need to nicely debug
 */
@interface CWDebug : NSObject

+ (BOOL)isDebugging;
/**
 *  Executes the given code only when we are in debug mode
 *
 *  @param block The code to execute in debug
 */
+ (void)executeInDebug:(void (^)(void))block;

+ (int)logLevel;

@end
