//
//  CWBluetoothCentral.m
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothCentral.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBluetoothCentral () <CBCentralManagerDelegate, CBPeripheralDelegate>

@property (readwrite, strong) CBCentralManager *centralManager;
@property (readwrite, strong) NSMutableArray *peripherals;

@end



@implementation CWBluetoothCentral


- (void)startSearching
{
    DLog(@"Initializing CBCentralManager...");
    
    self.peripherals = [NSMutableArray array];
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
}


- (void)_removeConnectedPeripheral:(CBPeripheral *)peripheral
{
    //If we are already subscribed to a characteristic, remove us
    //TODO not sure if this works with the supplied peripheral object, maybe we have to get one from the array?
    for (CBService *service in peripheral.services)
    {
        for (CBCharacteristic *characteristic in service.characteristics)
        {
            if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]] && characteristic.isNotifying)
            {
                [peripheral setNotifyValue:NO forCharacteristic:characteristic];
            }
        }
    }
    
    [self.centralManager cancelPeripheralConnection:peripheral];
}


#pragma mark CBCentralManagerDelegate


- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
    if (central.state == CBCentralManagerStatePoweredOn)
    {
        DLog(@"Central Manager state changed to PoweredOn - Start scanning for other Bluetooth devices...");
        [self.centralManager scanForPeripheralsWithServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]
                                                    options:@{ CBCentralManagerScanOptionAllowDuplicatesKey : @NO }];
    }
    
    
    [CWDebug executeInDebug:^{
        if ([central state] == CBPeripheralManagerStateUnknown) DLog(@"Central Manager state changed to Unknown");
        else if ([central state] == CBPeripheralManagerStateResetting) DLog(@"Central Manager state changed to Resetting");
        else if ([central state] == CBPeripheralManagerStateUnsupported) DLog(@"Central Manager state changed to Unsupported");
        else if ([central state] == CBPeripheralManagerStateUnauthorized) DLog(@"Central Manager state changed to Unauthorized");
        else if ([central state] == CBPeripheralManagerStatePoweredOff) DLog(@"Central Manager state changed to PoweredOff");
    }];
}


- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
    DLog(@"DETECTED %@", peripheral);
    //TODO containsObject will not work ^^
    if ([self.peripherals containsObject:peripheral] == NO)
    {
        DLog(@"Discovered Peripheral %@, connecting...", peripheral.name);
        [self.peripherals addObject:peripheral];
        [self.centralManager connectPeripheral:peripheral options:nil];
    }
}


- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Connected to %@, discovering services...", peripheral.name);
    
    peripheral.delegate = self;
    [peripheral discoverServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
}


- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    [self.peripherals removeObject:peripheral];
}


- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"Failed connecting to %@!", peripheral.name);
    [self _removeConnectedPeripheral:peripheral];
}


#pragma mark CBPeripheralDelegate


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
    if (error)
    {
        DLog(@"Error discovering services for peripheral %@: %@", peripheral.name, error.localizedDescription);
        [self _removeConnectedPeripheral:peripheral];
        return;
    }
    
    //Let's see if the peripheral contains our connichiwa service
    for (CBService *service in peripheral.services)
    {
        DLog(@"Comparing %@ to %@", service.UUID.UUIDString, BLUETOOTH_SERVICE_UUID);
        if ([service.UUID.UUIDString isEqualToString:BLUETOOTH_SERVICE_UUID])
        {
            [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]] forService:service];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
    if (error)
    {
        DLog(@"Error discovering characteristics for peripheral %@: %@", peripheral.name, error.localizedDescription);
        [self _removeConnectedPeripheral:peripheral];
        return;
    }
    
    //Wohoo, we are finally there! Now enable notifications for the characteristics we found
    for (CBCharacteristic *characteristic in service.characteristics)
    {
        DLog(@"Comparing CH %@ to %@", characteristic.UUID.UUIDString, BLUETOOTH_CHARACTERISTIC_UUID);
        if ([characteristic.UUID.UUIDString isEqualToString:BLUETOOTH_CHARACTERISTIC_UUID])
        {
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"NOTIFY");
    if (error)
    {
        DLog(@"Error receiving data from peripheral %@: %@", peripheral.name, error.localizedDescription);
        //[self _removeConnectedPeripheral:peripheral];
        return;
    }
    
    //Updating a characeristic's value means sending data - so get the data we received
    NSString *dataString = [[NSString alloc] initWithData:characteristic.value encoding:NSUTF8StringEncoding];
    DLog(@"Received data from %@: %@", peripheral.name, dataString);
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateNotificationStateForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    if ([characteristic.UUID.UUIDString isEqualToString:BLUETOOTH_CHARACTERISTIC_UUID] == NO) return;
    
    if (error)
    {
        DLog(@"Error updating notification state of characteristic of peripheral %@: %@", peripheral.name, error.localizedDescription);
        [self _removeConnectedPeripheral:peripheral];
        return;
    }
    
    //If the characteristic's state changed to "don't notify" we should cleanup by disconnecting the peripheral
    //TODO shouldn't we check if OTHER characteristics are still set to notify?
    if (characteristic.isNotifying == NO)
    {
        [self _removeConnectedPeripheral:peripheral];
    }
}

@end
