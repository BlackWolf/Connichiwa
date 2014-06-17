//
//  CWBluetoothConnection.m
//  Connichiwa
//
//  Created by Mario Schreiner on 18/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothConnection.h"
#import <CoreBluetooth/CoreBluetooth.h>



@interface CWBluetoothConnection ()

@property (readwrite, strong) CBPeripheral *peripheral;

@end

@implementation CWBluetoothConnection

- (instancetype)init
{
    [NSException raise:@"Bluetooth connection cannot be instantiated without a peripheral" format:@"Bluetooth connection cannot be instantiated without a peripheral. Use -initWithPeripheral: instead."];
    return nil;
}


- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral
{
    self = [super init];
    
    self.peripheral = peripheral;
    
    return self;
}

@end
