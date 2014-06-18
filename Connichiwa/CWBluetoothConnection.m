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
@synthesize identifier = _identifier;

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


- (BOOL)hasIdentifier
{
    return (self.identifier != nil);
}

#pragma mark Getter & Setter


- (NSString *)identifier
{
    return _identifier;
}

- (void)setIdentifier:(NSString *)identifier
{
    if (_identifier != nil) [NSException raise:@"Identifier of BT Connection cannot be changed" format:@"The Identifier of a CWBluetoothConnection can be set only once."];
    
    _identifier = identifier;
}



@end
