//
//  CWBluetoothCentral.m
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothMonitor.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBluetoothMonitor () <CBCentralManagerDelegate, CBPeripheralDelegate>

@property (readwrite, strong) CBCentralManager *centralManager;
@property (readwrite, strong) NSMutableArray *peripherals;

@end



@implementation CWBluetoothMonitor


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
                                                    options:@{ CBCentralManagerScanOptionAllowDuplicatesKey : @YES }];
    }
    
    
    [CWDebug executeInDebug:^{
        if ([central state] == CBPeripheralManagerStateUnknown) DLog(@"Central Manager state changed to Unknown");
        else if ([central state] == CBPeripheralManagerStateResetting) DLog(@"Central Manager state changed to Resetting");
        else if ([central state] == CBPeripheralManagerStateUnsupported) DLog(@"Central Manager state changed to Unsupported");
        else if ([central state] == CBPeripheralManagerStateUnauthorized) DLog(@"Central Manager state changed to Unauthorized");
        else if ([central state] == CBPeripheralManagerStatePoweredOff) DLog(@"Central Manager state changed to PoweredOff");
    }];
}

static NSString *lastDistance = @"";
static BOOL wasAdded = NO;
static int counter = 0;

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
    //Check if we detected this peripheral before
    CBPeripheral *existingPeripheral;
    for (CBPeripheral *peripheralToCheck in self.peripherals)
    {
        if ([peripheralToCheck.identifier.UUIDString isEqualToString:peripheral.identifier.UUIDString])
        {
            existingPeripheral = peripheralToCheck;
            break;
        }
    }
    
    CWDeviceID *blahID = [[CWDeviceID alloc] initWithMajor:@17 minor:@18];
    
    NSString *distance = [self calculateProximityWithTxPower:-59 rssi:[RSSI doubleValue]];
    if (existingPeripheral == nil)
    {
        DLog(@"Discovered Peripheral %@, connecting...", peripheral.name);
        [self.peripherals addObject:peripheral];
        [self.centralManager connectPeripheral:peripheral options:nil];
        
                if (wasAdded == NO) {
        [self.delegate beaconDetectedWithID:blahID inProximity:distance];
                    wasAdded = YES;
                }
    } else
    {
        if ([distance isEqualToString:lastDistance] == NO) {
            [self.delegate beaconWithID:blahID changedProximity:distance];
        }
    }
    
    lastDistance = distance;
    
    //TODO we need to set a timeout to detect lost beacons
}

- (NSString *)calculateProximityWithTxPower:(int)txPower rssi:(double)rssi
{
    if (rssi == 0) {
//        return -1.0; // if we cannot determine accuracy, return -1.
        return @"unknown";
    }
    
    double ratio = rssi*1.0/txPower;
    double accuracy = -1;
    if (ratio < 1.0) {
        accuracy = pow(ratio,10);
    }
    else {
        accuracy =  (0.89976)*pow(ratio,7.7095) + 0.111;
    }
    
    if (accuracy <= 0) return @"unknown";
    else if (accuracy < 0.5) return @"immediate";
    else if (accuracy < 4.0) return @"near";
    else return @"far";
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
        //if (service.UUID != nil && [service.UUID.UUIDString isEqualToString:BLUETOOTH_SERVICE_UUID])
        NSString *uuidString = [[NSString alloc] initWithData:service.UUID.data encoding:NSUTF8StringEncoding];
        DLog(@"Comparing %@ to %@", uuidString, BLUETOOTH_SERVICE_UUID);
        if ([uuidString isEqualToString:BLUETOOTH_SERVICE_UUID])
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
        //if (characteristic.UUID != nil && [characteristic.UUID.UUIDString isEqualToString:BLUETOOTH_CHARACTERISTIC_UUID])
        NSString *uuidString = [[NSString alloc] initWithData:service.UUID.data encoding:NSUTF8StringEncoding];
        if ([uuidString isEqualToString:BLUETOOTH_CHARACTERISTIC_UUID])
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
