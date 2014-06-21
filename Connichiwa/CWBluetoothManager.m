//
//  CWBluetoothManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothManager.h"
#import "CWBluetoothConnection.h"
#import "CWUtil.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWBluetoothManager () <CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate>

@property (readwrite, strong) CBCentralManager *centralManager;
@property (readwrite, strong) NSMutableArray *connections;

@property (readwrite, strong) NSString *identifier;
@property (readwrite, strong) CBPeripheralManager *peripheralManager;
@property (readwrite, strong) CBMutableService *advertisedService;
@property (readwrite, strong) CBMutableCharacteristic *advertisedInitialCharacteristic;
@property (readwrite, strong) CBMutableCharacteristic *advertisedIPCharacteristic;

@property (readwrite) BOOL wantsToStartScanning;
@property (readwrite) BOOL wantsToStartAdvertising;
@property (readwrite) int pendingCharacteristicWrites;

@end



/**
 *  The CWBluetoothManager represents this device as a BT device. It can advertise this device to other devices and monitor for other devices. Furthermore, the delegate
 *  is notified of important events, for example detected devices, changes in device distance or established connections.
 *  
 *  There are two major features when it comes to communicating with other BT devices: The initial data transfer and the IP data transfer.
 *
 *  The initial data transfer can be used by this device to receive information about another device - most importantly this includes the other device's unique identifier (which is different from the BT identifier, as the BT identifier is NOT unique). The device's unique identifier can be used to identify the device across all Connichiwa components - this means the identifier will also be sent to the web library and web application. As every remote device needs to have an identifier, the initial data transfer is invoked automatically by this manager when a new device is detected. There is no manual way to trigger the transfer and there is no way to prevent it. Once the initial data of a device was received, the device is reported to the delegate as a newly detected device.
 *  Technically, the initial data transfer is invoked by our central subscribing to the other device's peripheral's initial BT characteristic. The other device will take a subscription to that characteristic as a request for the initial data and begin the data transfer. Therefore, the initial data transfer is a peripheral->central data transfer. Once the initial data transfer is complete, the BT connection to the device will be cut, but the CWBluetoothConnection will remain.
 *  
 *  The IP data transfer is not triggered automatically, but can be triggered by calling the sendNetworkAddresses: method. This will trigger a reconnect to the other device and this device will then transfer its network interface addresses to the other device - one of those should work to connect to our local webserver, but it is the responsibility of the other device to figure our the correct address. Once the other device received the addresses, it will find the correct one and should then open a webview with that address, effectively establishing a connection to our web library. This will then allow us to use that device as a remote device.
 *  Technically, this is achieved by our central subscribing to the other device's peripheral's IP BT characteristic. The IP characteristic is writeable and therefore allows us to send our network interface addresses to the other device. All other data sent will be ignored.
 */
@implementation CWBluetoothManager


- (instancetype)init
{
    self = [super init];
    
    self.identifier = [[NSUUID UUID] UUIDString];
    
    dispatch_queue_t centralQueue = dispatch_queue_create("connichiwacentralqueue", DISPATCH_QUEUE_SERIAL);
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:centralQueue];
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:centralQueue];
    
    //When a central subscribes to the initial characteristic, we will sent it our initial device data, including our unique identifier
    self.advertisedInitialCharacteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]
                                                                       properties:CBCharacteristicPropertyNotify
                                                                            value:nil
                                                                      permissions:CBAttributePermissionsReadable];
    
    //A central can subscribe to the IP characteristic when it wants to use our device as a remote device
    //The characteristic is writeable and allows the central to send us its
    self.advertisedIPCharacteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]
                                                                              properties:CBCharacteristicPropertyWrite
                                                                                   value:nil
                                                                             permissions:CBAttributePermissionsWriteable];
    
    self.advertisedService = [[CBMutableService alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID] primary:YES];
    self.advertisedService.characteristics = @[ self.advertisedInitialCharacteristic, self.advertisedIPCharacteristic ];
    
    [self.peripheralManager addService:self.advertisedService];
    
    self.connections = [NSMutableArray array];
    self.wantsToStartScanning = NO;
    self.wantsToStartAdvertising = NO;
    self.pendingCharacteristicWrites = 0;
    
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
    DLog(@"Stop scanning for other BT devices");
    self.wantsToStartScanning = NO;
    [self.centralManager stopScan];
}


- (void)stopAdvertising
{
    DLog(@"Stop advertising to other BT devices");
    self.wantsToStartAdvertising = NO;
    [self.peripheralManager stopAdvertising];
}


- (void)sendNetworkAddressesToDevice:(NSString *)deviceIdentifier
{
    CWBluetoothConnection *connection = [self _connectionForIdentifier:deviceIdentifier];
    
    if (connection == nil)
    {
        DLog(@"Invalid device identifier to send network addresses to, %@", deviceIdentifier);
        return;
    }
    
    [connection setState:CWBluetoothConnectionStateIPConnecting];
    [self _connectPeripheral:connection.peripheral];
}


