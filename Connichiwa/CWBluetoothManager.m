//
//  CWBluetoothManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothManager.h"
#import "CWBluetoothConnection.h"
#import "CWWebApplicationState.h"
#import "CWUtil.h"
#import "CWDebug.h"



@interface CWBluetoothManager () <CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate>

/**
 *  A CWWebApplicationState implementation that allows the BT Manager to access the global state. This is important because the BT Manager needs to know about our unique identifier and if it should accept IPs via it's BT characteristic.
 */
@property (readwrite, weak) id<CWWebApplicationState> appState;

/**
 *  The CBCentralManager instance used by the manager to make this device a BTLE Central
 */
@property (readwrite, strong) CBCentralManager *centralManager;

/**
 *  The CBPeripheralManager instance used by this manager to make this device a BTLE Peripheral
 */
@property (readwrite, strong) CBPeripheralManager *peripheralManager;

/**
 *  The Connichiwa service advertised by this device
 */
@property (readwrite, strong) CBMutableService *advertisedService;

/**
 *  The initial characteristic advertised by this device. Subscribing to this characteristic will trigger this device to send its initial device data to the other device.
 */
@property (readwrite, strong) CBMutableCharacteristic *advertisedInitialCharacteristic;

/**
 *  The IP characteristic advertised by this device. This is a writable characteristic that other devices can write data to, but only valid IPs will be accepted. Writing IPs to this characteristic will trigger this device to test if that IP leads to a valid Connichiwa web server. If so, this device will connect to it and effecitvely become a remote device.
 */
@property (readwrite, strong) CBMutableCharacteristic *advertisedIPCharacteristic;

/**
 *  Determines if the Connichiwa service was already added to the CBPeripheralManager and is advertised to other devices
 */
@property (readwrite) BOOL didAddService;

@property (readwrite) NSTimer *lostConnectionsTimer;

/**
 *  Determines if startScanning was called by we didn't start scanning yet
 */
@property (readwrite) BOOL wantsToStartScanning;

/**
 *  Determines if startAdvertising was called but we didn't start advertising yet
 */
@property (readwrite) BOOL wantsToStartAdvertising;

/**
 *  An array of CWBluetoothConnection object, each representing a device that is currently nearby, connected to or was detected somewhen earlier.
 */
@property (readwrite, strong) NSMutableArray *connections;


/**
 *  Actually starts scanning for other BT devices. The public startScanning will wait for the CBCentralManager to power on before calling this method.
 */
- (void)_doStartScanning;

/**
 *  Actually starts advertising this device to other BT devices. The public startAdvertising will wait for the CBPeripheralManager to power on before calling this method.
 */
- (void)_doStartAdvertising;

/**
 *  Will ask the CBCentralManager to connect to the given CBPeripheral. This method will temporarily stop scanning for other BT devices, because scanning and connecting simultanously can lead to problems. Scanning will be resumed either in centralManager:didConnectPeripheral: or centralManager:didFailToConnectPeripheral:error:
 *
 *  @param peripheral The CBPeripheral to connect to
 */
- (void)_connectPeripheral:(CBPeripheral *)peripheral;

/**
 *  Will ask the CBCentralManager to disconnect the given CBPeripheral.
 *
 *  @param peripheral The CBPeripheral to disconnect
 */
- (void)_disconnectPeripheral:(CBPeripheral *)peripheral;

/**
 *  This method adds a new RSSI measure to the given CWBluetoothConnection. CWBluetoothConnection will use advanced algorithms to determine an average RSSI that is robust to outliers. Furthermore, it determines if a "distance changed" event should be sent to the delegate based on time since the last event and the RSSI change since then.
 *
 *  @param RSSI       The new RSSI measure
 *  @param connection The connection which contains the CBPeripheral that the RSSI was measured for
 */
- (void)_addRSSIMeasure:(double)RSSI toConnection:(CWBluetoothConnection *)connection;

/**
 *  Sends our initial device data to the given CBCentral via the initial characteristic. This method should be triggered after a central subscribed to our initial characteristic.
 *
 *  @param central The CBCentral that subscribed to the initial characteristic and should receive the data
 */
- (void)_sendInitialToCentral:(CBCentral *)central;

