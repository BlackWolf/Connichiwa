//
//  CWNodelikeRunner.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebserver.h"
#import <Nodelike/NLContext.h>
#import "CWBundle.h"
#import "CWBeacon.h"
#import "CWDevice.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebserver ()

@property (readwrite, strong) NSString *documentRoot;

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) NLContext *nodelikeContext;

- (void)_sendToWeblib:(NSString *)message;

@end



@implementation CWWebserver


+ (instancetype)sharedServer
{
    static dispatch_once_t token;
    static id sharedInstance;
    dispatch_once(&token, ^{
        sharedInstance = [[self alloc] init];
    });
    
    return sharedInstance;
}


- (void)startWithDocumentRoot:(NSString *)documentRoot
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
}


#pragma mark Web Library Communication Protocol


- (void)sendLocalInfo:(CWBeacon *)localBeacon
{
    NSDictionary *sendData = @{
                               @"type": @"localinfo",
                               @"major": localBeacon.major,
                               @"minor": localBeacon.minor,
                               };
    NSString *json = [self JSONFromDictionary:sendData];
    [self _sendToWeblib:json];
}


- (void)sendDeviceInfo:(CWDevice *)device
{
    //TODO change to type device
    NSDictionary *sendData = @{
                               @"type": @"ibeacon",
                               @"major": device.major,
                               @"minor": device.minor,
                               @"proximity": device.proximityString
                               };
    NSString *json = [self JSONFromDictionary:sendData];
    [self _sendToWeblib:json];
}


#pragma mark Helper


/**
 *  Sends the given message to the web library through the Nodelike server.
 *
 *  @param message The message to send to the web library.
 */
- (void)_sendToWeblib:(NSString *)message
{
    DLog(@"Sending %@", message);
    [self.nodelikeContext evaluateScript:[NSString stringWithFormat:@"sendToWeblib('%@')", message]];
}


/**
 *  Creates a JSON string from a NSDictionary that can be safely send over JavaScriptCore's evaluteScript:.
 *  The dictionary must be convertable to JSON as defined by NSJSONSerialization
 *
 *  @param dictionary The dictionary to translate into JSON
 *
 *  @return The JSON string representing the Dictionary.
 */
- (NSString *)JSONFromDictionary:(NSDictionary *)dictionary
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
    
    return json;
}


#pragma mark Webserver Callbacks


- (void)_registerWebserverCallbacks
{
    __weak typeof(self) weakSelf = self;
    self.nodelikeContext[@"native_localWebsocketWasOpened"] = ^{
        [weakSelf _localWebsocketWasOpened];
    };
}


- (void)_localWebsocketWasOpened
{
    if ([self.delegate respondsToSelector:@selector(localWebsocketWasOpened)])
    {
        [self.delegate localWebsocketWasOpened];
    }
}

@end
