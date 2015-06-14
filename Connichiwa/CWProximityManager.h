//
//  CWProximitySensor.h
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/15.
//  Copyright (c) 2015 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "CWProximityManagerDelegate.h"


@interface CWProximityManager : NSObject

@property (readwrite) id<CWProximityManagerDelegate> delegate;

-(void)startMonitoring;
-(void)stopMonitoring;

@end
