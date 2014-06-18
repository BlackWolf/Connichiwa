//
//  CWWebserver.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebserver.h"
#import <Nodelike/NLContext.h>
#import "CWBundle.h"
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebserver ()

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
 *  Creates a JSON string from a NSDictionary that can be safely send over JavaScriptCore's evaluteScript:.
 *  The dictionary must be convertable to JSON as defined by NSJSONSerialization
 *
 *  @param dictionary The dictionary to translate into JSON
 *
 *  @return The JSON string representing the Dictionary.
 */
- (NSString *)_JSONFromDictionary:(NSDictionary *)dictionary;

/**
 *  Registers the functions in Javascript that call native methods (and therefore allow the webserver to send messages to the native layer)
 */
- (void)_registerWebserverCallbacks;

@end



@implementation CWWebserver


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


- (void)sendLocalIdentifier:(NSString *)identifier
{
    NSDictionary *sendData = @{
                               @"type": @"localidentifier",
                               @"identifier": identifier,
                               };
    NSString *json = [self _JSONFromDictionary:sendData];
    [self _sendToWeblib:json];
}


- (void)sendDetectedDeviceWithIdentifier:(NSString *)identifier
{
    NSDictionary *sendData = @{
                               @"type": @"newdevice",
                               @"identifier": identifier,
                               };
    NSString *json = [self _JSONFromDictionary:sendData];
    [self _sendToWeblib:json];
}


- (void)sendDeviceWithIdentifier:(NSString *)identifier changedDistance:(double)distance
{
    NSDictionary *sendData = @{
                               @"type": @"devicedistancechanged",
                               @"identifier": identifier,
                               @"distance": [NSNumber numberWithDouble:distance]
                               };
    NSString *json = [self _JSONFromDictionary:sendData];
    [self _sendToWeblib:json];
}


- (void)sendLostDeviceWithIdentifier:(NSString *)identifier
{
    NSDictionary *sendData = @{
                               @"type": @"devicelost",
                               @"identifier": identifier,
                               };
    NSString *json = [self _JSONFromDictionary:sendData];
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
//    DLog(@"Sending %@", message);
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
- (NSString *)_JSONFromDictionary:(NSDictionary *)dictionary
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
        [weakSelf localWebsocketWasOpened];
    };
}


/**
 *  Called by the webserver when the websocket connection to the local web view was established successfully
 */
- (void)localWebsocketWasOpened
{
    if ([self.delegate respondsToSelector:@selector(localWebsocketWasOpened)])
    {
        [self.delegate localWebsocketWasOpened];
    }
}

@end
