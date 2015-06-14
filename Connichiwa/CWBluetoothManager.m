//
//  CWBluetoothManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 20/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//


/**
 *
 * TODO
 *
 * rewrite BT Connection so that MC is part of the IP sent state
 * I think this is a better way to do it, since they have a direct correlatio - if IP sending fails, we go into MC, establish a connection, then retry IP sending.
 * Then, we can also establish a retry mechanism for this that will also retry establishing an MC connection
 *
 * Next, it might be necessary to "reset" MC every time we start browsing for another peer
 * Next, it seems that we shouldnt sent (or receive) BT data while an MC connection is established. This sucks a lot!
 *
 * We should check exactly what works and what doesnt: Does simultanously connecting via WiFi work? Do sequential MC connections work?
 * If it really is a problem only with parallel MC connections, then we can probably fix this by creating a queue for MC connections.
 * If its a general problem with parallel BT stuff, we need to shutdown scanning and advertising while establishing a connection, which sucks
 * In any case, this sucks
 */

#import "CWBluetoothManager.h"
#import "CWBluetoothTransferManager.h"
#import "CWBluetoothTransferManagerDelegate.h"
#import "CWBluetoothConnection.h"
#import "CWWebApplicationState.h"
#import "CWUtil.h"
#import "CWDebug.h"



int const MAX_CONNECTION_RETRIES = 4;



@interface CWBluetoothManager () <CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate, MCNearbyServiceBrowserDelegate, MCNearbyServiceAdvertiserDelegate, MCSessionDelegate, CWBluetoothTransferManagerDelegate>

/**
 *  A CWWebApplicationState implementation that allows the BT Manager to access the global state. This is important because the BT Manager needs to know about our unique identifier and if it should accept IPs via it's BT characteristic.
 */
@property (readwrite, weak) id<CWWebApplicationState> appState;

@property (readwrite, strong) CWBluetoothTransferManager *transferManager;

@property (readwrite) BOOL isScanning;

@property (readwrite) BOOL testMcRun;

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

@property (readwrite, strong) MCPeerID *mcID;
@property (readwrite, strong) MCNearbyServiceBrowser *mcBrowser;
@property (readwrite, strong) MCNearbyServiceAdvertiser *mcAdvertiser;

/**
 *  Determines if the Connichiwa service was already added to the CBPeripheralManager and is advertised to other devices
 */
@property (readwrite) BOOL didAddService;

/**
 *  A timer after which the manager will check if any BT devices have disappeared
 */
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
 *  Calls stopScanning but marks this stop as a temporary stop so BT devices will be not be reported as lost. It is the responsibility of the manager to resume scanning at some point, however, this method does not control the length of the scan stop.
 */
- (void)_stopScanningTemporarily;

/**
 *  Starts the lostConnectionsTimer, enabling a periodic check for lost BT devices
 */
- (void)startLostConnectionTimer;

/**
 *  Stops the lostConnectionsTimer, disabling checking for lost BT device
 */
- (void)stopLostConnectionTimer;

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
 *  Called when the lostConnectionsTimer fires. This method checks if any BT devices have timed out and if so marks them as lost and sends an appropiate message to our delegate.
 *
 *  @param timer The timer that caused the method to fire
 */
- (void)_removeLostConnections:(NSTimer *)timer;

/**
 *  Sends our initial device data to the given CBCentral via the initial characteristic. This method should be triggered after a central subscribed to our initial characteristic.
 *
 *  @param central The CBCentral that subscribed to the initial characteristic and should receive the data
 */
- (void)_sendInitialDataToCentral:(CBCentral *)central;

/**
 *  Sends our network interface addresses to the given peripheral via the given writeable characteristic, which should be the other devices IP characteristic.
 *
 *  @param peripheral     The CBPeripheral to send the addresses to
 *  @param characteristic The writeable characteristic to write the IPs into
 */
- (void)_sendIPsToPeripheral:(CBPeripheral *)peripheral onCharacteristic:(CBCharacteristic *)characteristic;

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

