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
@property (readwrite, strong) NSString *localIdentifier;

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
    if ([self.delegate respondsToSelector:@selector(managerDidStartWebserver:)])
    {
        [self.delegate managerDidStartWebserver:self];
    }
}


- (void)loadWeblibOnWebView:(UIWebView *)webView withLocalIdentifier:(NSString *)identifier
{
    self.localIdentifier = identifier;
    
    //Open 127.0.0.1, which will load the Connichiwa Web Library on this device and initiate the local websocket connection
    //The webserver will report back to us by calling _didLoadWeblib once the websocket connection was established
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", WEBSERVER_PORT]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    [webView loadRequest:localhostURLRequest];
}


#pragma mark Web Library Communication Protocol


//- (void)sendDetectedDeviceWithIdentifier:(NSString *)identifier
//{
//    NSDictionary *sendData = @{
//                               @"type": @"newdevice",
//                               @"identifier": identifier,
//                               };
//    NSString *json = [CWUtil escapedJSONStringFromDictionary:sendData];
//    [self _sendToWeblib:json];
//}
//
//
//- (void)sendDeviceWithIdentifier:(NSString *)identifier changedDistance:(double)distance
//{
//    NSDictionary *sendData = @{
//                               @"type": @"devicedistancechanged",
//                               @"identifier": identifier,
//                               @"distance": [NSNumber numberWithDouble:(round(distance * 10) / 10)]
//                               };
//    NSString *json = [CWUtil escapedJSONStringFromDictionary:sendData];
//    [self _sendToWeblib:json];
//}
//
//
//- (void)sendLostDeviceWithIdentifier:(NSString *)identifier
//{
//    NSDictionary *sendData = @{
//                               @"type": @"devicelost",
//                               @"identifier": identifier,
//                               };
//    NSString *json = [CWUtil escapedJSONStringFromDictionary:sendData];
//    [self _sendToWeblib:json];
//}





#pragma mark Weblib Communication - Sending


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


- (void)_sendToWeblib_localIdentifier
{
    NSDictionary *data = @{
                           @"type": @"localidentifier",
                           @"identifier": self.localIdentifier
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


- (void)_didReceiveMessageFromWeblib:(NSString *)message
{
    NSDictionary *messageData = [NSJSONSerialization JSONObjectWithData:[message dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    
    DLog(@"Got message: %@", messageData);
    if ([messageData[@"type"] isEqualToString:@"connectionRequest"])
    {
        if ([self.delegate respondsToSelector:@selector(managerDidReceiveConnectionRequest:)])
        {
            NSString *targetIdentifier = messageData[@"identifier"];
            [self.delegate managerDidReceiveConnectionRequest:targetIdentifier];
        }
    }
}


#pragma mark Webserver Callbacks


- (void)_registerWebserverCallbacks
{
    __weak typeof(self) weakSelf = self;
    
    self.nodelikeContext[@"native_didReceiveMessageFromWeblib"] = ^(NSString *message) {
        [weakSelf _didReceiveMessageFromWeblib:message];
    };
    
    self.nodelikeContext[@"native_didLoadWeblib"] = ^{
        [weakSelf _didLoadWeblib];
    };
}


- (void)_didLoadWeblib
{
    //Send the identifier of this device to the weblib, after that the weblib is ready
    [self _sendToWeblib_localIdentifier];
    
    if ([self.delegate respondsToSelector:@selector(managerDidLoadWeblib:)])
    {
        [self.delegate managerDidLoadWeblib:self];
    }
}

@end