/**
 *  Sends our network interface addresses to the given peripheral via the given writeable characteristic, which should be the other devices IP characteristic.
 *
 *  @param peripheral     The CBPeripheral to send the addresses to
 *  @param characteristic The writeable characteristic to write the IPs into
 */
- (void)_sendIPsToPeripheral:(CBPeripheral *)peripheral onCharacteristic:(CBCharacteristic *)characteristic;

/**
 *  TODO: This is not implemented. We should implement a new send/receive mechanisms that bundles data here and also makes sure that sending data is neatly packed in 20-byte chunks and put together.
 *
 *  @param data    TODO
 *  @param central TODO
 */
- (void)_sendData:(NSData *)data toCentral:(CBCentral *)central;

/**
 *  TODO: This is not implemented. We should implement a new send/receive mechanisms that bundles data here and also makes sure that sending data is neatly packed in 20-byte chunks and put together.
 *
 *  @param data       TODO
 *  @param peripheral TODO
 */
- (void)_sendData:(NSData *)data toPeripheral:(CBPeripheral *)peripheral;

/**
 *  TODO: This is not implemented. We should implement a new send/receive mechanisms that bundles data here and also makes sure that sending data is neatly packed in 20-byte chunks and put together.
 *
 *  @param data    TODO
 *  @param central TODO
 */
- (void)_receivedData:(NSData *)data fromCentral:(CBCentral *)central;

/**
 *  TODO: This is not implemented. We should implement a new send/receive mechanisms that bundles data here and also makes sure that sending data is neatly packed in 20-byte chunks and put together.
 *
 *  @param data                     TODO
 *  @param peripheral               TODO
 */
- (void)_receivedData:(NSData *)data fromPeripheral:(CBPeripheral *)peripheral;

/**
 *  Retrieves the CWBluetoothConnection that belongs to the device with the given identifier from the connections array
 *
 *  @param identifier The identifier of the device
 *
 *  @return The CWBluetoothConnection that belongs to identifier. nil if no connection is stored (=the device has not been detected yet) or the identifier is invalid.
 */
- (CWBluetoothConnection *)_connectionForIdentifier:(NSString *)identifier;

/**
 *  Retrieves the CWBluetoothConnection that belongs to the device with the given CBPeripheral from the connections array. Can therefore be used to retrieve the CWBluetoothConnection for a given bluetooth device.
 *
 *  @param peripheral The CBPeripheral of the device
 *
 *  @return The CWBluetoothConnection that belongs to peripheral. nil if no connection is stored (=the device has not been detected yet) or the peripheral is invalid.
 */
- (CWBluetoothConnection *)_connectionForPeripheral:(CBPeripheral *)peripheral;

@end



/**
 *  The UUID used to advertise the Connichiwa BT Service.
 *  Must be the same on all devices.
 */
NSString *const BLUETOOTH_SERVICE_UUID = @"AE11E524-2034-40F8-96D3-5E1028526348";

/**
 *  The UUID used to advertise the Connichiwa BT Characteristic for the data transfer of initial device data from peripheral to central.
 *  Must be the same on all devices.
 */
NSString *const BLUETOOTH_INITIAL_CHARACTERISTIC_UUID = @"22F445BE-F162-4F9B-804C-1636D7A24462";

/**
 *  The UUID used to advertise the Connichiwa BT Characteristic for the transfer of the network interface IPs from central to peripheral.
 *  Must be the same on all devices.
 */
NSString *const BLUETOOTH_IP_CHARACTERISTIC_UUID = @"8F627B80-B760-440C-880D-EFE99CFB6436";

/**
 *  When checking a URL for a Connichiwa webserver, this is the amount of seconds after which we consider the request failed
 */
double const URL_CHECK_TIMEOUT = 2.0;



@implementation CWBluetoothManager


- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState
{
    self = [super init];
    
    self.appState = appState;
    
    dispatch_queue_t centralQueue = dispatch_queue_create("connichiwacentralqueue", DISPATCH_QUEUE_SERIAL);
    dispatch_queue_t peripheralQueue = dispatch_queue_create("connichiwaperipheralqueue", DISPATCH_QUEUE_SERIAL);
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:centralQueue];
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:peripheralQueue];
    
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
    
    self.connections = [NSMutableArray array];
    self.wantsToStartScanning = NO;
    self.wantsToStartAdvertising = NO;
    
    return self;
}


#pragma mark Scanning & Advertising