NSString *const MC_SERVICE_NAME = @"mc-connichiwa";

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
    self.transferManager = [[CWBluetoothTransferManager alloc] initWithPeripheralManager:self.peripheralManager];
    [self.transferManager setDelegate:self];
    
    //A central can subscribe to the initial characteristic when it wants to receive our initial device info, including our unique identifier
    self.advertisedInitialCharacteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]
                                                                       properties:CBCharacteristicPropertyNotify
                                                                            value:nil
                                                                      permissions:CBAttributePermissionsReadable];
    
    //A central can subscribe to the IP characteristic when it wants to use our device as a remote device
    //The characteristic is writeable and allows the central to send us its IPs
    self.advertisedIPCharacteristic = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]
                                                                              properties:(CBCharacteristicPropertyWriteWithoutResponse | CBCharacteristicPropertyWrite)
                                                                                   value:nil
                                                                             permissions:CBAttributePermissionsWriteable];
    
    self.advertisedService = [[CBMutableService alloc] initWithType:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID] primary:YES];
    self.advertisedService.characteristics = @[ self.advertisedInitialCharacteristic, self.advertisedIPCharacteristic ];

    self.testMcRun = NO;
    [self resetMC];

    
//    self.mcID = [[MCPeerID alloc] initWithDisplayName:self.appState.identifier];
//    
//    //When a connection attempt failed we will use the Multipeer Connectivity Browser to establish an ad-hoc BT connection (only iOS<->iOS)
//    self.mcBrowser = [[MCNearbyServiceBrowser alloc] initWithPeer:self.mcID
//                                                      serviceType:MC_SERVICE_NAME];
//    [self.mcBrowser setDelegate:self];
////    [self.mcBrowser startBrowsingForPeers]; //we start browsing now - every found peer that we do not explicitly seek is ignored anyway
//    
//    //Multipeer Browsers will detect us through the Multipeer Advertiser
//    self.mcAdvertiser = [[MCNearbyServiceAdvertiser alloc] initWithPeer:self.mcID
//                                                          discoveryInfo:Nil
//                                                            serviceType:MC_SERVICE_NAME];
//    [self.mcAdvertiser setDelegate:self];
    
    //Multipeer Session that holds our connected MC devices. Note that the device limit is currently 8, according to MCSession's docs
    //I'm not entirely sure if a device can create multiple parallel MC sessions, but I think we won't need that for now
//    self.mcSession = [[MCSession alloc] initWithPeer:self.mcID securityIdentity:nil encryptionPreference:MCEncryptionNone];
//    [self.mcSession setDelegate:self];
//    self.mcSessions = [NSMutableDictionary dictionary];
    
    self.connections = [NSMutableArray array];
    self.isScanning = NO;
    self.wantsToStartScanning = NO;
    self.wantsToStartAdvertising = NO;
    
    return self;
}


#pragma mark Scanning & Advertising


- (void)startScanning
{
    BTLog(3, @"Trying to start scanning for other BT devices");
    if (self.centralManager.state == CBCentralManagerStatePoweredOn)
    {
        [self _doStartScanning];
        [self performSelectorOnMainThread:@selector(startLostConnectionTimer) withObject:nil waitUntilDone:YES];
    }
    else
    {
        self.wantsToStartScanning = YES;
    }
}


- (void)startAdvertising
{
    BTLog(3, @"Trying to advertise to other BT devices");
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
    BTLog(1, @"Stop scanning for other BT devices");
    
    self.wantsToStartScanning = NO;
    self.isScanning = NO;
    [self.centralManager stopScan];
}


- (void)stopAdvertising
{
    BTLog(1, @"Stop advertising to other BT devices");
    
    self.wantsToStartAdvertising = NO;
    [self.peripheralManager stopAdvertising];
}


- (BOOL)isAdvertising
{
    return self.peripheralManager != nil && self.peripheralManager.isAdvertising;
}


- (void)_doStartScanning
{
    if ([self isScanning]) return;
    
    BTLog(1, @"Starting to scan for other BT devices");
    
    [self.centralManager scanForPeripheralsWithServices:@[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]]
                                                options:@{ CBCentralManagerScanOptionAllowDuplicatesKey : @YES }];
    self.isScanning = YES;
    
    if ([self.delegate respondsToSelector:@selector(didStartScanning)])
    {
        [self.delegate didStartScanning];
    }
}


- (void)_doStartAdvertising
{
    if ([self isAdvertising]) return;
    
    BTLog(1, @"Starting to advertise to other BT devices using identifier %@", self.appState.identifier);
    
    [self.peripheralManager startAdvertising:@{ CBAdvertisementDataServiceUUIDsKey : @[[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]] }];
    [self.mcAdvertiser startAdvertisingPeer];
}


