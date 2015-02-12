//
//  NWDebug.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWDebug.h"

int const MAX_LOG_LEVEL = 4;



@implementation CWDebug


+ (BOOL)isDebugging
{
    #ifdef DEBUG
        return YES;
    #else
        return NO;
    #endif
}


+ (void)executeInDebug:(void (^)(void))block
{
    #ifdef DEBUG
        block();
    #endif
}

+ (int)logLevel {
    return MAX_LOG_LEVEL;
}


static long longestSourceLength = 10;


/**
 *  Custom logging function tailored towards usage in Connichiwa. It will log a message if the given priority is smaller or equal to MAX_LOG_PRIORITY and the given source is set up as an active debug source.
 *  Thanks to http://stackoverflow.com/questions/1354728/in-xcode-is-there-a-way-to-disable-the-timestamps-that-appear-in-the-debugger-c
 *
 *  @param level A higher level means the message is likely to occur more often. This allows us to reduce log messages by decreasing MAX_LOG_LEVEL. The levels are roughly defined as follows:
 *   1 -- very rudimentary application flow (bt advertising starts, webserver was launched, ...)
 *   2 -- more detailed application flow (remote did connect/disconnect, getting intial data, ...)
 *   3 -- log message on most method calls, giving a detailed overview of the application flow
 *   4 -- communication and other messages which are likely to spam the log
 *   5 -- even more spammy messages
 *  @param source   The source component of the log message, for example NATIVE or WEBLIB. Sources can be activated and deactivated by altering the activeDebugSources array
 *  @param file     The file where the message occured
 *  @param line     The line in the file where the message occured
 *  @param format   The format of the message. A format string like it is also used in NSLog()
 *  @param ...      The arguments for the format string
 */
void _cwLogNew(int level, NSString *source, NSString *file, int line, NSString *format, ...)
{
    NSArray *activeDebugSources = nil; //TODO is defined every time, lame, but static NSArray is not possible
 
    source = [source uppercaseString];
    if ([CWDebug isDebugging] && level <= MAX_LOG_LEVEL && ([source isEqualToString:@"ERROR"] || activeDebugSources == nil || [activeDebugSources containsObject:source]))
    {
        static dispatch_once_t token;
        static NSDateFormatter *dateFormatter;
        dispatch_once(&token, ^{
            dateFormatter = [[NSDateFormatter alloc] init];
            [dateFormatter setDateFormat:@"HH:mm:ss.SSS"];
        });
        
        va_list args;
        va_start(args, format);
        NSString *formattedString = [[NSString alloc] initWithFormat:format arguments:args];
        va_end(args);
        
        NSDate *now = [NSDate date];
        NSString *dateString = [dateFormatter stringFromDate:now];
        
        if ([source length] > longestSourceLength) longestSourceLength = [source length];
        long neededSpaces = longestSourceLength - [source length];
        if (neededSpaces > 0)
        {
            NSString *spaces = [[NSString string] stringByPaddingToLength:neededSpaces withString:@" " startingAtIndex:0];
            source = [source stringByAppendingString:spaces];
        }
        
        NSString *finalString = [NSString stringWithFormat:@"%@ %@ -- %@\n", source, dateString, formattedString];
        [[NSFileHandle fileHandleWithStandardOutput] writeData:[finalString dataUsingEncoding:NSUTF8StringEncoding]];
    }
}

@end
