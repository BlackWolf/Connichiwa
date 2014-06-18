//
//  CWBluetoothAdvertiserDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



@protocol CWBluetoothAdvertiserDelegate <NSObject>

- (void)willStartAdvertisingWithIdentifier:(NSString *)identifier;
- (void)didStartAdvertisingWithIdentifier:(NSString *)identifier;

@end