- (void)_stopScanningTemporarily
{
    BTLog(3, @"Temporarily stop scanning for other BT devices");
    
    //A temporary scan stop is usually used when we want to connect a peripheral. We don't want to lose any devices during that, so stop the timer
    //Usually, scanning is resumed in either peripheralDidConnect or peripheralDidFailToConnect
    //On very rare occasions (for example the other device encounters a BT problem) it might happen that we neither receive the connect nor the connectFailed callback
    //This would mean we never resume scanning, something that can not be risked, therefore resume scanning after a longer timeout regardless of what happens
    [self performSelectorOnMainThread:@selector(stopLostConnectionTimer) withObject:nil waitUntilDone:YES];
    [self stopScanning];
    [self performSelector:@selector(startScanning) withObject:nil afterDelay:30.0];
}


#pragma mark Timers


- (void)startLostConnectionTimer
{
    if (self.lostConnectionsTimer != nil) return;
    
    BTLog(3, @"Starting 'Lost BT Connections' Timer");
    
    [self stopLostConnectionTimer];
    self.lostConnectionsTimer = [NSTimer scheduledTimerWithTimeInterval:30.0 target:self selector:@selector(_removeLostConnections:) userInfo:nil repeats:YES];
}


- (void)stopLostConnectionTimer
{
    if (self.lostConnectionsTimer != nil)
    {
        BTLog(3, @"Stopping 'Lost BT Connections' Timer");

        [self.lostConnectionsTimer invalidate];
        self.lostConnectionsTimer = nil;
    }
}


#pragma mark Managing Connections


- (void)_connectPeripheral:(CBPeripheral *)peripheral
{
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection == nil) return; //e.g. when the device was lost
    
    if (connection.didError == YES || peripheral.state == CBPeripheralStateConnecting || peripheral.state == CBPeripheralStateConnected)
    {
        return;
    }
    
    BTLog(2, @"Connecting BT device %@", connection.identifier);
    
    //It is rumored that scanning while connecting can lead to problems, therefore stop temporarily
    connection.connectionTries++;
    [self _stopScanningTemporarily];
    [self.centralManager connectPeripheral:peripheral options:nil];
}


- (void)_disconnectPeripheral:(CBPeripheral *)peripheral
{
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    BTLog(2, @"Disconnecting BT device %@", connection.identifier);
    
    if (peripheral.state == CBPeripheralStateDisconnected || peripheral.state == CBPeripheralStateConnecting) return;
    
    // See if we are subscribed to a characteristic on the peripheral
    for (CBService *service in peripheral.services)
    {
        for (CBCharacteristic *characteristic in service.characteristics)
        {
            if (characteristic.isNotifying) [peripheral setNotifyValue:NO forCharacteristic:characteristic];
        }
    }
    
    [self.centralManager cancelPeripheralConnection:peripheral];
}


- (BOOL)_maybeRetryConnect:(CWBluetoothConnection *)connection
{
    if (connection.connectionTries <= MAX_CONNECTION_RETRIES)
    {
        double delay = pow(connection.connectionTries, 2) * 5.0; //exponential waiting time
        dispatch_async(dispatch_get_main_queue(), ^{
            [self performSelector:@selector(_connectPeripheral:) withObject:connection.peripheral afterDelay:delay];
        });
        
        return YES;
    }
    
    return NO;
}


- (void)_addRSSIMeasure:(double)RSSI toConnection:(CWBluetoothConnection *)connection
{
    if (connection.didError == YES) return;
    
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
            [self.delegate device:connection.identifier changedDistance:distance];
            [connection didSendDistance];
        }
    }
}


- (void)_removeLostConnections:(NSTimer *)timer
{
    CWLog(5, @"'Lost BT Connections' Timer triggered");
    
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
        CWLog(5, @"Removed connection %@", lostConnection.identifier);
        [self.connections removeObject:lostConnection];
        
        if (lostConnection.identifier != nil && [self.delegate respondsToSelector:@selector(deviceLost:)])
        {
            [self.delegate deviceLost:lostConnection.identifier];
        }
    }
}


#pragma mark Sending & Receiving Initial Data


- (void)_sendInitialDataToCentral:(CBCentral *)central
{
    if (self.testMcRun) {
        MCLog(3, @"Delaying sending initial data because MC is running");
        [self performSelector:@selector(_sendInitialDataToCentral:) withObject:central afterDelay:30.0];
        return;
    }
    NSData *initialData = [NSJSONSerialization dataWithJSONObject:self.appState.deviceInfo options:NSJSONWritingPrettyPrinted error:nil];
    [self.transferManager sendData:initialData toCentral:central withCharacteristic:self.advertisedInitialCharacteristic];
}


