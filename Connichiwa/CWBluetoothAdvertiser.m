//
//  CWBluetoothPeripheral.m
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothAdvertiser.h"
#import "CWConstants.h"
#import "CWDebug.h"
#import <CoreLocation/CoreLocation.h>



@interface CWBluetoothAdvertiser () <CBPeripheralManagerDelegate>

@property (readwrite, strong) NSString *identifier;

@property (readwrite, strong) CBPeripheralManager *peripheralManager;
@property (readwrite, strong) CBMutableService *service;
@property (readwrite, strong) CBMutableCharacteristic *characteristic;

@end



@implementation CWBluetoothAdvertiser

- (void)startAdvertising
{
    DLog(@"Initializing CBPeripheralManager...");
    
    //Generate random identifier under which we will advertise
    self.identifier = [[NSUUID UUID] UUIDString];
    
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:nil];
}


#pragma mark CBPeripheralManagerDelegate

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheralManager
{
    if (peripheralManager.state == CBCentralManagerStatePoweredOn)
    {
        DLog(@"Peripheral Manager Powered On - Advertising Service with Characteristic...");
        
        if ([self.delegate respondsToSelector:@selector(willStartAdvertisingWithIdentifier:)])
        {
            [self.delegate willStartAdvertisingWithIdentifier:self.identifier];
        }
        
        [self.peripheralManager startAdvertising:@{ CBAdvertisementDataServiceUUIDsKey : @[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]] }];
        
        self.characteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID] properties:CBCharacteristicPropertyNotify value:nil permissions:CBAttributePermissionsReadable];
        
        self.service = [[CBMutableService alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID] primary:YES];
        self.service.characteristics = @[ self.characteristic ];
        
        [self.peripheralManager addService:self.service];
        
        if ([self.delegate respondsToSelector:@selector(didStartAdvertisingWithIdentifier:)])
        {
           [self.delegate didStartAdvertisingWithIdentifier:self.identifier];
        }
        
    }
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didSubscribeToCharacteristic:(CBCharacteristic *)characteristic
{
    //TODO should we keep a list of subscribed centrals? probably?
    
    DLog(@"Sending data to centrals...");
    NSDictionary *sendDictionary = @{
                                     @"type": @"identifier",
                                     @"identifier": self.identifier
                                     };
    NSData *initialData = [self _JSONFromDictionary:sendDictionary];
    //NSData *test = [@"Thisisavalue" dataUsingEncoding:NSUTF8StringEncoding];
    BOOL didSend = [self.peripheralManager updateValue:initialData forCharacteristic:self.characteristic onSubscribedCentrals:nil];
    
    if (didSend == NO)
    {
        DLog(@"Could not send data to centrals");
    }
}

/** TODO duplicate from CWWebserver - move to common utility class? **/
- (NSData *)_JSONFromDictionary:(NSDictionary *)dictionary
{
    NSError *error;
    NSData *data = [NSJSONSerialization dataWithJSONObject:dictionary options:JSON_WRITING_OPTIONS error:&error];
    
    if (error)
    {
        [NSException raise:@"Invalid Dictionary for serialization" format:@"Dictionary could not be serialized to JSON: %@", dictionary];
    }
    
    //Create the actual JSON
    //The JSON spec says that quotes and newlines must be escaped - not doing so will produce an "unexpected EOF" error
    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    json = [json stringByReplacingOccurrencesOfString:@"\'" withString:@"\\\'"];
    json = [json stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
    json = [json stringByReplacingOccurrencesOfString:@"\n" withString:@"\\n"];
    json = [json stringByReplacingOccurrencesOfString:@"\r" withString:@""];
    
    return data;
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
