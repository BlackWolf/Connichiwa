//
//  CWBluetoothTransferManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 07/07/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWBluetoothTransferManager.h"
#import "CWDebug.h"



@interface CWBluetoothTransferCentralKey : NSObject <NSCopying>

@property (readwrite, strong) CBCentral *central;
@property (readwrite, strong) CBCharacteristic *characteristic;

@end



@implementation CWBluetoothTransferCentralKey


- (instancetype)init
{
    [NSException raise:@"Not allowed" format:@"Cant create TransferCentralKey without a central and characteristic"];
    
    return nil;
}


- (instancetype)initWithCentral:(CBCentral *)central characteristic:(CBCharacteristic *)characteristic
{
    self = [super init];
    
    self.central = central;
    self.characteristic = characteristic;
    
    return self;
}


- (BOOL)isEqual:(id)object
{
    if (object == self) return YES;
    if ([object isKindOfClass:[CWBluetoothTransferCentralKey class]] == NO) return NO;
    
    return [self isEqualToCWBluetoothTransferCentralKey:object];
}


- (BOOL)isEqualToCWBluetoothTransferCentralKey:(CWBluetoothTransferCentralKey *)otherKey
{
    return ([otherKey.central isEqual:self.central] && [otherKey.characteristic isEqual:self.characteristic]);
}


- (NSUInteger)hash
{
    NSUInteger prime = 31;
    NSUInteger result = 1;
    
    result = prime * result + [self.central hash];
    result = prime * result + [self.characteristic hash];
    
    return result;
}


- (id)copyWithZone:(NSZone *)zone
{
    return [[CWBluetoothTransferCentralKey alloc] initWithCentral:self.central characteristic:self.characteristic];
}

@end



@interface CWBluetoothTransferPeripheralKey : NSObject <NSCopying>

@property (readwrite, strong) CBPeripheral *peripheral;
@property (readwrite, strong) CBCharacteristic *characteristic;

@end



@implementation CWBluetoothTransferPeripheralKey


- (instancetype)init
{
    [NSException raise:@"Not allowed" format:@"Cant create TransferPeripheralKey without a peripheral and characteristic"];
    
    return nil;
}


- (instancetype)initWithPeripheral:(CBPeripheral *)peripheral characteristic:(CBCharacteristic *)characteristic
{
    self = [super init];
    
    self.peripheral = peripheral;
    self.characteristic = characteristic;
    
    return self;
}


- (BOOL)isEqual:(id)object
{
    if (object == self) return YES;
    if ([object isKindOfClass:[CWBluetoothTransferPeripheralKey class]] == NO) return NO;
    
    return [self isEqualToCWBluetoothTransferPeripheralKey:object];
}


- (BOOL)isEqualToCWBluetoothTransferPeripheralKey:(CWBluetoothTransferPeripheralKey *)otherKey
{
    return ([otherKey.peripheral isEqual:self.peripheral] && [otherKey.characteristic isEqual:self.characteristic]);
}


- (NSUInteger)hash
{
    NSUInteger prime = 31;
    NSUInteger result = 1;
    
    result = prime * result + [self.peripheral hash];
    result = prime * result + [self.characteristic hash];
    
    return result;
}


- (id)copyWithZone:(NSZone *)zone
{
    return [[CWBluetoothTransferPeripheralKey alloc] initWithPeripheral:self.peripheral characteristic:self.characteristic];
}

@end



@interface CWBluetoothTransferManager ()

@property (readwrite, strong) CBPeripheralManager *peripheralManager;
@property (readwrite, strong) NSMutableDictionary *peripheralSends;
@property (readwrite, strong) NSMutableDictionary *centralSends;
@property (readwrite, strong) NSMutableArray *centralEOMSends;
@property (readwrite, strong) NSMutableDictionary *peripheralReceives;
@property (readwrite, strong) NSMutableDictionary *centralReceives;

@end



@implementation CWBluetoothTransferManager

- (instancetype)initWithPeripheralManager:(CBPeripheralManager *)peripheralManager
{
    self = [super init];
    
    self.peripheralManager  = peripheralManager;
    self.peripheralSends    = [NSMutableDictionary dictionary];
    self.centralSends       = [NSMutableDictionary dictionary];
    self.centralEOMSends    = [NSMutableArray array];
    self.peripheralReceives = [NSMutableDictionary dictionary];
    self.centralReceives    = [NSMutableDictionary dictionary];
    
    return self;
}