- (void)_receivedInitialData:(NSData *)data forPeripheral:(CBPeripheral *)peripheral
{
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    
    if (connection.initialDataState != CWBluetoothConnectionInitialDataStateConnected)
    {
        ErrLog(@"Received initial data from peripheral not in initial connected state!");
        return;
    }
    
    NSDictionary *initialData = [CWUtil dictionaryFromJSONData:data];
    
    BTLog(3, @"Received initial data for %@: %@", connection.identifier, initialData);
    
    if (initialData[@"identifier"] == nil)
    {
        ErrLog(@"Received initial data did not contain an identifier, device is ignored...", connection.peripheral.name);
        [connection setInitialDataState:CWBluetoothConnectionInitialDataStateMissing];
        connection.didError = YES;
        [self _disconnectPeripheral:connection.peripheral];
        
        return;
    }
    
    [connection setIdentifier:initialData[@"identifier"]];
    if (initialData[@"name"]          != nil) [connection setName:initialData[@"name"]];
    if (initialData[@"measuredPower"] != nil) [connection setMeasuredPower:[(NSNumber *)initialData[@"measuredPower"] intValue]];
    if (initialData[@"supportsMC"]    != nil) [connection setSupportsMC:[initialData[@"supportsMC"] boolValue]];
    
    
    [connection setInitialDataState:CWBluetoothConnectionInitialDataStateReceived];
    [self _disconnectPeripheral:connection.peripheral];
    
    //After the initial data transfer we can finally sent the "device detected" to the delegate
    if ([self.delegate respondsToSelector:@selector(deviceDetected:information:)])
    {
        [self.delegate deviceDetected:connection.identifier information:initialData];
    }
}


#pragma mark Sending & Receiving IP Data


- (void)sendNetworkAddressesToDevice:(NSString *)deviceIdentifier
{
    if (self.testMcRun) {
        MCLog(3, @"Delaying connecting device because MC is running");
        [self performSelector:@selector(sendNetworkAddressesToDevice:) withObject:deviceIdentifier afterDelay:30.0];
        return;
    }
    
    CWBluetoothConnection *connection = [self _connectionForIdentifier:deviceIdentifier];
    
    if (connection == nil)
    {
        ErrLog(@"Cannot send IPs to %@ - unknown device identifier", deviceIdentifier);
        return;
    }
    
    if (connection.IPWriteState != CWBluetoothConnectionIPWriteStateDisconnected) return;
    
    BTLog(3, @"Preparing to send IPs to %@", deviceIdentifier);
    
    [connection setIPWriteState:CWBluetoothConnectionIPWriteStateConnecting];
    [self _connectPeripheral:connection.peripheral];
}

- (void)iptest:(NSArray *)thedata {
    [self _sendIPsToPeripheral:[thedata objectAtIndex:0] onCharacteristic:[thedata objectAtIndex:1]];
}

- (void)_sendIPsToPeripheral:(CBPeripheral *)peripheral onCharacteristic:(CBCharacteristic *)characteristic
{
    if (self.testMcRun) {
        MCLog(3, @"Delaying sending IPs because MC is running");
        [self performSelector:@selector(iptest:) withObject:@[peripheral, characteristic] afterDelay:30.0];
        return;
    }
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection == nil) return;
    
    NSArray *ips = [CWUtil deviceInterfaceAddresses];
    NSMutableArray *ipsWithPort = [NSMutableArray arrayWithCapacity:[ips count]];
    for (NSString *ip in ips)
    {
        [ipsWithPort addObject:[NSString stringWithFormat:@"%@:%d", ip, self.appState.webserverPort]];
    }
    
    NSData *data = [CWUtil JSONDataFromDictionary:@{ @"ips": ipsWithPort }];
    connection.IPWriteState = CWBluetoothConnectionIPWriteStateSent;
    [self.transferManager sendData:data toPeripheral:peripheral withCharacteristic:characteristic];
}


