//
//  CWWebserverManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebserverManager.h"
#import <Nodelike/NLContext.h>
#import "CWUtil.h"
#import "CWBundle.h"
#import "CWDebug.h"



@interface CWWebserverManager ()

@property (readwrite, strong) NSString *documentRoot;

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) NLContext *nodelikeContext;

/**
 *  Sends the given dictionary to the web library as a JSON string. First transform the dictionary and then calls _sendToWeblib with the resulting JSON
 *
 *  @param dictionary The dictionary
 */
- (void)_sendDictionaryToWeblib:(NSDictionary *)dictionary;

/**
 *  Sends the given message to the web library
 *
 *  @param message The message
 */
- (void)_sendToWeblib:(NSString *)message;

/**
 *  Called when we received a "connectionRequest" message from the web library. This means the web library wants us to connect to another device and use it as a remote device. The identifier of the remote device is stored in message.targetIdentifier
 *
 *  @param message The JSON string received from the web library as an NSDictionary
 */
- (void)_receivedFromWeblib_connectionRequest:(NSDictionary *)message;

/**
 *  Called when we received a "remoteConnected" message from the web library. This means that a remote device has established a websocket connection to the web library. The identifier of the connected device is stored in message.remoteIdentifier.
 *
 *  @param message The JSON string received from the web library as an NSDictionary
 */
- (void)_receivedFromWeblib_remoteConnected:(NSDictionary *)message;

/**
 *  Registers the functions in Javascript that call native methods (and therefore allow the webserver to send messages to the native layer)
 */
- (void)_registerWebserverCallbacks;

/**
 *  JS Callback that the webserver calls when the web library has connected and is loaded
 */
- (void)_didLoadWeblib;

/**
 *  JS Callback that the webserver calls whenever it receives a websocket message that should be forwarded to the native layer.
 *
 *  @param message The message received via websocket. Should always be a valid JSON string.
 */
- (void)_receivedFromWeblib:(NSString *)message;

@end



@implementation CWWebserverManager


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot
{
    self = [super init];
    
    self.documentRoot = documentRoot;
    
    return self;
}


- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port
{
    self.documentRoot = documentRoot;
    
    self.nodelikeContext = [[NLContext alloc] initWithVirtualMachine:[[JSVirtualMachine alloc] init]];
    
    //Register JS error handler
    self.nodelikeContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
        dispatch_async(dispatch_get_main_queue(), ^{
            DLog(@"%@ stack: %@", e, [e valueForProperty:@"stack"]);
        });
    };
    
    //Register JS logger handler
    id logger = ^(JSValue *thing) {
        [JSContext.currentArguments enumerateObjectsUsingBlock:^(id obj, NSUInteger idx, BOOL *stop) {
            DLog(@"%@", [obj toString]);
        }];
    };
    self.nodelikeContext[@"console"] = @{@"log": logger, @"error": logger};
    
    [self _registerWebserverCallbacks];
    
    //Pass some infos to the webserver
    self.nodelikeContext[@"SERVER_PORT"] = [NSString stringWithFormat:@"%d", port];
    self.nodelikeContext[@"DOCUMENT_ROOT"] = self.documentRoot;
    self.nodelikeContext[@"RESOURCES_PATH"] = [[CWBundle bundle] bundlePath];
    self.nodelikeContext[@"CWDEBUG"] = [JSValue valueWithBool:NO inContext:self.nodelikeContext];;
    [CWDebug executeInDebug:^{
        self.nodelikeContext[@"CWDEBUG"] = [JSValue valueWithBool:YES inContext:self.nodelikeContext];
    }];
    
    //Start the actual webserver by executing our Node.JS server script
    NSString *serverScriptPath = [[CWBundle bundle] pathForResource:@"server" ofType:@"js"];
    NSString *serverScript = [NSString stringWithContentsOfFile:serverScriptPath encoding:NSUTF8StringEncoding error:nil];
    JSValue *serverScriptReturn = [self.nodelikeContext evaluateScript:serverScript];
    
    [NLContext runEventLoopAsyncInContext:self.nodelikeContext];
    
    if (![serverScriptReturn isUndefined]) DLog(@"executed server.js, result is %@", [serverScriptReturn toString]);
    
    //I'm not sure if this should in some way be attached to the runEventLoopAsyncInContext:, but I suppose triggering this here will be fine
    if ([self.delegate respondsToSelector:@selector(didStartWebserver)])
    {
        [self.delegate didStartWebserver];
    }
}


