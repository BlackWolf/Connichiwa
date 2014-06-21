//
//  CWBluetoothManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothManager.h"
#import "CWBluetoothConnection.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBluetoothManager () <CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate>

@property (readwrite, strong) CBCentralManager *centralManager;
@property (readwrite, strong) NSMutableArray *connections;

@property (readwrite, strong) NSString *identifier;
@property (readwrite, strong) CBPeripheralManager *peripheralManager;
@property (readwrite, strong) CBMutableService *advertisedService;
@property (readwrite, strong) CBMutableCharacteristic *advertisedCharacteristic;

@property (readwrite) BOOL wantsToStartScanning;
@property (readwrite) BOOL wantsToStartAdvertising;

@end



@implementation CWBluetoothManager


- (instancetype)init
{
    self = [super init];
    
    self.identifier = [[NSUUID UUID] UUIDString];
    
    dispatch_queue_t centralQueue = dispatch_queue_create("mycentralqueue", DISPATCH_QUEUE_SERIAL);
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:centralQueue];
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:centralQueue];
    
    self.advertisedCharacteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]
                                                                       properties:(CBCharacteristicPropertyNotify | CBCharacteristicPropertyWrite)
                                                                            value:nil
                                                                      permissions:(CBAttributePermissionsReadable | CBAttributePermissionsWriteable)];
    
    self.advertisedService = [[CBMutableService alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID] primary:YES];
    self.advertisedService.characteristics = @[ self.advertisedCharacteristic ];
    
    [self.peripheralManager addService:self.advertisedService];
    
    self.connections = [NSMutableArray array];
    self.wantsToStartScanning = NO;
    self.wantsToStartAdvertising = NO;
    
    return self;
}


- (void)startScanning
{
    if (self.centralManager.state == CBCentralManagerStatePoweredOn)
    {
        [self _doStartScanning];
    }
    else
    {
        self.wantsToStartScanning = YES;
    }
}


- (void)startAdvertising
{
    if (self.peripheralManager.state == CBPeripheralManagerStatePoweredOn)
    {
        [self _doStartAdvertising];
    }
    else
    {
        self.wantsToStartAdvertising = YES;
    }
}


- (void)stopScanning
{
    [self.centralManager stopScan];
}


- (void)stopAdvertising
{
    [self.peripheralManager stopAdvertising];
}


- (void)_doStartScanning
{
    DLog(@"Starting to scan for other BT devices...");
    [self.centralManager scanForPeripheralsWithServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]
                                                options:@{ CBCentralManagerScanOptionAllowDuplicatesKey : @NO }];
    
    if ([self.delegate respondsToSelector:@selector(didStartScanning)])
    {
        [self.delegate didStartScanning];
    }
}


- (void)_doStartAdvertising
{
    DLog(@"Starting to advertise to other BT devicesas %@...", self.identifier);
    [self.peripheralManager startAdvertising:@{ CBAdvertisementDataServiceUUIDsKey : @[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]] }];
    
    if ([self.delegate respondsToSelector:@selector(didStartAdvertisingWithIdentifier:)])
    {
        [self.delegate didStartAdvertisingWithIdentifier:self.identifier];
    }
}


#pragma mark Handling Connections


- (void)_connectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Connecting to BT device '%@'", peripheral.name);
    
    //It is rumored that scanning while connecting can lead to problems, therefore stop temporarily
    [self stopScanning];
    [self.centralManager connectPeripheral:peripheral options:nil];
}


- (void)_disconnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Disconnecting BT device '%@'", peripheral.name);
    [self.centralManager cancelPeripheralConnection:peripheral];
}


#pragma mark Sending & Receiving Data


