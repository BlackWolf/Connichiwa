//
//  CWUtil.h
//  Connichiwa
//
//  Created by Mario Schreiner on 21/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface CWUtil : NSObject

+ (NSString *)escapedJSONStringFromDictionary:(NSDictionary *)dictionary;
+ (NSDictionary *)dictionaryFromJSONData:(NSData *)JSON;
+ (NSData *)dataFromDictionary:(NSDictionary *)dictionary;
+ (NSArray *)deviceInterfaceAddresses;

@end