- (void)startScanning
{
    if (self.centralManager.state == CBCentralManagerStatePoweredOn)
    {
        [self performSelectorOnMainThread:@selector(startLostConnectionTimer) withObject:nil waitUntilDone:YES];
        [self _doStartScanning];
    }
    else
    {
        self.wantsToStartScanning = YES;
    }
}


- (void)startAdvertising
{
    DLog(@"START ADVERTISING");
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
    DLog(@"Starting to advertise to other BT devices with identifier %@...", self.appState.identifier);
    [self.peripheralManager startAdvertising:@{ CBAdvertisementDataServiceUUIDsKey : @[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]] }];
}


- (void)_stopScanningTemporarily
{
    //Stop the check for lost connections, otherwise we would lose connections because of a temporary scan stop
    //The timer is reset in startScanning - it is the responsible of BTManager to make sure a temporary scan stop is actually temporary and will be resumed!
    [self performSelectorOnMainThread:@selector(stopLostConnectionTimer) withObject:nil waitUntilDone:YES];
    [self stopScanning];
}


#pragma mark Timers


- (void)startLostConnectionTimer
{
    DLog(@"STARTING LOST CONNECTION TIMER");
    
    [self stopLostConnectionTimer];
    self.lostConnectionsTimer = [NSTimer scheduledTimerWithTimeInterval:1.0 target:self selector:@selector(_removeLostConnections:) userInfo:nil repeats:YES];
}


- (void)stopLostConnectionTimer
{
    if (self.lostConnectionsTimer != nil)
    {
        DLog(@"STOPPING LOST CONNECTION TIMER");
        [self.lostConnectionsTimer invalidate];
        self.lostConnectionsTimer = nil;
    }
}


#pragma mark Managing Connections


- (void)_connectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Connecting to BT device '%@'", peripheral.name);
    
    //It is rumored that scanning while connecting can lead to problems, therefore stop temporarily
    [self _stopScanningTemporarily];
    [self.centralManager connectPeripheral:peripheral options:nil];
}


- (void)_disconnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"Disconnecting BT device '%@'", peripheral.name);
    
    if (peripheral.state == CBPeripheralStateDisconnected || peripheral.state == CBPeripheralStateConnecting) return;
    
    // See if we are subscribed to a characteristic on the peripheral
    for (CBService *service in peripheral.services) {
        for (CBCharacteristic *characteristic in service.characteristics) {
//            if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]]) {
                if (characteristic.isNotifying) {
                    [peripheral setNotifyValue:NO forCharacteristic:characteristic];
                }
//            }
        }
    }
    
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


- (void)_removeLostConnections:(NSTimer *)timer
{
    //Check the time we last saw each connection - if the connection has not been seen for a second, it is considered lost
    NSDate *now = [NSDate date];
    NSMutableArray *lostConnections = [NSMutableArray array];
    for (CWBluetoothConnection *connection in self.connections)
    {
        if ([now timeIntervalSinceDate:connection.lastSeen] >= 1.0)
        {
            [lostConnections addObject:connection];
        }
    }
    
    for (CWBluetoothConnection *lostConnection in lostConnections)
    {
        [self.connections removeObject:lostConnection];
        
        if (lostConnection.identifier != nil && [self.delegate respondsToSelector:@selector(deviceLost:)])
        {
            [self.delegate deviceLost:lostConnection.identifier];
        }
        
        
    }
}


#pragma mark Sending & Receiving Data


- (void)sendNetworkAddressesToDevice:(NSString *)deviceIdentifier
{
    CWBluetoothConnection *connection = [self _connectionForIdentifier:deviceIdentifier];
    
    if (connection == nil)
    {
        DLog(@"Invalid device identifier to send network addresses to, %@", deviceIdentifier);
        return;
    }
    
    if (connection.state == CWBluetoothConnectionStateIPConnecting || connection.state == CWBluetoothConnectionStateIPSent) return;
    
    [connection setState:CWBluetoothConnectionStateIPConnecting];
    connection.pendingIPWrites = 0;
    [self _connectPeripheral:connection.peripheral];
}


