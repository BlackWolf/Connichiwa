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
    
    dispatch_queue_t centralQueue = dispatch_queue_create("mycentralqueue", DISPATCH_QUEUE_SERIAL);
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:centralQueue];
}


- (void)handshakeWebsocketConnection:(NSString *)identifier
{
    [self.centralManager stopScan];
    
    CWBluetoothConnection *connection = [self _connectionForIdentifier:identifier];
    [connection setState:CWBluetoothConnectionStateRequestedConnection];
    [self.centralManager connectPeripheral:connection.peripheral options:nil];
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



- (CWBluetoothConnection *)_connectionForIdentifier:(NSString *)identifier
{
    CWBluetoothConnection *foundConnection;
    for (CWBluetoothConnection *connection in self.connections)
    {
        if ([connection.identifier isEqualToString:identifier])
        {
            foundConnection = connection;
            break;
        }
    }
    
    return foundConnection;
}


- (double)_calculateDistanceForMeasuredPower:(int)power rssi:(double)rssi
{
    if (rssi == 0.0)
    {
        return -1.0;
    }

    //Based on http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing/20434019#20434019
    double distance = -1;
    double ratio = rssi*1.0/power;
    if (ratio < 1.0) distance = pow(ratio, 10);
    else             distance = (0.89976) * pow(ratio, 7.7095) + 0.111;
    
    //Taken from https://github.com/sandeepmistry/node-bleacon/blob/master/lib/bleacon.js
//    double distance = pow(12.0, 1.5 * ((rssi / power) - 1));
    
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
    CWBluetoothConnection *existingConnection = [self _connectionForPeripheral:peripheral];
    if (peripheral.state == CBPeripheralStateDisconnected && (existingConnection == nil || existingConnection.state == CWBluetoothConnectionStateRequestedConnection || existingConnection.state == CWBluetoothConnectionStateErrored))
    {
        DLog(@"Discovered Peripheral '%@', connecting...", peripheral.name);
        
        CWBluetoothConnection *newConnection = [[CWBluetoothConnection alloc] initWithPeripheral:peripheral];
        [newConnection setState:CWBluetoothConnectionStateDiscovered];
        [newConnection addNewRSSIMeasure:[RSSI doubleValue]];
        [self.connections addObject:newConnection];

        [self.centralManager stopScan];
        [self.centralManager cancelPeripheralConnection:peripheral];
        [self.centralManager connectPeripheral:peripheral options:nil];
    
        //Usually, this would be the place to send a "device detected" to the delegate
        //We can't do that, though, because we have to wait for the device to send us its unique ID
        //This means "device detected" will be sent only after we have actually connected
    }
    else if ([existingConnection hasIdentifier])
    {
        [existingConnection addNewRSSIMeasure:[RSSI doubleValue]];
        
        if ([self.delegate respondsToSelector:@selector(deviceWithIdentifier:changedDistance:)])
        {
            //We only send an updated distance at certain conditions
            //  - at least 0.1 seconds passed since we last sent it (to prevent flooding, regardless what happens)
            //  - more than five seconds passed since we last sent it
            //  - the distance changed more than 0.1 meters since we last sent it
            double distance = [self _calculateDistanceForMeasuredPower:-62 rssi:[existingConnection averageRSSI]];
            double savedDistance = [self _calculateDistanceForMeasuredPower:-62 rssi:[existingConnection savedRSSI]];
            if ([existingConnection timeSinceRSSISave] > 0.1 && ([existingConnection timeSinceRSSISave] >= 5.0 || fabs(distance-savedDistance) > 0.2))
            {
//                DLog(@"Sending new distance %.2f with time elapsed %.2f and distance diff %.2f", distance, [existingConnection timeSinceRSSISave], fabs(distance-savedDistance));
                [existingConnection saveCurrentRSSI];
                [self.delegate deviceWithIdentifier:existingConnection.identifier changedDistance:distance];
            }
        }
    }
    
    //TODO we need to set a timeout here to detect lost beacons
}


- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Connected to '%@', discovering services...", peripheral.name);
    
    [self.centralManager scanForPeripheralsWithServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]
                                                options:@{ CBCentralManagerScanOptionAllowDuplicatesKey : @YES }];
    
    peripheral.delegate = self;
    if (peripheral.services)
    {
        [self peripheral:peripheral didDiscoverServices:nil];
    } else
    {
        [peripheral discoverServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
    }
}


- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"Disconnected '%@'. Reason: %@", peripheral.name, error);
    //[self.connections removeObject:[self _connectionForPeripheral:peripheral]];
    
    //
    //TODO
    //Should we delete the connection on error?
    //Probably not, but we NEED to introduce a state to CWBluetoothConnection so we know if we have successfully transfered the initial data
    //If we have transferred the initial data, discovering the peripheral should not lead to a connect. otherwise it should.
    //
    
    //
    //
    //
    // !!! TODO !!!
    //We need to keep the CWBluetoothConnection, so introduce a state there
    //Then, provide a method to the web lib to connect to a certain ID
    //This will reconnect to the peripheral as soon as possible and transmit the IP it needs to display
    //
    //
    //
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
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    
    //Wohoo, we are finally there! Now enable notifications for the characteristics we found
    for (CBCharacteristic *characteristic in service.characteristics)
    {
        if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]])
        {
            DLog(@"Found Connichiwa Characteristic for '%@', enabling notifications...", peripheral.name);
            
            if (connection.state == CWBluetoothConnectionStateDiscovered)
            {
                [connection setState:CWBluetoothConnectionStateWaitingForInitialData];
                [peripheral setNotifyValue:YES forCharacteristic:characteristic];
            }
            else if (connection.state == CWBluetoothConnectionStateRequestedConnection)
            {
                [peripheral setNotifyValue:YES forCharacteristic:characteristic];
                NSArray *ips = [self _getInterfaceAddresses];
                for (NSString *ip in ips) {
                    NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"type": @"ip", @"ip": ip} options:NSJSONWritingPrettyPrinted error:nil];
                    [peripheral writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
                }
                [connection setState:CWBluetoothConnectionStateDone];
                [self _disconnect:connection];
                //NSDictionary *data = @{ @"type" : @"ips", @"ips" : ips };
                //[peripheral writeValue:[self _JSONFromDictionary:data] forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse]; //TODO change to with response
            }
        }
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

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    if (error)
    {
        DLog(@"Error receiving data from peripheral '%@': %@", peripheral.name, error.localizedDescription);
        //[self _removeConnectedPeripheral:peripheral];
        return;
    }
    
    if (characteristic.value == nil) return;
    
    
    
    //Updating a characteristic's value is BTs way of sending data. Since we communicate using JSON, unpack the JSON...
    NSDictionary *retrievedData = [NSJSONSerialization JSONObjectWithData:characteristic.value options:0 error:nil];
    DLog(@"Received data from '%@': %@", peripheral.name, retrievedData);
    
    //We have a few messages that we can parse. We should probably define those somewhere, but for now just do it...
    if ([retrievedData[@"type"] isEqualToString:@"initial"])
    {
        CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
        [connection setIdentifier:retrievedData[@"identifier"]];
        
        //After receiving the initial data, we disconnect the device
        //We will reconnect to it if the web library sends us a connection request for that device
        [self _disconnect:connection];
        
        [connection setState:CWBluetoothConnectionStateDisconnectedAfterInitialData];
        
        //We have the remote device's unique ID, we can finally sent "device detected" to the delegate
        if ([self.delegate respondsToSelector:@selector(deviceDetectedWithIdentifier:)])
        {
            [self.delegate deviceDetectedWithIdentifier:connection.identifier];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateNotificationStateForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]]) return;
    
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


#pragma mark Helper


#include <ifaddrs.h>
#include <arpa/inet.h>

/* Thanks to
 http://stackoverflow.com/questions/3434192/alternatives-to-nshost-in-iphone-app and
 http://zachwaugh.me/posts/programmatically-retrieving-ip-address-of-iphone/
 */
- (NSArray *)_getInterfaceAddresses
{
    struct ifaddrs *interfaces = NULL;
    struct ifaddrs *temp_addr = NULL;
    int success = 0;
    
    NSMutableArray *ips = [NSMutableArray arrayWithCapacity:1];
    
    // retrieve the current interfaces - returns 0 on success
    success = getifaddrs(&interfaces);
    if (success == 0) {
        // Loop through linked list of interfaces
        temp_addr = interfaces;
        while (temp_addr != NULL) {
            DLog(@"Interface %@ (family %d) with IP %@", [NSString stringWithUTF8String:temp_addr->ifa_name], temp_addr->ifa_addr->sa_family,[NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)]);
            //if( temp_addr->ifa_addr->sa_family == AF_INET) {
            // The first en-interface should be WiFi, the last should be BT - on an iPhone, the GSM interface might be inbetween
            // Also, when connected via BT Hotspot (PAN), the correct BT IP might be in one of the "bridge" interfaces
            //if ([[NSString stringWithUTF8String:temp_addr->ifa_name] hasPrefix:@"en"]) {
            // Get NSString from C String
            NSString *ip = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)];
            
            if ([ip hasPrefix:@"0."] == NO && [ip hasPrefix:@"127."] == NO) {
                [ips addObject:ip];
            }
            //}
            //}
            
            temp_addr = temp_addr->ifa_next;
        }
    }
    
    // Free memory
    freeifaddrs(interfaces);
    
    //Remove duplicates
    NSMutableArray *finalIps = [NSMutableArray arrayWithCapacity:[ips count]];
    for (NSString *ip in ips) {
        if (![finalIps containsObject:ip]) {
            [finalIps addObject:ip];
        }
    }
    
    return finalIps;
}

@end