- (void)_doStartScanning
{
    DLog(@"Starting to scan for other BT devices...");
    [self.centralManager scanForPeripheralsWithServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]
                                                options:@{ CBCentralManagerScanOptionAllowDuplicatesKey : @YES }];
    
    if ([self.delegate respondsToSelector:@selector(didStartScanning)])
    {
        [self.delegate didStartScanning];
    }
}


- (void)_doStartAdvertising
{
    DLog(@"Starting to advertise to other BT devices with identifier %@...", self.identifier);
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


- (void)_addRSSIMeasure:(double)RSSI toConnection:(CWBluetoothConnection *)connection
{
    if (connection.state == CWBluetoothConnectionStateErrored) return;
    
    [connection addNewRSSIMeasure:RSSI];
    
    if ([self.delegate respondsToSelector:@selector(device:changedDistance:)])
    {
        //We only send an "updated distance" message at certain conditions to prevent flooding:
        //  - only when the device is ready to be used
        //  - only when at least 0.1 seconds passed since we sent the last
        //  - when more than five seconds passed since we last sent the last
        //  - when the distance changed more than 0.1 meters since we sent the last
        if ([connection isReady] == NO) return;
        
        double distance = [connection averageDistance];
        double lastSentDistance = [connection lastSentDistance];
        if ([connection timeSinceLastSentRSSI] > 0.1 && ([connection timeSinceLastSentRSSI] >= 5.0 || fabs(distance-lastSentDistance) > 0.1))
        {
//            DLog(@"Sending new distance %.2f with time elapsed %.2f and distance diff %.2f", distance, [connection timeSinceLastSentRSSI], fabs(distance-lastSentDistance));
            [self.delegate device:connection.identifier changedDistance:distance];
            [connection didSendDistance];
        }
    }
}


#pragma mark Sending & Receiving Data


- (void)_sendInitialToCentral:(CBCentral *)central
{
    NSDictionary *sendDictionary = @{ @"identifier": self.identifier };
    DLog(@"Writing value for own characteristic: %@ ", sendDictionary);
    NSData *initialData = [NSJSONSerialization dataWithJSONObject:sendDictionary options:NSJSONWritingPrettyPrinted error:nil];
    BOOL didSend = [self.peripheralManager updateValue:initialData forCharacteristic:self.advertisedInitialCharacteristic onSubscribedCentrals:@[central]];
    
    if (didSend == NO)
    {
        DLog(@"Could not send data to central");
    }
}


- (void)_sendIPsToPeripheral:(CBPeripheral *)peripheral onCharacteristic:(CBCharacteristic *)characteristic
{
    NSArray *ips = [CWUtil deviceInterfaceAddresses];
    for (NSString *ip in ips) {
        DLog(@"Writing value %@", @{ @"ip": ip } );
        NSData *data = [NSJSONSerialization dataWithJSONObject:@{ @"ip": ip } options:NSJSONWritingPrettyPrinted error:nil];
        [peripheral writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
        self.pendingCharacteristicWrites++;
    }
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


- (CWBluetoothConnection *)_connectionForPeripheral:(CBPeripheral *)peripheral
{
    CWBluetoothConnection *foundConnection;
    for (CWBluetoothConnection *connection in self.connections)
    {
        if ([connection.peripheral isEqual:peripheral])
        {
            foundConnection = connection;
            break;
        }
    }
    
    return foundConnection;
}


#pragma mark CBCentralManagerDelegate


- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
    //If -startScanning was already called, call it again
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
}


- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
//    DLog(@"CM didDiscoverPeripheral '%@'", peripheral.name);
    
    CWBluetoothConnection *existingConnection = [self _connectionForPeripheral:peripheral];
    
    if (existingConnection == nil)
    {
        DLog(@"Peripheral '%@' is new", peripheral.name);
        
        //A new peripheral was detected. Before we can report it to the delegate, we need its unique identifier
        //Therefore, connect to the peripheral, discover its "initial" characteristic and receive the initial connection data that contains the identifier
        CWBluetoothConnection *newConnection = [[CWBluetoothConnection alloc] initWithPeripheral:peripheral];
        [newConnection setState:CWBluetoothConnectionStateInitialConnecting];
        [self.connections addObject:newConnection];
        
        [self _connectPeripheral:peripheral];
    }
    else
    {
        [self _addRSSIMeasure:[RSSI doubleValue] toConnection:existingConnection];
    }
}


- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"CM didConnectPeripheral '%@'", peripheral.name);
    
    //In _connectPeripheral we stop scanning while connecting, so we need to resume scanning now
    [self startScanning];
    
    peripheral.delegate = self;
    [peripheral discoverServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
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
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    BOOL foundValidService = NO;
    for (CBService *service in peripheral.services)
    {
        if ([service.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]])
        {
            if (connection.state == CWBluetoothConnectionStateInitialConnecting)
            {
                [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]] forService:service];
                foundValidService = YES;
            }
            else if (connection.state == CWBluetoothConnectionStateIPConnecting)
            {
                [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]] forService:service];
                foundValidService = YES;
            }
        }
    }
    
    if (foundValidService == NO)
    {
        DLog(@"No valid services found for '%@', device is ignored...", peripheral.name);
        [connection setState:CWBluetoothConnectionStateErrored];
        [self _disconnectPeripheral:peripheral];
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
    DLog(@"P didDiscoverCharacteristics '%@', error %@", peripheral.name, error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    BOOL foundValidCharacteristic = NO;
    for (CBCharacteristic *characteristic in service.characteristics)
    {
        //The initial characteristic supports notify only
        //Subscribing to the notifications will call the peripheralManager:central:didSubscribeToCharacteristic: of the other device and trigger the initial data transfer
        if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]])
        {
            [connection setState:CWBluetoothConnectionStateInitialWaitingForData];
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
            foundValidCharacteristic = YES;
        }
        
        //The IP characteristic supports writing to it
        //If we discovered it, we write our network interface addresses to it to transfer them to the other device\
        //After sending, peripheral:didWriteValueForCharacteristic:error: will be called
        if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]])
        {
            [self _sendIPsToPeripheral:peripheral onCharacteristic:characteristic];
            [connection setState:CWBluetoothConnectionStateIPSent];
            foundValidCharacteristic = YES;
        }
    }
    
    if (foundValidCharacteristic == NO)
    {
        DLog(@"No valid characteristics found for '%@', device is ignored...", peripheral.name);
        [connection setState:CWBluetoothConnectionStateErrored];
        [self _disconnectPeripheral:peripheral];
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"P didUpdateValueForCharacteristic: %@, error %@", [[NSString alloc] initWithData:characteristic.value encoding:NSUTF8StringEncoding], error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection != nil
        && connection.state == CWBluetoothConnectionStateInitialWaitingForData
        && [characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]]
        && characteristic.value != nil)
    {
        NSDictionary *retrievedData = [CWUtil dictionaryFromJSONData:characteristic.value];
        
        if (retrievedData[@"identifier"] == nil)
        {
            DLog(@"WARNING: Received initial device data of '%@' without an identifier, device is ignored...", peripheral.name);
            [connection setState:CWBluetoothConnectionStateErrored];
            [self _disconnectPeripheral:peripheral];
            return;
        }
        else
        {
            [connection setIdentifier:retrievedData[@"identifier"]];
        }
        
        //Grab all valid initial data fields that are available and add them to the connection information
        if (retrievedData[@"measuredPower"] != nil) [connection setMeasuredPower:[(NSNumber *)retrievedData[@"measuredPower"] intValue]];
        
        [connection setState:CWBluetoothConnectionStateInitialDone];
        [self _disconnectPeripheral:peripheral];
        
        //After the initial data transfer we can finally sent the "device detected" to the delegate
        if ([self.delegate respondsToSelector:@selector(deviceDetected:)])
        {
            [self.delegate deviceDetected:connection.identifier];
        }
    }
}


- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"P didWriteValueForCharacteristic, error %@", error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection != nil
        && connection.state == CWBluetoothConnectionStateIPSent
        && [characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]])
    {
        if (error != nil)
        {
            //TODO we need a retry mechanism here, for now we just ignore the peripheral
            DLog(@"Error when sending IPs to %@, ignoring...", connection.identifier);
            [connection setState:CWBluetoothConnectionStateErrored];
            self.pendingCharacteristicWrites = 0;
            [self _disconnectPeripheral:peripheral];
            
            return;
        }
        
        self.pendingCharacteristicWrites--;
        if (self.pendingCharacteristicWrites == 0)
        {
            [connection setState:CWBluetoothConnectionStateIPDone];
            [self _disconnectPeripheral:peripheral];
        }
    }
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
    
    BOOL requestsValid = YES;
    NSMutableArray *retrievedIPs = [NSMutableArray array];
    for (CBATTRequest *writeRequest in requests)
    {
        DLog(@"PM didReceiveWriteRequests request data is %@", [[NSString alloc] initWithData:writeRequest.value encoding:NSUTF8StringEncoding]);
        
        NSDictionary *retrievedData = [CWUtil dictionaryFromJSONData:writeRequest.value];
        
        if (retrievedData[@"ip"] == nil)
        {
            requestsValid = NO;
            break;
        }
        
        [retrievedIPs addObject:retrievedData[@"ip"]];
    }
    
    if (requestsValid == NO)
    {
        //TODO should we really ignore here?
        DLog(@"Error in the revieved IPs");
        [self.peripheralManager respondToRequest:[requests objectAtIndex:0] withResult:CBATTErrorUnlikelyError];
    }
    else
    {
        //Wow, we are so close now. We received a bunch of IPs, one of them is the one we should connect to
        //Figure out which and bring this device into remote mode
        for (NSString *ip in retrievedIPs)
        {
            
        }
        
        [self.peripheralManager respondToRequest:[requests objectAtIndex:0] withResult:CBATTErrorSuccess];
    }
}


- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didSubscribeToCharacteristic:(CBCharacteristic *)characteristic
{
    DLog(@"PM centralDidSubscribeToCharacteristic");
    
    if (characteristic == self.advertisedInitialCharacteristic)
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
