//
//  CWBluetoothCentral.m
//  Connichiwa
//
//  Created by Mario Schreiner on 17/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothMonitor.h"
#import "CWBluetoothConnection.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBluetoothMonitor () <CBCentralManagerDelegate, CBPeripheralDelegate>

@property (readwrite, strong) CBCentralManager *centralManager;
@property (readwrite, strong) NSMutableArray *connections;

@end



@implementation CWBluetoothMonitor


- (void)startSearching
{
    DLog(@"Initializing CBCentralManager...");
    
    self.connections = [NSMutableArray array];
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
}


- (void)_disconnect:(CWBluetoothConnection *)connection
{
    CBPeripheral *peripheral = connection.peripheral;
    
    //If we are already subscribed to a characteristic, unsubscribe
    for (CBService *service in peripheral.services)
    {
        for (CBCharacteristic *characteristic in service.characteristics)
        {
            NSString *uuidString = [[NSString alloc] initWithData:characteristic.UUID.data encoding:NSUTF8StringEncoding];
            if (characteristic.isNotifying && [uuidString isEqualToString:BLUETOOTH_SERVICE_UUID])
            {
                [peripheral setNotifyValue:NO forCharacteristic:characteristic];
            }
        }
    }
    
    [self.centralManager cancelPeripheralConnection:peripheral];
}


- (CWBluetoothConnection *)_connectionForPeripheral:(CBPeripheral *)peripheral
{
    CWBluetoothConnection *foundConnection;
    for (CWBluetoothConnection *connection in self.connections)
    {
        CBPeripheral *connectionPeripheral = connection.peripheral;
        if ([connectionPeripheral.identifier.UUIDString isEqualToString:peripheral.identifier.UUIDString])
        {
            foundConnection = connection;
            break;
        }
    }
    
    return foundConnection;
}


//Based on http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing/20434019#20434019
- (double)_calculateDistanceForMeasuredPower:(int)power rssi:(double)rssi
{
    if (rssi == 0) {
        return -1.0;
    }
    
    double ratio = rssi*1.0/power;
    
    double distance = -1;
    if (ratio < 1.0) distance = pow(ratio, 10);
    else             distance = (0.89976) * pow(ratio, 7.7095) + 0.111;
    
    return distance;
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

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
    double distance = [self _calculateDistanceForMeasuredPower:-59 rssi:[RSSI doubleValue]];
    
    CWBluetoothConnection *existingConnection = [self _connectionForPeripheral:peripheral];
    if (existingConnection == nil)
    {
        DLog(@"Discovered Peripheral '%@', connecting...", peripheral.name);
        
        CWBluetoothConnection *newConnection = [[CWBluetoothConnection alloc] initWithPeripheral:peripheral];
        [self.connections addObject:newConnection];

        [self.centralManager connectPeripheral:peripheral options:nil];
        
        //Usually, this would be the place to send a "device detected" to the delegate
        //We can't do that, though, because we have to wait for the device to send us its unique ID
        //This means "device detected" will be sent only after we have actually connected
    }
    else if ([existingConnection hasIdentifier])
    {
        if ([self.delegate respondsToSelector:@selector(deviceWithIdentifier:changedDistance:)])
        {
           [self.delegate deviceWithIdentifier:existingConnection.identifier changedDistance:distance];
        }
    }
    
    //TODO we need to set a timeout here to detect lost beacons
}


- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Connected to '%@', discovering services...", peripheral.name);
    
    peripheral.delegate = self;
    [peripheral discoverServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
}


- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"Disconnected '%@'", peripheral.name);
    [self.connections removeObject:[self _connectionForPeripheral:peripheral]];
}


- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"Failed connecting to %@!", peripheral.name);
    
    [self _disconnect:[self _connectionForPeripheral:peripheral]];
}


#pragma mark CBPeripheralDelegate


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
    DLog(@"Discovered Services for '%@'", peripheral.name);
    
    if (error)
    {
        DLog(@"Error discovering services for peripheral '%@': %@", peripheral.name, error.localizedDescription);
        [self _disconnect:[self _connectionForPeripheral:peripheral]];
        return;
    }
    
    //Let's see if the peripheral contains our connichiwa service
    for (CBService *service in peripheral.services)
    {
        if ([service.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]])
        {
            DLog(@"Discovered Connichiwa Service for '%@', discovering characteristics...", peripheral.name);
            [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]] forService:service];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
    DLog(@"Disovered Characteristics for '%@'", peripheral.name);
    
    if (error)
    {
        DLog(@"Error discovering characteristics for peripheral '%@': %@", peripheral.name, error.localizedDescription);
        [self _disconnect:[self _connectionForPeripheral:peripheral]];
        return;
    }
    
    //Wohoo, we are finally there! Now enable notifications for the characteristics we found
    for (CBCharacteristic *characteristic in service.characteristics)
    {
        if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]])
        {
            DLog(@"Found Connichiwa Characteristic for '%@', enabling notifications...", peripheral.name);
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    if (error)
    {
        DLog(@"Error receiving data from peripheral '%@': %@", peripheral.name, error.localizedDescription);
        //[self _removeConnectedPeripheral:peripheral];
        return;
    }
    
    if (characteristic.value == nil) return;
    
    DLog(@"Received data from '%@'", peripheral.name);
    
    //Updating a characteristic's value is BTs way of sending data. Since we communicate using JSON, unpack the JSON...
    NSDictionary *retrievedData = [NSJSONSerialization JSONObjectWithData:characteristic.value options:0 error:nil];
    
    //We have a few messages that we can parse. We should probably define those somewhere, but for now...
    if ([retrievedData[@"type"] isEqualToString:@"identifier"])
    {
        DLog(@"Received Identifier: %@", retrievedData[@"identifier"]);
        
        CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
        [connection setIdentifier:retrievedData[@"identifier"]];
        
        //We have the remote device's unique ID, we can finally sent "device detected" to the delegate
        if ([self.delegate respondsToSelector:@selector(deviceDetectedWithIdentifier:)])
        {
            [self.delegate deviceDetectedWithIdentifier:connection.identifier];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateNotificationStateForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    NSString *uuidString = [[NSString alloc] initWithData:characteristic.UUID.data encoding:NSUTF8StringEncoding];
    if ([uuidString isEqualToString:BLUETOOTH_CHARACTERISTIC_UUID] == NO) return;
    
    if (error)
    {
        DLog(@"Error updating notification state of characteristic of peripheral '%@': %@", peripheral.name, error.localizedDescription);
        [self _disconnect:[self _connectionForPeripheral:peripheral]];
        return;
    }
    
    //If the characteristic's state changed to "don't notify" we should cleanup by disconnecting the peripheral
    //TODO shouldn't we check if OTHER characteristics are still set to notify?
    if (characteristic.isNotifying == NO)
    {
        [self _disconnect:[self _connectionForPeripheral:peripheral]];
    }
}

@end
