//
//  CWBluetoothManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol CWBluetoothManagerDelegate <NSObject>

@optional
- (void)didStartScanning;
- (void)didStartAdvertisingWithIdentifier:(NSString *)identifier;

@end