- (void)_sendInitialToCentral:(CBCentral *)central
{
    NSDictionary *sendDictionary = @{
                                     @"type": @"initial",
                                     @"identifier": self.identifier
                                     };
    DLog(@"Writing value for own characteristic: %@ ", sendDictionary);
    NSData *initialData = [NSJSONSerialization dataWithJSONObject:sendDictionary options:NSJSONWritingPrettyPrinted error:nil];
    BOOL didSend = [self.peripheralManager updateValue:initialData forCharacteristic:self.advertisedCharacteristic onSubscribedCentrals:@[central]];
    
    if (didSend == NO)
    {
        DLog(@"Could not send data to central");
    }
}


- (void)_sendIPsToPeripheral:(CBPeripheral *)peripheral onCharacteristic:(CBCharacteristic *)characteristic
{
    NSArray *ips = [self _getInterfaceAddresses];
    for (NSString *ip in ips) {
        DLog(@"Writing value %@", @{@"type": @"ip", @"ip": ip});
        NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"type": @"ip", @"ip": ip} options:NSJSONWritingPrettyPrinted error:nil];
        [peripheral writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
    }
    
    [self _disconnectPeripheral:peripheral];
}


- (void)_sendToCentral
{
    
}


- (void)_sendToPeripheral
{
    
}


- (void)_receivedFromCentral
{
    
}


- (void)_receivedFromPeripheral
{
    
}


#pragma mark Helper


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


- (double)_distanceForMeasuredPower:(int)power RSSI:(double)RSSI
{
    if (RSSI == 0.0)
    {
        return -1.0;
    }
    
    //Based on http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing/20434019#20434019
    double distance = -1;
    double ratio = RSSI*1.0/power;
    if (ratio < 1.0) distance = pow(ratio, 10);
    else             distance = (0.89976) * pow(ratio, 7.7095) + 0.111;
    
    //Taken from https://github.com/sandeepmistry/node-bleacon/blob/master/lib/bleacon.js
    //    double distance = pow(12.0, 1.5 * ((rssi / power) - 1));
    
    return distance;
}


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
//            DLog(@"Interface %@ (family %d) with IP %@", [NSString stringWithUTF8String:temp_addr->ifa_name], temp_addr->ifa_addr->sa_family,[NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)]);
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


#pragma mark CBCentralManagerDelegate


- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
    if (central.state == CBCentralManagerStatePoweredOn && self.wantsToStartScanning == YES)
    {
        [self startScanning];
    }
    
    [CWDebug executeInDebug:^{
        NSString *stateString;
        switch (central.state)
        {
            case CBCentralManagerStatePoweredOn: stateString = @"PoweredOn"; break;
            case CBCentralManagerStateResetting: stateString = @"Resetting"; break;
            case CBCentralManagerStateUnsupported: stateString = @"Unsupported"; break;
            case CBCentralManagerStateUnauthorized: stateString = @"Unauthorized"; break;
            case CBCentralManagerStatePoweredOff: stateString = @"PoweredOff"; break;
            default: stateString = @"Unknown"; break;
        }
        DLog(@"Central Manager state changed to %@", stateString);
    }];
    
    NSArray *connectedPeripherals = [self.centralManager retrieveConnectedPeripheralsWithServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
    
    for (CBPeripheral *connectedPeripheral in connectedPeripherals)
    {
        DLog(@"Detected already connected peripheral %@", connectedPeripheral);
    }
}


- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
    DLog(@"CM didDiscoverPeripheral '%@'", peripheral.name);
    if ([self.connections containsObject:peripheral] == NO) [self.connections addObject:peripheral];
    [self _connectPeripheral:peripheral];
}


- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"CM didConnectPeripheral '%@'", peripheral.name);
    peripheral.delegate = self;
    //Sometimes we get a known peripheral that already has services, then we don't need to discover
//    if (peripheral.services)
//    {
//        [self peripheral:peripheral didDiscoverServices:nil];
//    } else
//    {
        [peripheral discoverServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
//    }
}


- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"CM: didDisconnectPeripheral '%@', error %@", peripheral.name, error);
}


- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"CM didFailToConnectPeripheral '%@', error %@", peripheral.name, error);
}

