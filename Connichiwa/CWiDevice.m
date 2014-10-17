//
//  CWiDevice.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/08/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWiDevice.h"

#include <sys/socket.h> // Per msqr
#include <sys/sysctl.h>

@implementation CWiDevice


/* Thanks to https://github.com/erica/uidevice-extension/blob/master/UIDevice-Hardware.m */
+ (NSString *)platform {
    //Get hw.machine string
    char *typeSpecifier = "hw.machine";
    size_t size;
    sysctlbyname(typeSpecifier, NULL, &size, NULL, 0);
    
    char *answer = malloc(size);
    sysctlbyname(typeSpecifier, answer, &size, NULL, 0);
    
    NSString *results = [NSString stringWithCString:answer encoding: NSUTF8StringEncoding];
    
    free(answer);
    
    return results;
}


/* Thanks to https://github.com/erica/uidevice-extension/blob/master/UIDevice-Hardware.m */
+ (CWiDeviceModel)model
{
    NSString *platform = [CWiDevice platform];
    
    // IPHONE
    
    if ([platform hasPrefix:@"iPhone1,1"])      return CWiDeviceModeliPhone1G;
    if ([platform hasPrefix:@"iPhone1,2"])      return CWiDeviceModeliPhone3G;
    if ([platform hasPrefix:@"iPhone2"])        return CWiDeviceModeliPhone3GS;
    if ([platform hasPrefix:@"iPhone3"])        return CWiDeviceModeliPhone4;
    if ([platform hasPrefix:@"iPhone4"])        return CWiDeviceModeliPhone4S;
    if ([platform hasPrefix:@"iPhone5,1"] ||
        [platform hasPrefix:@"iPhone5,2"])      return CWiDeviceModeliPhone5;
    if ([platform hasPrefix:@"iPhone5,3"] ||
        [platform hasPrefix:@"iPhone5,4"])      return CWiDeviceModeliPhone5C;
    if ([platform hasPrefix:@"iPhone6"])        return CWiDeviceModeliPhone5S;
    
    
    // IPAD

    if ([platform hasPrefix:@"iPad1"])          return CWiDeviceModeliPad1G;
    if ([platform hasPrefix:@"iPad2,1"] ||
        [platform hasPrefix:@"iPad2,2"] ||
        [platform hasPrefix:@"iPad2,3"] ||
        [platform hasPrefix:@"iPad2,4"])        return CWiDeviceModeliPad2G;
    if ([platform hasPrefix:@"iPad2,5"] ||
        [platform hasPrefix:@"iPad2,6"] ||
        [platform hasPrefix:@"iPad2,7"])        return CWiDeviceModeliPadMini1G;
    if ([platform hasPrefix:@"iPad3,1"] ||
        [platform hasPrefix:@"iPad3,2"] ||
        [platform hasPrefix:@"iPad3,3"])        return CWiDeviceModeliPad3G;
    if ([platform hasPrefix:@"iPad3,4"] ||
        [platform hasPrefix:@"iPad3,5"] ||
        [platform hasPrefix:@"iPad3,6"])        return CWiDeviceModeliPad4G;
    if ([platform hasPrefix:@"iPad4,1"] ||
        [platform hasPrefix:@"iPad4,2"] ||
        [platform hasPrefix:@"iPad4,3"])        return CWiDeviceModeliPadAir;
    if ([platform hasPrefix:@"iPad4,4"] ||
        [platform hasPrefix:@"iPad4,5"] ||
        [platform hasPrefix:@"iPad4,6"])        return CWiDeviceModeliPadMini2G;
    
    
    // IPOD
    
    if ([platform hasPrefix:@"iPod1"])              return CWiDeviceModeliPod1G;
    if ([platform hasPrefix:@"iPod2"])              return CWiDeviceModeliPod2G;
    if ([platform hasPrefix:@"iPod3"])              return CWiDeviceModeliPod3G;
    if ([platform hasPrefix:@"iPod4"])              return CWiDeviceModeliPod4G;
    if ([platform hasPrefix:@"iPod5"])              return CWiDeviceModeliPod5G;
    
    if ([CWiDevice isiPhone])                       return CWiDeviceModelUnknowniPhone;
    if ([CWiDevice isiPad])                         return CWiDeviceModelUnknowniPad;
    if ([CWiDevice isiPod])                         return CWiDeviceModelUnknowniPod;
    
    if ([platform hasPrefix:@"iPhone"])             return CWiDeviceModelUnknowniPhone;
    if ([platform hasPrefix:@"iPod"])               return CWiDeviceModelUnknowniPod;
    if ([platform hasPrefix:@"iPad"])               return CWiDeviceModelUnknowniPad;
    
    return CWiDeviceModelUnknown;
}


+ (BOOL)isRetina {
    CWiDeviceModel model = [CWiDevice model];
    
    if ([CWiDevice isiPhone]) {
        if (model >= CWiDeviceModeliPhone4) return YES;
        return NO;
    }
    
    if ([CWiDevice isiPad]) {
        if (model >= CWiDeviceModeliPad3G) return YES;
        return NO;
    }
    
    if ([CWiDevice isiPod]) {
        if (model >= CWiDeviceModeliPod4G) return YES;
        return NO;
    }
    
    return YES; //for unknown models, we assume they are newer and have retina
}


+ (BOOL)isiPhone {
    return ([[CWiDevice platform] hasPrefix:@"iPhone"]);
}


+ (BOOL)isiPad {
    return ([[CWiDevice platform] hasPrefix:@"iPad"]);
}


+ (BOOL)isiPod {
    return ([[CWiDevice platform] hasPrefix:@"iPod"]);
}

@end
