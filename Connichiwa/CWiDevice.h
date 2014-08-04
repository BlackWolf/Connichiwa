//
//  CWiDevice.h
//  Connichiwa
//
//  Created by Mario Schreiner on 04/08/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



typedef NS_ENUM(NSInteger, CWiDeviceModel)
{
    CWiDeviceModelUnknown,
    
    CWiDeviceModeliPhone1G = 0,
    CWiDeviceModeliPhone3G = 1,
    CWiDeviceModeliPhone3GS = 2,
    CWiDeviceModeliPhone4 = 3,
    CWiDeviceModeliPhone4S = 4,
    CWiDeviceModeliPhone5 = 5,
    CWiDeviceModeliPhone5C = 6,
    CWiDeviceModeliPhone5S = 7,
    
    CWiDeviceModeliPad1G = 8,
    CWiDeviceModeliPad2G = 9,
    CWiDeviceModeliPadMini1G = 10,
    CWiDeviceModeliPad3G = 11,
    CWiDeviceModeliPad4G = 12,
    CWiDeviceModeliPadAir = 13,
    CWiDeviceModeliPadMini2G = 14,
    
    CWiDeviceModeliPod1G = 15,
    CWiDeviceModeliPod2G = 16,
    CWiDeviceModeliPod3G = 17,
    CWiDeviceModeliPod4G = 18,
    CWiDeviceModeliPod5G = 19,
    
    CWiDeviceModelUnknowniPhone = 97,
    CWiDeviceModelUnknowniPod = 98,
    CWiDeviceModelUnknowniPad = 99
    
};



@interface CWiDevice : NSObject

+ (CWiDeviceModel)model;
+ (BOOL)isRetina;
+ (BOOL)isiPhone;
+ (BOOL)isiPad;
+ (BOOL)isiPod;

@end
