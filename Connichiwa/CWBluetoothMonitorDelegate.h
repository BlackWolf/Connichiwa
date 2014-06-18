//
//  CWBluetoothMonitorDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



@protocol CWBluetoothMonitorDelegate <NSObject>

- (void)deviceDetectedWithIdentifier:(NSString *)identifier;
- (void)deviceWithIdentifier:(NSString *)identifier changedDistance:(double)distance;
- (void)deviceLostWithIdentifier:(NSString *)identifier;

@end
