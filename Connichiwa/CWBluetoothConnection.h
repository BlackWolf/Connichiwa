//
//  CWBluetoothConnection.h
//  Connichiwa
//
//  Created by Mario Schreiner on 18/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
@class CBPeripheral, CWDeviceID;



@interface CWBluetoothConnection : NSObject

@property (readwrite, strong) NSString *identifier;
@property (readonly) CBPeripheral *peripheral;

- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral;
- (BOOL)hasIdentifier;

@end