- (void)startWebserverOnPort:(int)port
{
    [self startWebserverWithDocumentRoot:self.documentRoot onPort:port];
}


//#pragma mark Weblib Communication - Sending
//
//
//- (void)sendToWeblib_localIdentifier:(NSString *)identifier
//{
//    NSDictionary *data = @{
//                           @"type": @"localidentifier",
//                           @"identifier": identifier
//                           };
//    [self _sendDictionaryToWeblib:data];
//}
//
//
//- (void)sendToWeblib_deviceDetected:(NSString *)identifier
//{
//    NSDictionary *data = @{
//                           @"type": @"devicedetected",
//                           @"identifier": identifier
//                           };
//    [self _sendDictionaryToWeblib:data];
//}
//
//
//- (void)sendToWeblib_device:(NSString *)identifier changedDistance:(double)distance
//{
//    NSDictionary *data = @{
//                           @"type": @"devicedistancechanged",
//                           @"identifier": identifier,
//                           @"distance": [NSNumber numberWithDouble:(round(distance * 10) / 10)]
//                           };
//    [self _sendDictionaryToWeblib:data];
//}
//
//
//- (void)sendToWeblib_deviceLost:(NSString *)identifier
//{
//    NSDictionary *data = @{
//                           @"type": @"devicelost",
//                           @"identifier": identifier
//                           };
//    [self _sendDictionaryToWeblib:data];
//}
//
//
//- (void)sendToWeblib_connectionRequestFailed:(NSString *)identifier
//{
//    NSDictionary *data = @{
//                           @"type": @"connectionRequestFailed",
//                           @"identifier": identifier
//                           };
//    [self _sendDictionaryToWeblib:data];
//}
//
//
//- (void)_sendDictionaryToWeblib:(NSDictionary *)dictionary
//{
//    NSString *json = [CWUtil escapedJSONStringFromDictionary:dictionary];
//    [self _sendToWeblib:json];
//}
//
//
//- (void)_sendToWeblib:(NSString *)message
//{
//    DLog(@"Sending %@", message);
//    [self.nodelikeContext evaluateScript:[NSString stringWithFormat:@"sendToWeblib('%@')", message]];
//}
//
//
//#pragma mark Weblib Communication - Receiving
//
//
//- (void)_receivedFromWeblib_connectionRequest:(NSDictionary *)message
//{
//    if ([self.delegate respondsToSelector:@selector(didReceiveConnectionRequest:)])
//    {
//        NSString *targetIdentifier = message[@"identifier"];
//        [self.delegate didReceiveConnectionRequest:targetIdentifier];
//    }
//}
//
//
//- (void)_receivedFromWeblib_remoteConnected:(NSDictionary *)message
//{
//    if ([self.delegate respondsToSelector:@selector(didConnectToRemoteDevice:)])
//    {
//        NSString *remoteIdentifier = message[@"identifier"];
//        [self.delegate didConnectToRemoteDevice:remoteIdentifier];
//    }
//}
//
//
#pragma mark Webserver Communication


- (void)_registerWebserverCallbacks
{
//    __weak typeof(self) weakSelf = self;
//    
//    self.nodelikeContext[@"native_remoteConnectionEstablished"] = ^(NSString *identifier) {
//        [weakSelf _fromWebserver_remoteConnectionEstablished:identifier];
//    };
}

//
//
//- (void)_didLoadWeblib
//{
//    if ([self.delegate respondsToSelector:@selector(didConnectToWeblib)])
//    {
//        [self.delegate didConnectToWeblib];
//    }
//}
//
//
//- (void)_receivedFromWeblib:(NSString *)message
//{
//    NSDictionary *messageData = [NSJSONSerialization JSONObjectWithData:[message dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
//    //    DLog(@"Got message: %@", messageData);
//    
//    if ([messageData[@"type"] isEqualToString:@"connectionRequest"])    [self _receivedFromWeblib_connectionRequest:messageData];
//    else if ([messageData[@"type"] isEqualToString:@"remoteConnected"]) [self _receivedFromWeblib_remoteConnected:messageData];
//}

@end
