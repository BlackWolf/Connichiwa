//
//  CWBluetoothPeripheral.m
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothAdvertiser.h"
#import "CWConstants.h"
#import "CWDeviceID.h"
#import "CWDebug.h"
#import <CoreLocation/CoreLocation.h>



@interface CWBluetoothAdvertiser () <CBPeripheralManagerDelegate>

@property (readwrite, strong) CWDeviceID *myID;

@property (readwrite, strong) CBPeripheralManager *peripheralManager;
@property (readwrite, strong) CBMutableService *service;
@property (readwrite, strong) CBMutableCharacteristic *characteristic;

@end



@implementation CWBluetoothAdvertiser

- (void)startAdvertising
{
    DLog(@"Initializing CBPeripheralManager...");
    
    NSNumber *myMajor = [NSNumber numberWithUnsignedShort:(uint16_t)arc4random()];
    NSNumber *myMinor = [NSNumber numberWithUnsignedShort:(uint16_t)arc4random()];
    self.myID = [[CWDeviceID alloc] initWithMajor:myMajor minor:myMinor];
    
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:nil];
}


#pragma mark CBPeripheralManagerDelegate

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheralManager
{
    if (peripheralManager.state == CBCentralManagerStatePoweredOn)
    {
        DLog(@"Peripheral Manager Powered On - Advertising Service with Characteristic...");
        
        //TODO add willAdvertise
        
        [self.peripheralManager startAdvertising:@{ CBAdvertisementDataServiceUUIDsKey : @[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]] }];
        
        //TODO can we already send major/minor here to shorten the process?
        self.characteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID] properties:CBCharacteristicPropertyNotify value:nil permissions:CBAttributePermissionsReadable];
        
        self.service = [[CBMutableService alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID] primary:YES];
        self.service.characteristics = @[ self.characteristic ];
        
        [self.peripheralManager addService:self.service];
        
        //TODO add selector check
        [self.delegate didStartAdvertisingWithID:self.myID];
    }
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didSubscribeToCharacteristic:(CBCharacteristic *)characteristic
{
    //TODO should we keep a list of subscribed centrals? probably?
    
    DLog(@"Sending data to centrals...");
    NSData *test = [@"Thisisavalue" dataUsingEncoding:NSUTF8StringEncoding];
    BOOL didSend = [self.peripheralManager updateValue:test forCharacteristic:self.characteristic onSubscribedCentrals:nil];
    
    if (didSend == NO)
    {
        DLog(@"Could not send data to centrals");
    }
}


- (void)peripheralManagerIsReadyToUpdateSubscribers:(CBPeripheralManager *)peripheralManager
{
    //TODO we can continue sending data here if we want to
}


- (void)peripheralManager:(CBPeripheralManager *)peripheralManager central:(CBCentral *)central didUnsubscribeFromCharacteristic:(CBCharacteristic *)characteristic
{
    //stuuuuuff? do we even care?
}

@end