- (void)_receivedIPData:(NSData *)data forCentral:(CBCentral *)central lastWriteRequest:(CBATTRequest *)writeRequest
{
    NSDictionary *ipData = [CWUtil dictionaryFromJSONData:data];
    BOOL containsValidIP = NO;
    
    if (ipData[@"ips"] != nil)
    {
        //If we can't become a remote anyway, we reject any IPs we receive
        //Otherwise we check every IP for validity and stop when we found a valid IP
        if ([self.appState canBecomeRemote])
        {
            for (NSString *ip in ipData[@"ips"])
            {
                NSHTTPURLResponse *response = nil;
                NSError *error = nil;
                
                NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://%@/check", ip]];
                NSMutableURLRequest *httpRequest = [NSMutableURLRequest
                                                    requestWithURL:url
                                                    cachePolicy:NSURLRequestReloadIgnoringLocalAndRemoteCacheData
                                                    timeoutInterval:URL_CHECK_TIMEOUT];
                [httpRequest setHTTPMethod:@"HEAD"];
                
                BTLog(3, @"Checking IP %@ for validity", url);
                [NSURLConnection sendSynchronousRequest:httpRequest returningResponse:&response error:&error];
                if ([response statusCode] == 200)
                {
                    //We found a working IP!
                    BTLog(3, @"%@ is a valid URL", url);
                    if ([self.delegate respondsToSelector:@selector(didReceiveDeviceURL:)])
                    {
                        [self.delegate didReceiveDeviceURL:[url URLByDeletingLastPathComponent]]; //remove /check
                    }
                    containsValidIP = YES;
                    break;
                }
            }
        }
    }
    else
    {
        ErrLog(@"'ips' key was missing from received IP data");
    }

    //We exploit the write request responses here to indicate if the IP(s) received worked or not
    if (containsValidIP)    [self.peripheralManager respondToRequest:writeRequest withResult:CBATTErrorSuccess];
    else                    [self.peripheralManager respondToRequest:writeRequest withResult:CBATTErrorAttributeNotFound];
}


- (void)_didReceiveIPWriteResponse:(NSError *)error fromPeripheral:(CBPeripheral *)peripheral
{
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection == nil)
    {
        ErrLog(@"Received IP write response for disconnected BT connection - arghlz?");
        return;
    }
    
    if (connection.IPWriteState != CWBluetoothConnectionIPWriteStateSent)
    {
        ErrLog(@"Received IP write response without having sent IPs - dafuq?");
        return;
    }
    
    BTLog(4, @"Device %@ answered to sent IPs. Response: %@", connection.identifier, error);
    
    connection.IPWriteState = CWBluetoothConnectionIPWriteStateDisconnected; //back to initial state
    [self _disconnectPeripheral:peripheral];
    
    //We exploit the BT write error mechanism to report if the other device was able to connect to one of the IPs we sent
    //When one of the IPs worked, the other device reports back a CBATTErrorSuccess, otherwise a CBATTErrorAttributeNotFound
    BOOL success = (error.code == CBATTErrorSuccess);
    BTLog(3, @"Device %@ %@ connect to one of the IPs we send", connection.identifier, (success ? @"did" : @"was unable to"));
    
    //Check if the device claims to support Multipeer Connectivity
    //If so, establish a MC connection, which will trigger another IP transfer afterwards. If not the connection failed, report back
//    if (success == NO && connection.supportsMC == YES && connection.mcState == CWBluetoothConnectionMCStateDisconnected) {
//        [self _mcConnect:connection];
//    } else if ([self.delegate respondsToSelector:@selector(didSendNetworkAddresses:success:)]) {
//        [self.delegate didSendNetworkAddresses:connection.identifier success:success];
//    }
    if ([self.delegate respondsToSelector:@selector(didSendNetworkAddresses:success:)]) {
        [self.delegate didSendNetworkAddresses:connection.identifier success:success];
    }
}


#pragma mark Multipeer Connectivity


- (void)resetMC {
//    MCLog(3, @"RESETTING MC");
//    
//    self.mcID = [[MCPeerID alloc] initWithDisplayName:self.appState.identifier];
//    
//    //When a connection attempt failed we will use the Multipeer Connectivity Browser to establish an ad-hoc BT connection (only iOS<->iOS)
//    self.mcBrowser = [[MCNearbyServiceBrowser alloc] initWithPeer:self.mcID
//                                                      serviceType:MC_SERVICE_NAME];
//    [self.mcBrowser setDelegate:self];
//    //    [self.mcBrowser startBrowsingForPeers]; //we start browsing now - every found peer that we do not explicitly seek is ignored anyway
//    
//    if (self.isScanning) [self.mcBrowser startBrowsingForPeers];
//    
//    //Multipeer Browsers will detect us through the Multipeer Advertiser
//    self.mcAdvertiser = [[MCNearbyServiceAdvertiser alloc] initWithPeer:self.mcID
//                                                          discoveryInfo:Nil
//                                                            serviceType:MC_SERVICE_NAME];
//    [self.mcAdvertiser setDelegate:self];
//    
//    if (self.isAdvertising) [self.mcAdvertiser startAdvertisingPeer];
}