#pragma mark Peripheral -> Central


- (void)receivedData:(NSData *)chunk fromPeripheral:(CBPeripheral *)peripheral withCharacteristic:(CBCharacteristic *)characteristic
{
    CWBluetoothTransferPeripheralKey *key = [[CWBluetoothTransferPeripheralKey alloc] initWithPeripheral:peripheral characteristic:characteristic];
    NSMutableData *existingData = [self.peripheralReceives objectForKey:key];
    
    if ([[[NSString alloc] initWithData:chunk encoding:NSUTF8StringEncoding] isEqualToString:@"EOM"])
    {
        BTLog(4, @"Received EOM from peripheral %@, message complete.", peripheral.name);
        [self.peripheralReceives removeObjectForKey:key];
        
        if ([self.delegate respondsToSelector:@selector(didReceiveMessage:fromPeripheral:withCharacteristic:)])
        {
            [self.delegate didReceiveMessage:existingData fromPeripheral:peripheral withCharacteristic:characteristic];
        }
        return;
    }
    
    BTLog(4, @"Received chunk of data from peripheral %@: %@", peripheral.name, [[NSString alloc] initWithData:chunk encoding:NSUTF8StringEncoding]);
    
    if (existingData == nil)
    {
        [self.peripheralReceives setObject:[chunk mutableCopy] forKey:key];
    }
    else
    {
        [existingData appendData:chunk];
    }
}