- (void)_sendInitialToCentral:(CBCentral *)central
{
    NSDictionary *sendDictionary = @{ @"identifier": self.appState.identifier };
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
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    NSArray *ips = [CWUtil deviceInterfaceAddresses];
    for (NSString *ip in ips)
    {
        NSString *ipWithPort = [NSString stringWithFormat:@"%@:%d", ip, self.appState.webserverPort];
        DLog(@"Writing value %@", @{ @"ip": ipWithPort } );
        NSData *data = [CWUtil JSONDataFromDictionary:@{ @"ip": ipWithPort }];
        [peripheral writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
        connection.pendingIPWrites++;
    }
    
//    NSData *data = [CWUtil dataFromDictionary:@{ @"ips": ips }];
//    DLog(@"Writing data of length %d", [data length]);
//    [peripheral writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
//    connection.pendingIPWrites++;
}


- (void)_sendData:(NSData *)data toCentral:(CBCentral *)central
{
    
}


- (void)_sendData:(NSData *)data toPeripheral:(CBPeripheral *)peripheral
{
    
}


- (void)_receivedData:(NSData *)data fromCentral:(CBCentral *)central
{
    
}


- (void)_receivedData:(NSData *)data fromPeripheral:(CBPeripheral *)peripheral
{
    
}


#pragma mark Retrieving CWBluetoothConnections


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


/**
 *  Called when the state of the CBCentralManager is updated. Mainly used to detect when the CentralManager is powered on and ready to be used
 *
 *  @param central The CBCentralManager instance that changed its state
 */
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
}


/**
 *  Called when the CBCentralManager discoverd a peripheral nearby. Since we scan for other devices with duplicates enabled this will also be called for devices we have previously discovered or even connected to. This will NOT be called for our own device, though. Since this method is called about ten times per second for each device nearby, this method shouldn't do anything heavy.
 *
 *  @param central           The CBCentralManager that discovered the peripheral
 *  @param peripheral        The detected peripheral
 *  @param advertisementData The advertisement data sent by the peripheral (should always be nil for Connichiwa devices)
 *  @param RSSI              The RSSI (signal strength) of the other device
 */
- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI
{
//    DLog(@"CM didDiscoverPeripheral '%@'", peripheral.name);
    
    //If a new peripheral is detected, we need to connect to its initial characteristic and retrieve its identifier before reporting it to the delegate
    //For previously detected devices, we use the measures RSSI to update their distance measure
    CWBluetoothConnection *existingConnection = [self _connectionForPeripheral:peripheral];
    if (existingConnection == nil)
    {
        DLog(@"Peripheral '%@' is new", peripheral.name);
        
        CWBluetoothConnection *newConnection = [[CWBluetoothConnection alloc] initWithPeripheral:peripheral];
        [newConnection setState:CWBluetoothConnectionStateInitialConnecting];
        [newConnection updateLastSeen];
        [self.connections addObject:newConnection];
        
        [self _connectPeripheral:peripheral];
    }
    else
    {
        [existingConnection updateLastSeen];
        [self _addRSSIMeasure:[RSSI doubleValue] toConnection:existingConnection];
    }
}


/**
 *  Called when a connection was established to another peripheral. This does not mean that we can transfer from or to the device yet, information transfer is done via characteristics that reside inside of services, so we need to detect the connichiwa service and the characteristic we need before we can transfer data. When the services where discovered, CBPeripheral's peripheral:didDiscoverServices: is called
 *
 *  @param central    The CBCentralManager that connected to the peripheral
 *  @param peripheral The peripheral connected to
 */
- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    DLog(@"CM didConnectPeripheral '%@'", peripheral.name);
    
    //In _connectPeripheral we stop scanning while connecting, so we need to resume scanning now
    [self startScanning];
    
    peripheral.delegate = self;
    [peripheral discoverServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]];
}


/**
 *  Called when a connection to a peripheral failed. This shouldn't happen too often, but can happen with BT, so we need to take care of things here.
 *
 *  @param central    The CBCentralManager that failed to connect
 *  @param peripheral The peripheral that was not successfully connected to
 *  @param error      The error message describing the reason for the failure
 */
- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"CM didFailToConnectPeripheral '%@', error %@", peripheral.name, error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection == nil) return;
    
    //If we didn't transfer initial data yet, we cannot use this device, therefore set its state to error
    if (connection.state != CWBluetoothConnectionStateUnknown &&
        connection.state != CWBluetoothConnectionStateInitialDone &&
        connection.state != CWBluetoothConnectionStateIPDone &&
        connection.state != CWBluetoothConnectionStateErrored)
    {
        connection.state = CWBluetoothConnectionStateErrored;
    }
    
    //In _connectPeripheral we stop scanning while connecting, so we need to resume scanning now
    [self startScanning];
}