- (void)_mcConnect:(CWBluetoothConnection *)connection {
    //TODO we should install a timeout here in case the peer cannot be found
    MCLog(3, @"Establishing a Multipeer Connectivity connection to device %@", connection.identifier);
    self.testMcRun = YES;
    [self resetMC];
    [connection setMcState:CWBluetoothConnectionMCStateSearching]; //this will cause browser:foundPeer:withDiscoveryInfo: to connect the peer
}

- (void)_mcDisconnect:(CWBluetoothConnection *)connection {
    MCLog(3, @"Disconnecting Multipeer Connectivity connection to device %@", connection.identifier);

    if (connection.mcSession != nil) [connection.mcSession disconnect];
    connection.mcSession = nil;
    connection.mcState = CWBluetoothConnectionMCStateDisconnected;
    
    BOOL noMCAnymore = YES;
    for (CWBluetoothConnection *aConnection in self.connections) {
        if (aConnection.mcState != CWBluetoothConnectionMCStateDisconnected) {
            noMCAnymore = NO;
        }
    }
    
    if (noMCAnymore) {
        self.testMcRun = NO;
        MCLog(3, @"No MC runs anymore, we can send and receive stuff!");
    }
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


#pragma mark CWBluetoothTransferManagerDelegate

- (void)didReceiveMessage:(NSData *)data fromPeripheral:(CBPeripheral *)peripheral withCharacteristic:(CBCharacteristic *)characteristic
{
    if ([characteristic.UUID isEqual:self.advertisedInitialCharacteristic.UUID]) [self _receivedInitialData:data forPeripheral:peripheral];
}

- (void)didReceiveMessage:(NSData *)data fromCentral:(CBCentral *)central withCharacteristic:(CBCharacteristic *)characteristic lastWriteRequest:(CBATTRequest *)request
{
    if ([characteristic.UUID isEqual:self.advertisedIPCharacteristic.UUID]) [self _receivedIPData:data forCentral:central lastWriteRequest:request];
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
    BTLog(1, @"Central Manager state changed to %@", stateString);
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
    //If a new peripheral is detected, we need to connect to its initial characteristic and retrieve its identifier before reporting it to the delegate
    //For previously detected devices, we use the measures RSSI to update their distance measure
    CWBluetoothConnection *existingConnection = [self _connectionForPeripheral:peripheral];
    if (existingConnection == nil)
    {
        BTLog(3, @"Discovered new peripheral '%@'", peripheral.name);
        
        CWBluetoothConnection *newConnection = [[CWBluetoothConnection alloc] initWithPeripheral:peripheral];
        [newConnection setInitialDataState:CWBluetoothConnectionInitialDataStateConnecting];
        [newConnection setIPWriteState:CWBluetoothConnectionIPWriteStateDisconnected];
        [newConnection updateLastSeen];
        [self.connections addObject:newConnection];
        
        [self _connectPeripheral:peripheral];
    }
    else
    {
        BTLog(6, @"Re-discovered existing device %@", existingConnection.identifier);
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
    BTLog(3, @"Connected peripheral '%@'", peripheral.name);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    connection.connectionTries = 0;
    
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
    BTLog(3, @"Failed to connect peripheral %@. Error: %@", peripheral.name, error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    if (connection == nil) return;
    
    //Retry the failed connection attempt
    BOOL didRetry = [self _maybeRetryConnect:connection];
    if (didRetry == NO)
    {
        BTLog(3, @"Device %@ failed to connect too many times, ignoring device...", peripheral.name);
        connection.didError = YES;
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
    BTLog(3, @"Disconnected peripheral %@. Error: %@", peripheral.name, error);
    
    //I don't think there is anything we can/should do here. Most of the time, a disconnect is completely ok.
    //If a disconnect occurs during a data transfer, that mostly means the device moved out of range and will be detected as lost soon anyway
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
    BTLog(3, @"Discovered services for '%@'. Error: %@", peripheral.name, error);
    
    //Depending on the connection state, discover either the initial or the IP characteristic
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    BOOL foundValidService = NO;
    for (CBService *service in peripheral.services)
    {
        if ([service.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_SERVICE_UUID]])
        {
            if (connection.initialDataState == CWBluetoothConnectionInitialDataStateConnecting)
            {
                [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]] forService:service];
                foundValidService = YES;
            }
            
            if (connection.IPWriteState == CWBluetoothConnectionIPWriteStateConnecting)
            {
                [peripheral discoverCharacteristics:@[[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]] forService:service];
                foundValidService = YES;
            }
        }
    }
    
    if (foundValidService == NO)
    {
        BTLog(3, @"No valid services found for '%@', device is ignored...", peripheral.name);
        connection.didError = YES;
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
    BTLog(3, @"Discovered Characteristics for '%@'. Error: %@", peripheral.name, error);
    
    CWBluetoothConnection *connection = [self _connectionForPeripheral:peripheral];
    BOOL foundValidCharacteristic = NO;
    for (CBCharacteristic *characteristic in service.characteristics)
    {
        //The initial characteristic supports notify only
        //Subscribing to the notifications will call the peripheralManager:central:didSubscribeToCharacteristic: of the other device and trigger the initial data transfer
        if (connection.initialDataState == CWBluetoothConnectionInitialDataStateConnecting && [characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_INITIAL_CHARACTERISTIC_UUID]])
        {
            [connection setInitialDataState:CWBluetoothConnectionInitialDataStateConnected];
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
            foundValidCharacteristic = YES;
        }
        
        //The IP characteristic supports writing to it
        //If we discovered it, we write our network interface addresses to it to transfer them to the other device
        //After sending, peripheral:didWriteValueForCharacteristic:error: will be called
        if ([characteristic.UUID isEqual:[CBUUID UUIDWithString:BLUETOOTH_IP_CHARACTERISTIC_UUID]])
        {
            [connection setIPWriteState:CWBluetoothConnectionIPWriteStateConnected];
            [self _sendIPsToPeripheral:peripheral onCharacteristic:characteristic];
            foundValidCharacteristic = YES;
        }
    }
    
    if (foundValidCharacteristic == NO)
    {
        BTLog(3, @"No valid characteristics found for '%@', device is ignored...", peripheral.name);
        connection.didError = YES;
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
    if (characteristic.value != nil && error == nil)
    {
        [self.transferManager receivedData:characteristic.value fromPeripheral:peripheral withCharacteristic:characteristic];
    }
    else
    {
        ErrLog(@"Received data from '%@'. Data: %@. Error: %@", peripheral.name, [[NSString alloc] initWithData:characteristic.value encoding:NSUTF8StringEncoding], error);
        
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
    if ([characteristic.UUID isEqual:self.advertisedIPCharacteristic.UUID])
    {
        [self _didReceiveIPWriteResponse:error fromPeripheral:peripheral];
    }
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
        //Add the Connichiwa service to the peripheral. When the service was added, peripheralManager:didAddService:error: will be called
        if (self.didAddService == NO)
        {
            self.didAddService = YES;
            [self.peripheralManager addService:self.advertisedService];
        }
    }
    
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
    BTLog(1, @"Peripheral Manager state changed to %@", stateString);
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
        ErrLog(@"Could not advertise Connichiwa service. Error: %@", error);
        return;
    }
    
    if (self.wantsToStartAdvertising == YES)
    {
        [self startAdvertising];
    }
}


/**
 *  Called when sending data to a central via a notifyable characteristic failed because the transmission queue was full. The call to this method indicates that the characteristic can hold data again.
 *
 *  @param peripheral The CBPeripheralManager that triggered this message
 */
- (void)peripheralManagerIsReadyToUpdateSubscribers:(CBPeripheralManager *)peripheral
{
    //We need to pass this call to the transfer manager so it knows it can continue to send data if necessary
    [self.transferManager canContinueSendingToCentrals];
}


/**
 *  Called whenever we received a write request for a characteristic. This is called when a central sends us data via a writable characteristic. The sent data is stored in a request's value property. A call to this method can contain multiple write requests, but we should only send a single response. Responding will trigger the CBPeripheral's peripheral:didWriteValueForCharacteristic:error: method on the sending device.
 *
 *  @param peripheral The CBPeripheralManager that received the request
 *  @param requests   An array of one or more write requests
 */
- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveWriteRequests:(NSArray *)requests
{
    for (CBATTRequest *writeRequest in requests)
    {
        [self.transferManager receivedDataFromCentral:writeRequest];
    }
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
    if (characteristic == self.advertisedInitialCharacteristic)
    {
        BTLog(3, @"Another device subscribed to our initial characteristic");
        [self _sendInitialDataToCentral:central];
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
    if (characteristic == self.advertisedInitialCharacteristic)
    {
        BTLog(3, @"Another device unsubscribed from our initial characteristic");
    }
}


/**
 *  Called after _doStartAdvertising was called and the advertising was started
 *
 *  @param peripheral The PeripheralManager advertising
 *  @param error      An error describing the reason for failure, or nil if no error occured and advertisement started
 */
- (void)peripheralManagerDidStartAdvertising:(CBPeripheralManager *)peripheral error:(NSError *)error
{
    BTLog(2, @"Did start advertising to other BT devices");
    
    if (error == nil)
    {
        if ([self.delegate respondsToSelector:@selector(didStartAdvertisingWithIdentifier:)])
        {
            [self.delegate didStartAdvertisingWithIdentifier:self.appState.identifier];
        }
    }
}


#pragma mark MCNearbyServiceBrowser

/**
 *  Called when the MCNearbyServiceBrowser detects a nearby peer
 *
 *  @param browser the browser that detected the peer
 *  @param peerID  the detected peer's ID
 *  @param info    the discovery info dictionary sent by the peer
 */
- (void)browser:(MCNearbyServiceBrowser *)browser foundPeer:(MCPeerID *)peerID withDiscoveryInfo:(NSDictionary *)info {
    CWBluetoothConnection *connection = [self _connectionForIdentifier:[peerID displayName]];
    if (connection == nil) return;
    if (connection.mcState != CWBluetoothConnectionMCStateSearching) return;
    
    MCLog(3, @"Found device %@ as MC peer. Inviting...", connection.identifier);
    
//    connection.mcState = CWBluetoothConnectionMCStateConnected;
    
    //We need to invite the found peer to our session. This will call MCSession's
//    [self.mcBrowser invitePeer:peerID toSession:self.mcSession withContext:nil timeout:-1]; //TODO change timeout
    MCSession *session = [[MCSession alloc] initWithPeer:self.mcID securityIdentity:nil encryptionPreference:MCEncryptionNone];
    [session setDelegate:self];
    [connection setMcSession:session];
//    [self.mcSessions setObject:session forKey:peerID];
    [self.mcBrowser invitePeer:peerID toSession:session withContext:nil timeout:-1];
}

/**
 *  Called when the MCNearbyServiceBrowser lost a previously detected peer
 *
 *  @param browser the browser that detected the loss
 *  @param peerID  the lost peer's ID
 */
- (void)browser:(MCNearbyServiceBrowser *)browser lostPeer:(MCPeerID *)peerID {
    CWBluetoothConnection *connection = [self _connectionForIdentifier:[peerID displayName]];
    if (connection == nil) return;
    
    MCLog(3, @"Lost device %@ as MC peer.", connection.identifier);
    
    [self _mcDisconnect:connection]; //cleanup
}

- (void)browser:(MCNearbyServiceBrowser *)browser didNotStartBrowsingForPeers:(NSError *)error {
    //TODO we should trigger an immediate failure
}

#pragma mark MCNearbyServiceAdvertiser

- (void)advertiser:(MCNearbyServiceAdvertiser *)advertiser didReceiveInvitationFromPeer:(MCPeerID *)peerID withContext:(NSData *)context invitationHandler:(void (^)(BOOL accept, MCSession *session))invitationHandler {
    MCLog(3, @"Received MC invitiation from device %@. Accepting...", [peerID displayName]);
    
    MCSession *session = [[MCSession alloc] initWithPeer:self.mcID securityIdentity:nil encryptionPreference:MCEncryptionNone];
//    [session setDelegate:self];
//    [self.mcSessions setObject:session forKey:peerID]; //TODO do we need this?
    invitationHandler(YES, session);
}

#pragma mark MCSession

- (void)session:(MCSession *)session peer:(MCPeerID *)peerID didChangeState:(MCSessionState)state {
    CWBluetoothConnection *connection = [self _connectionForIdentifier:[peerID displayName]];
    if (connection == nil) return;
    if (connection.mcState != CWBluetoothConnectionMCStateSearching) return;
    
    NSString *stateString = @"unknown";
    if (state == MCSessionStateConnecting) stateString = @"connecting";
    if (state == MCSessionStateConnected) stateString = @"connected!";
    if (state == MCSessionStateNotConnected) stateString = @"not connected";
    MCLog(3, @"MC Peer State of device %@ changed to %@", connection.identifier, stateString);
    
    switch (state) {
        case MCSessionStateConnecting:
            //We don't need to do anything here, still waiting
            break;
        case MCSessionStateConnected:
            connection.mcState = CWBluetoothConnectionMCStateConnected;
            
            //A short connection is enough to establish the ad hoc network. We can now disconnect MC and the ad hoc connection is kept
            //With the new ad hoc network, let's try that IP send one more
            [self _mcDisconnect:connection];
            [self sendNetworkAddressesToDevice:connection.identifier];
            
            break;
        case MCSessionStateNotConnected:
            //This usually happens when the connection failed for some reason
            [self _mcDisconnect:connection]; //cleanup
            
            //TODO we should probably try another MC connect here ?
            
            break;
    }
}

@end