- (void)sendData:(NSData *)data toCentral:(CBCentral *)central withCharacteristic:(CBMutableCharacteristic *)characteristic
{
    BTLog(3, @"Preparing to send data to central %@: %@", [central.identifier UUIDString], [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
    
    CWBluetoothTransferCentralKey *key = [[CWBluetoothTransferCentralKey alloc] initWithCentral:central characteristic:characteristic];
    [self.centralSends setObject:[data mutableCopy] forKey:key];
    [self _sendNextChunkToCentral:key];
}


- (void)_sendNextChunkToCentral:(CWBluetoothTransferCentralKey *)key
{
    NSMutableData *remainingData = [self.centralSends objectForKey:key];
    
    if (remainingData == nil)
    {
        ErrLog(@"Tried to send data to a central where no data was left to send - this should never happen, something went majorly wrong here");
        return;
    }
    
    NSUInteger bytesToSend = 20;
    if ([remainingData length] < bytesToSend) bytesToSend = [remainingData length];
    
    NSData *chunk = [NSData dataWithBytes:[remainingData bytes] length:bytesToSend];
    BOOL didSend = [self.peripheralManager updateValue:chunk forCharacteristic:(CBMutableCharacteristic *)key.characteristic onSubscribedCentrals:@[key.central]];
    
    //If there is still room in the sendqueue (didSend==YES), we can go on sending
    //If the queue is full we wait for the peripheralManagerIsReadyToSend callback, which will call this method again
    if (didSend)
    {
        BTLog(4, @"Did send chunk of data to central %@: %@", [key.central.identifier UUIDString], [[NSString alloc] initWithData:chunk encoding:NSUTF8StringEncoding]);
        //Remove the chunk we just sent from the remaining data
        NSRange range = NSMakeRange(0, bytesToSend);
        [remainingData replaceBytesInRange:range withBytes:NULL length:0]; //note: this will update the nsdata entry in centralSends as well
        
        if ([remainingData length] == 0)
        {
            //We sent all regular data, we just need to sent the EOM and we're done
            [self.centralSends removeObjectForKey:key];
            [self.centralEOMSends addObject:key];
            
            [self _sendEOMToCentral:key];
        }
        else
        {
            //Still data to send, so let's go on
            [self _sendNextChunkToCentral:key];
        }
    }
    else
    {
        BTLog(5, @"Tried to send chunk of data to central %@, but queue was full", [key.central.identifier UUIDString]);
    }
}


- (void)_sendEOMToCentral:(CWBluetoothTransferCentralKey *)key
{
    if ([self.centralEOMSends containsObject:key] == NO)
    {
        ErrLog(@"Tried to send EOM that either received no data or already got the EOM - this should never happen, something went majorly wrong here");
        return;
    }
    
    NSData *eomData = [@"EOM" dataUsingEncoding:NSUTF8StringEncoding];
    BOOL didSend = [self.peripheralManager updateValue:eomData forCharacteristic:key.characteristic onSubscribedCentrals:@[key.central]];
    
    //If the EOM was sent we are done with this central, otherwise we need for peripheralManagerIsReadyToSend to call this method
    if (didSend)
    {
        BTLog(4, @"Did send EOM to central %@, message complete.", [key.central.identifier UUIDString]);
        [self.centralEOMSends removeObject:key];
        //TODO send something to delegate I guess, we completed the send
    }
    else
    {
        BTLog(5, @"Tried to send EOM to central %@, but queue was full", [key.central.identifier UUIDString]);
    }
}


- (void)canContinueSendingToCentrals
{
    //First, see if we have EOMs that need to be send and complete those
    if ([self.centralEOMSends count] > 0)
    {
        [self _sendEOMToCentral:[self.centralEOMSends objectAtIndex:0]];
        return;
    }
    
    //If we have no outstanding EOMs, continue sending regular message data if necessary
    if ([self.centralSends count] > 0)
    {
        [self _sendNextChunkToCentral:[[self.centralSends allKeys] objectAtIndex:0]];
        return;
    }
}


#pragma mark Central -> Peripheral

- (void)sendData:(NSData *)data toPeripheral:(CBPeripheral *)peripheral withCharacteristic:(CBCharacteristic *)characteristic
{
    //Luckily, sending to peripherals is much easier than sending to centrals. Just split the data in chunks of 20 bytes and fire away in a loop
    NSMutableData *toSend = [data mutableCopy];
    while ([toSend length] > 0)
    {
        NSUInteger bytesToSend = 20;
        if ([toSend length] < bytesToSend) bytesToSend = [toSend length];
        
        NSData *chunk = [NSData dataWithBytes:[toSend bytes] length:bytesToSend];
        [peripheral writeValue:chunk forCharacteristic:characteristic type:CBCharacteristicWriteWithoutResponse];
        
        //Remove sent chunk from data to send
        NSRange range = NSMakeRange(0, bytesToSend);
        [toSend replaceBytesInRange:range withBytes:NULL length:0];
        
        BTLog(4, @"Did send chunk of data to peripheral %@: %@", peripheral.name, [[NSString alloc] initWithData:chunk encoding:NSUTF8StringEncoding]);
    }
    
    //Send the EOM
    //We only care about if the complete message was received well, so we use WriteWithResponse here while we used WriteWithoutResponse for the other writes
    [peripheral writeValue:[@"EOM" dataUsingEncoding:NSUTF8StringEncoding] forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
    
    BTLog(4, @"Did send EOM to peripheral %@, message complete.", peripheral.name);
}


- (void)receivedDataFromCentral:(CBATTRequest *)writeRequest
{
    NSData *chunk = writeRequest.value;
    CBCentral *central = writeRequest.central;
    CBCharacteristic *characteristic = writeRequest.characteristic;
    
    CWBluetoothTransferCentralKey *key = [[CWBluetoothTransferCentralKey alloc] initWithCentral:central characteristic:characteristic];
    NSMutableData *existingData = [self.centralReceives objectForKey:key];
    
    if ([[[NSString alloc] initWithData:chunk encoding:NSUTF8StringEncoding] isEqualToString:@"EOM"])
    {
        BTLog(4, @"Received EOM from central %@, message complete.", [central.identifier UUIDString]);
        [self.centralReceives removeObjectForKey:key];
        
        if ([self.delegate respondsToSelector:@selector(didReceiveMessage:fromCentral:withCharacteristic:lastWriteRequest:)])
        {
            [self.delegate didReceiveMessage:existingData fromCentral:central withCharacteristic:characteristic lastWriteRequest:writeRequest];
        }
        return;
    }
    
    BTLog(4, @"Received chunk of data from central %@: %@", [central.identifier UUIDString], [[NSString alloc] initWithData:chunk encoding:NSUTF8StringEncoding]);
    
    if (existingData == nil)
    {
        [self.centralReceives setObject:[chunk mutableCopy] forKey:key];
    }
    else
    {
        [existingData appendData:chunk];
    }
}

@end