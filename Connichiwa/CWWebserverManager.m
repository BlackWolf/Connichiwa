//
//  CWWebserver.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebserverManager.h"
#import <Nodelike/NLContext.h>
#import "CWUtil.h"
#import "CWBundle.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebserverManager ()

@property (readwrite, strong) NSString *documentRoot;

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) NLContext *nodelikeContext;

/**
 *  Uses the webserver to sends the given message to the web library
 *
 *  @param message The message to send to the web library
 */
- (void)_sendToWeblib:(NSString *)message;

/**
 *  Registers the functions in Javascript that call native methods (and therefore allow the webserver to send messages to the native layer)
 */
- (void)_registerJavascriptCallbacks;

@end



@implementation CWWebserverManager



- (instancetype)initWithDocumentRoot:(NSString *)documentRoot
{
    self = [super init];
    
    self.documentRoot = documentRoot;
    
    return self;
}


- (void)startWebserver
{
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
    self.nodelikeContext[@"SERVER_PORT"] = [NSString stringWithFormat:@"%d", WEBSERVER_PORT];
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


#pragma mark Weblib Communication - Sending


- (void)sendToWeblib_localIdentifier:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"localidentifier",
                           @"identifier": identifier
                           };
    [self _sendDictionaryToWeblib:data];
}


- (void)sendToWeblib_deviceDetected:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"devicedetected",
                           @"identifier": identifier
                           };
    [self _sendDictionaryToWeblib:data];
}


- (void)sendToWeblib_device:(NSString *)identifier changedDistance:(double)distance
{
    NSDictionary *data = @{
                           @"type": @"devicedistancechanged",
                           @"identifier": identifier,
                           @"distance": [NSNumber numberWithDouble:(round(distance * 10) / 10)]
                           };
    [self _sendDictionaryToWeblib:data];
}


- (void)sendToWeblib_connectionRequestFailed:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"connectionRequestFailed",
                           @"identifier": identifier
                           };
    [self _sendDictionaryToWeblib:data];
}


- (void)_sendDictionaryToWeblib:(NSDictionary *)dictionary
{
    NSString *json = [CWUtil escapedJSONStringFromDictionary:dictionary];
    [self _sendToWeblib:json];
}


/**
 *  Sends the given message to the web library through the Nodelike server.
 *
 *  @param message The message to send to the web library.
 */
- (void)_sendToWeblib:(NSString *)message
{
    //    DLog(@"Sending %@", message);
    [self.nodelikeContext evaluateScript:[NSString stringWithFormat:@"sendToWeblib('%@')", message]];
}


#pragma mark Weblib Communication - Receiving


- (void)_receivedFromWeblib_connectionRequest:(NSDictionary *)message
{
    if ([self.delegate respondsToSelector:@selector(didReceiveConnectionRequest:)])
    {
        NSString *targetIdentifier = message[@"identifier"];
        [self.delegate didReceiveConnectionRequest:targetIdentifier];
    }
}


- (void)_receivedFromWeblib_remoteConnected:(NSDictionary *)message
{
    if ([self.delegate respondsToSelector:@selector(didConnectToRemoteDevice:)])
    {
        NSString *remoteIdentifier = message[@"identifier"];
        [self.delegate didConnectToRemoteDevice:remoteIdentifier];
    }
}


#pragma mark Webserver Callbacks


- (void)_registerWebserverCallbacks
{
    __weak typeof(self) weakSelf = self;
    
    self.nodelikeContext[@"native_didLoadWeblib"] = ^{
        [weakSelf _didLoadWeblib];
    };
    
    self.nodelikeContext[@"native_receivedFromWeblib"] = ^(NSString *message) {
        [weakSelf _receivedFromWeblib:message];
    };
}


- (void)_didLoadWeblib
{
    if ([self.delegate respondsToSelector:@selector(managerDidLoadWeblib:)])
    {
        [self.delegate didConnectToWeblib];
    }
}


- (void)_receivedFromWeblib:(NSString *)message
{
    NSDictionary *messageData = [NSJSONSerialization JSONObjectWithData:[message dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    //    DLog(@"Got message: %@", messageData);
    
    if ([messageData[@"type"] isEqualToString:@"connectionRequest"])    [self _receivedFromWeblib_connectionRequest:messageData];
    else if ([messageData[@"type"] isEqualToString:@"remoteConnected"]) [self _receivedFromWeblib_remoteConnected:messageData];
}

@end