- (void)centralManager:(CBCentralManager *)central willRestoreState:(NSDictionary *)dict
{
    DLog(@"CM willRestoreState");
}


#pragma mark CBPeripheralDelegate


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
    DLog(@"P didDiscoverServices '%@', error %@", peripheral.name, error);
    for (CBService *service in peripheral.services)
    {
        DLog(@"Checking Service");
        if ([service.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]])
        {
            DLog(@"Is Correct Service");
            [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]]
                                     forService:service];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
    DLog(@"P didDiscoverCharacteristics '%@', error %@", peripheral.name, error);
    for (CBCharacteristic *characteristic in service.characteristics)
    {
        DLog(@"Checking Characteristic");
        if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_CHARACTERISTIC_UUID]])
        {
            DLog(@"Is Correct Characteristic");
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
            [self _sendIPsToPeripheral:peripheral onCharacteristic:characteristic];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"P didUpdateValueForCharacteristic: %@, error %@", [[NSString alloc] initWithData:characteristic.value encoding:NSUTF8StringEncoding], error);
}


- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"P didWriteValueForCharacteristic: %@, error %@", [[NSString alloc] initWithData:characteristic.value encoding:NSUTF8StringEncoding], error);
}


- (void)peripheralDidUpdateName:(CBPeripheral *)peripheral
{
    DLog(@"P didUpdateName '%@'", peripheral.name);
}

#pragma mark CBPeripheralManagerDelegate

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheralManager
{
    if (peripheralManager.state == CBCentralManagerStatePoweredOn && self.wantsToStartAdvertising == YES)
    {
        [self startAdvertising];
    }
    
    [CWDebug executeInDebug:^{
        NSString *stateString;
        switch (peripheralManager.state)
        {
            case CBPeripheralManagerStatePoweredOn: stateString = @"PoweredOn"; break;
            case CBPeripheralManagerStateResetting: stateString = @"Resetting"; break;
            case CBPeripheralManagerStateUnsupported: stateString = @"Unsupported"; break;
            case CBPeripheralManagerStateUnauthorized: stateString = @"Unauthorized"; break;
            case CBPeripheralManagerStatePoweredOff: stateString = @"PoweredOff"; break;
            default: stateString = @"Unknown"; break;
        }
        DLog(@"Peripheral Manager state changed to %@", stateString);
    }];
}


- (void)peripheralManagerIsReadyToUpdateSubscribers:(CBPeripheralManager *)peripheral
{
    DLog(@"PM isReadyToUpdateSubscribers");
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveReadRequest:(CBATTRequest *)request
{
    DLog(@"PM didReceiveReadRequest");
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveWriteRequests:(NSArray *)requests
{
    DLog(@"PM didReceiveWriteRequests");
    
    for (CBATTRequest *writeRequest in requests)
    {
        DLog(@"PM didReceiveWriteRequests request data is %@", [[NSString alloc] initWithData:writeRequest.value encoding:NSUTF8StringEncoding]);
    }
    
    [self.peripheralManager respondToRequest:[requests objectAtIndex:0] withResult:CBATTErrorSuccess];
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didSubscribeToCharacteristic:(CBCharacteristic *)characteristic
{
    DLog(@"PM centralDidSubscribeToCharacteristic");
    
    if (characteristic == self.advertisedCharacteristic)
    {
        [self _sendInitialToCentral:central];
    }
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didUnsubscribeFromCharacteristic:(CBCharacteristic *)characteristic
{
    DLog(@"PM centralDidUnsubscribeFromCharacteristic");
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral didAddService:(CBService *)service error:(NSError *)error
{
    DLog(@"PM didAddService, error %@", error);
}


- (void)peripheralManagerDidStartAdvertising:(CBPeripheralManager *)peripheral error:(NSError *)error
{
    DLog(@"PM didStartAdvertising, error %@", error);
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral willRestoreState:(NSDictionary *)dict
{
    DLog(@"PM willRestoreState");
}

@end