/**
 *  Called when a peripheral disconnected. This might be because the Connichiwa application was shut down on the other device, because it moved out of range, because of a BT error or because of other reasons. We need to be able to handle a disconnect at ANY time and clean up accordingly.
 *
 *  @param central    The CBCentralManager that was connected to the peripheral
 *  @param peripheral The peripheral that disconnected
 *  @param error      An error describing the reason for the disconnect
 */
- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
    DLog(@"CM: didDisconnectPeripheral '%@', error %@", peripheral.name, error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection == nil) return;
    
    //If we didn't transfer initial data yet, we cannot use this device, therefore set its state to error
    if (connection.state != CWBluetoothConnectionStateUnknown &&
        connection.state != CWBluetoothConnectionStateInitialDone &&
        connection.state != CWBluetoothConnectionStateIPDone &&
        connection.state != CWBluetoothConnectionStateErrored)
    {
        connection.state = CWBluetoothConnectionStateErrored;
    }
}


#pragma mark CBPeripheralDelegate


/**
 *  Called when we discovered the Connichiwa service for a peripheral or the discovery failed. Before we can transfer data, we still need to discover the correct characteristic - depending on the data we want to transfer. When the characteristic was discovered, CBPeripheral's peripheral:didDiscoverCharacteristicsForService:error: will be called.
 *
 *  @param peripheral The CBPeripheral that contains the discovered Connichiwa service
 *  @param error      An error describing the reason of a discovery failure, or nil if the discovery was successful
 */
- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
    DLog(@"P didDiscoverServices '%@', error %@", peripheral.name, error);
    
    //Depending on the connection state, discover either the initial or the IP characteristic
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


/**
 *  Called when we discovered a characteristic for a peripheral or the discovery failed. When successful, we can either send or receive data, depending on the type of characteristic that was discovered:
 *  1) Notifyable characteristics (e.g. the initial characteristic) are used to receive data from the peripheral. Once we called CBPeripheral's setNotifyValue:forCharacteristic we will be notified when the other device writes to the characteristic via peripheral:didUpdateValueForCharacteristic:error:
 *  2) Writeable characteristics (e.g. the IP characteristic) are used to send data to a peripheral. Calling the CBPeripheral's writeValue:forCharacteristic:type: method will trigger CBPeripheralManager's peripheralManager:didReceiveWriteRequests: on the other device. Also, we will be notified if the write succeeded. For every write, peripheral didWriteValueForCharacteristic:error: will be called with the response code of the write.
 *
 *  @param peripheral The peripheral that offers the characteristic
 *  @param service    The service the characteristic belongs to
 *  @param error      An error giving a description of the discovery failure, or nil if no failure occured
 */
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


/**
 *  Called when a remote device updated the value of a notifyable characteristic for which we activated notifications. Effectively, this means the remote device transfered data to us via this characteristic. The transferred data is stored in characteristic.value
 *
 *  @param peripheral     The CBPeripheral that the characteristic belongs to
 *  @param characteristic The characteristic whose value was updated
 *  @param error          An error detailing a reason for failure if one occured, nil if no failure occured
 */
- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"P didUpdateValueForCharacteristic: %@, error %@", [[NSString alloc] initWithData:characteristic.value encoding:NSUTF8StringEncoding], error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection != nil
        && connection.state == CWBluetoothConnectionStateInitialWaitingForData
        && [characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]]
        && characteristic.value != nil
        && error == nil)
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
    else
    {
        [self _disconnectPeripheral:peripheral];
    }
}


/**
 *  Called when we transferred data to a remote device via a writable characteristic. After the data was received by the other device, the other device can report either a success (resulting in a nil error), or an error (resulting in an NSError object describing the error).
 *
 *  @param peripheral     The peripheral the characteristic belongs to
 *  @param characteristic The writable characteristic that was written to
 *  @param error          An error if the other device reported back one, nil on success
 */
- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
    DLog(@"P didWriteValueForCharacteristic, error %@", error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    
    if (connection.pendingIPWrites == 0)
    {
        DLog(@"Received a write response for '%@' without pending writes - what happened?", peripheral.name);
        return;
    }
    
    if (connection != nil
        && connection.state == CWBluetoothConnectionStateIPSent
        && [characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]])
    {
        connection.pendingIPWrites--;
        
        //We exploit the BT write error mechanism to report if the other device was able to connect to the IP we sent
        //When the IP was valid, the other device reports back a CBATTErrorSuccess, otherwise a CBATTErrorAttributeNotFound
        if (error.code == CBATTErrorSuccess && connection.state == CWBluetoothConnectionStateIPSent)
        {
            [connection setState:CWBluetoothConnectionStateIPDone];
            if ([self.delegate respondsToSelector:@selector(didSendNetworkAddresses:success:)])
            {
                [self.delegate didSendNetworkAddresses:connection.identifier success:YES];
            }
        }
        
        if (connection.pendingIPWrites == 0)
        {            
            //If the state is not "IPDone" yet, it means none of the IP writes came back with an CBATTErrorSuccess response - none of the IPs worked
            if (connection.state == CWBluetoothConnectionStateIPSent)
            {
                //TODO should we really ignore here?
                DLog(@"Peripheral '%@' reported back no success with sent IPs, ignoring...", peripheral.name);
                [connection setState:CWBluetoothConnectionStateErrored];
                if ([self.delegate respondsToSelector:@selector(didSendNetworkAddresses:success:)])
                {
                    [self.delegate didSendNetworkAddresses:connection.identifier success:NO];
                }
            }
            
            [self _disconnectPeripheral:peripheral];
        }
    }
}


/**
 *  Called when the device name of a CBPeripheral was updated. This is sometimes called because the device name is not discovered instantly. As long as no name was discovered for a CBPeripheral, its name will be (null). The new name is stored in peripheral.name
 *
 *  @param peripheral The peripheral whose name updated
 */
- (void)peripheralDidUpdateName:(CBPeripheral *)peripheral
{
    DLog(@"P didUpdateName '%@'", peripheral.name);
}


#pragma mark CBPeripheralManagerDelegate


/**
 *  Called when the state of the CBPeripheralManager was updated. Mainly used to to detect when the PeripheralManager was powered on and is ready to be used.
 *
 *  @param peripheralManager The CBPeripheralManager whose state changed
 */
- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheralManager
{
    if (peripheralManager.state == CBCentralManagerStatePoweredOn)
    {
        //Add the Connichiwa service to the peripheral. When the service was added, XXX will be called
        if (self.didAddService == NO)
        {
            self.didAddService = YES;
            [self.peripheralManager addService:self.advertisedService];
        }
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


/**
 *  Called after the peripheral manager's addService: was called and the service was added to the peripheral and is now published. If startAdvertising was called before this callback arrives, we will repeat the call.
 *
 *  @param peripheral The PeripheralManager the service was added to
 *  @param service    The service that was added
 *  @param error      An error if something went wrong or nil if the service was added successfully
 */
- (void)peripheralManager:(CBPeripheralManager *)peripheral didAddService:(CBService *)service error:(NSError *)error
{
    if (error != nil)
    {
        self.didAddService = NO;
        DLog(@"ERROR advertising the Connichiwa service: %@", error);
        return;
    }
    
    if (self.wantsToStartAdvertising == YES)
    {
        [self startAdvertising];
    }
}


/**
 *  Called when sending data to a central via a notifyable characteristic failed because the transmission queue was full. The call to this method indicates that the characteristic can hold data again.
 *  TODO: Should be used as part of the send/receive rewrite
 *
 *  @param peripheral The CBPeripheralManager that triggered this message
 */
- (void)peripheralManagerIsReadyToUpdateSubscribers:(CBPeripheralManager *)peripheral
{
    DLog(@"PM isReadyToUpdateSubscribers");
}


/**
 *  Called whenever we received a read request for a characteristic. This applies to readable characteristics only, which are not used in Connichiwa as of yet, so this should never be called.
 *
 *  @param peripheral The CBPeripheralManager that received the request
 *  @param request    The read request
 */
- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveReadRequest:(CBATTRequest *)request
{
    DLog(@"PM didReceiveReadRequest");
}


/**
 *  Called whenever we received a write request for a characteristic. This is called when a central sends us data via a writable characteristic. The sent data is stored in a request's value property. A call to this method can contain multiple write requests, but we should only send a single response. Responding will trigger the CBPeripheral's peripheral:didWriteValueForCharacteristic:error: method on the sending device.
 *
 *  @param peripheral The CBPeripheralManager that received the request
 *  @param requests   An array of one or more write requests
 */
- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveWriteRequests:(NSArray *)requests
{
    DLog(@"PM didReceiveWriteRequests");
    
    BOOL requestsValid = NO;
    for (CBATTRequest *writeRequest in requests)
    {
        DLog(@"PM didReceiveWriteRequests request data is %@", [[NSString alloc] initWithData:writeRequest.value encoding:NSUTF8StringEncoding]);
        
        NSDictionary *retrievedData = [CWUtil dictionaryFromJSONData:writeRequest.value];
        
        if (retrievedData[@"ip"] == nil)
        {
            DLog(@"Error in the retrieved IP");
            continue;
        }
        
        //If we can't become a remote anyway, we reject any IPs we receive
        if ([self.appState canBecomeRemote] == NO) continue;
        
        NSHTTPURLResponse *response = nil;
        NSError *error = nil;
        
        NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://%@/check", retrievedData[@"ip"]]];
        NSMutableURLRequest *request = [NSMutableURLRequest
                                        requestWithURL:url
                                        cachePolicy:NSURLRequestReloadIgnoringLocalAndRemoteCacheData
                                        timeoutInterval:URL_CHECK_TIMEOUT];
        [request setHTTPMethod:@"HEAD"];
        
        DLog(@"Checking URL %@", url);
        [NSURLConnection sendSynchronousRequest:request returningResponse:&response error:&error];
        if ([response statusCode] == 200)
        {
            //We found the correct IP!
            DLog(@"Found working URL: %@", url);
            if ([self.delegate respondsToSelector:@selector(didReceiveDeviceURL:)])
            {
                [self.delegate didReceiveDeviceURL:[url URLByDeletingLastPathComponent]]; //remove /check
            }
            requestsValid = YES;
        }
    }
    
    //We exploit the write request responses here to indicate if the IP(s) received worked or not
    if (requestsValid) [self.peripheralManager respondToRequest:[requests objectAtIndex:0] withResult:CBATTErrorSuccess];
    else [self.peripheralManager respondToRequest:[requests objectAtIndex:0] withResult:CBATTErrorAttributeNotFound];
}


/**
 *  Called when a remote central subscribed to one of our notifyable characteristics via setNotify:forCharacteristic:
 *
 *  @param peripheral     The CBPeripheralManager that is responsible for the characteristic
 *  @param central        The CBCentral that subscribed to the characteristic
 *  @param characteristic The characteristic that was subscribed to
 */
- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didSubscribeToCharacteristic:(CBCharacteristic *)characteristic
{
    DLog(@"PM centralDidSubscribeToCharacteristic");
    
    if (characteristic == self.advertisedInitialCharacteristic)
    {
        DLog(@"SUBSRIBED TO INITIAL, SENDING");
        [self _sendInitialToCentral:central];
    }
}


/**
 *  Called when a remote central cancelled the subscription to a notifyable characteristic of ours. Can be called because of a manual unsubscribe, but will also be called if the device unsubscribed because it disconnected.
 *
 *  @param peripheral     The CBPeripheralManager
 *  @param central        The CBCentral that unsubscribed
 *  @param characteristic The characteristic that was unsubscribed
 */
- (void)peripheralManager:(CBPeripheralManager *)peripheral central:(CBCentral *)central didUnsubscribeFromCharacteristic:(CBCharacteristic *)characteristic
{
    DLog(@"PM centralDidUnsubscribeFromCharacteristic");
}


/**
 *  Called after _doStartAdvertising was called and the advertising was started
 *
 *  @param peripheral The PeripheralManager advertising
 *  @param error      An error describing the reason for failure, or nil if no error occured and advertisement started
 */
- (void)peripheralManagerDidStartAdvertising:(CBPeripheralManager *)peripheral error:(NSError *)error
{
    DLog(@"PM didStartAdvertising, error %@", error);
    
    if (error == nil)
    {
        if ([self.delegate respondsToSelector:@selector(didStartAdvertisingWithIdentifier:)])
        {
            [self.delegate didStartAdvertisingWithIdentifier:self.appState.identifier];
        }
    }
}

@end
