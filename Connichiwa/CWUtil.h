//
//  CWUtil.h
//  Connichiwa
//
//  Created by Mario Schreiner on 21/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  A utility helper class that contains some useful methods that are needed amongst different Connichiwa components
 */
@interface CWUtil : NSObject

/**
 *  Transforms a dictionary into a JSON string and escaped the string, so it can be used safely. The transformation is done via NSJSONSerialization, so the dictionary must contain only objects that can be serialized by NSJSONSerialization.
 *
 *  @param dictionary The dictionary to transform
 *
 *  @return An escaped JSON string that represents the dictionary
 */
+ (NSString *)escapedJSONStringFromDictionary:(NSDictionary *)dictionary;

/**
 *  Transform a given JSON data object, as it is for example created by JSONDataFromDictionary: into a dictionary. NSJSONSerialization is used, to the JSON string must be decodable by NSJSONSerialization.
 *
 *  @param JSON The NSData object representing a JSON string
 *
 *  @return An NSDictionary that represents the JSON
 */
+ (NSDictionary *)dictionaryFromJSONData:(NSData *)JSON;

/**
 *  Transforms a dictionary into a JSON data object. The resulting NSData object can then be decoded by using dictionaryFromJSONData: to retrieve the original dictionary. NSJSONSerialization is used, so the dictionary must contain only objects that can be serialized by NSJSONSerialization.
 *
 *  @param dictionary The dictionary to transform
 *
 *  @return An NSData object that represents the JSON string for the dictioanry
 */
+ (NSData *)JSONDataFromDictionary:(NSDictionary *)dictionary;

/**
 *  Retrieves a filtered array of this device's network interface addresses. Only relevant addresses will be returned, which for example includes the WiFi address or a BT PAN address if present.
 *
 *  @return An NSArray, each entry is a string that represents a relevant address of a network interface of this device.
 */
+ (NSArray *)deviceInterfaceAddresses;

@end
