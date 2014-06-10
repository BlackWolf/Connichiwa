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


/**
 *  Custom logging class tailored towards usage in Connichiwa
 *  Thanks to http://stackoverflow.com/questions/1354728/in-xcode-is-there-a-way-to-disable-the-timestamps-that-appear-in-the-debugger-c
 *
 *  @param format The format of the logging string, same as in NSLog()
 *  @param ...    Additional parameters substituted for the placeholders in the format string
 */
void cwLog(NSString *format, ...) {
    //DateFormatter is static, create it only once
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
    
    NSString *finalString = [NSString stringWithFormat:@"NATIVE    %@ %@ \n", dateString, formattedString];
    [[NSFileHandle fileHandleWithStandardOutput] writeData:[finalString dataUsingEncoding:NSUTF8StringEncoding]];
}

@end
