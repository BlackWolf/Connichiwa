//
//  CWUtil.m
//  Connichiwa
//
//  Created by Mario Schreiner on 21/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWUtil.h"
#import "CWConstants.h"

@implementation CWUtil


/**
 *  Creates a JSON string from a NSDictionary that can be safely send over JavaScriptCore's evaluteScript:.
 *  The dictionary must be convertable to JSON as defined by NSJSONSerialization
 *
 *  @param dictionary The dictionary to translate into JSON
 *
 *  @return The JSON string representing the Dictionary.
 */
+ (NSString *)escapedJSONStringFromDictionary:(NSDictionary *)dictionary
{
    NSError *error;
    NSData *data = [NSJSONSerialization dataWithJSONObject:dictionary options:JSON_WRITING_OPTIONS error:&error];
    
    if (error)
    {
        [NSException raise:@"Invalid Dictionary for serialization" format:@"Dictionary could not be serialized to JSON: %@", dictionary];
    }
    
    //Create the actual JSON
    //The JSON spec says that quotes and newlines must be escaped - not doing so will produce an "unexpected EOF" error
    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    json = [json stringByReplacingOccurrencesOfString:@"\'" withString:@"\\\'"];
    json = [json stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
    json = [json stringByReplacingOccurrencesOfString:@"\n" withString:@"\\n"];
    json = [json stringByReplacingOccurrencesOfString:@"\r" withString:@""];
    
    return json;
}



+ (NSDictionary *)dictionaryFromJSONData:(NSData *)JSON
{
    return [NSJSONSerialization JSONObjectWithData:JSON options:0 error:nil];
}


/* Thanks to
 http://stackoverflow.com/questions/3434192/alternatives-to-nshost-in-iphone-app and
 http://zachwaugh.me/posts/programmatically-retrieving-ip-address-of-iphone/
 */
#include <ifaddrs.h>
#include <arpa/inet.h>
+ (NSArray *)deviceInterfaceAddresses
{
    struct ifaddrs *interfaces = NULL;
    struct ifaddrs *temp_addr = NULL;
    int success = 0;
    
    NSMutableArray *ips = [NSMutableArray arrayWithCapacity:1];
    
    // retrieve the current interfaces - returns 0 on success
    success = getifaddrs(&interfaces);
    if (success == 0)
    {
        // Loop through linked list of interfaces
        // We could only consider interfaces of family AF_INET or with name enX, but to make sure we don't miss something we just use all valid addresses we find
        temp_addr = interfaces;
        while (temp_addr != NULL)
        {
            //            DLog(@"Interface %@ (family %d) with IP %@", [NSString stringWithUTF8String:temp_addr->ifa_name], temp_addr->ifa_addr->sa_family,[NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)]);
            
            // Get NSString from C String
            NSString *ip = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)];
            if ([ip hasPrefix:@"0."] == NO && [ip hasPrefix:@"127."] == NO)
            {
                [ips addObject:ip];
            }
            
            temp_addr = temp_addr->ifa_next;
        }
    }
    
    // Free memory
    freeifaddrs(interfaces);
    
    //Remove duplicates
    NSMutableArray *finalIps = [NSMutableArray arrayWithCapacity:[ips count]];
    for (NSString *ip in ips)
    {
        if (![finalIps containsObject:ip]) [finalIps addObject:ip];
    }
    
    return finalIps;
}

@end
