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
#import "CWConstants.h"
#import "CWDebug.h"



@interface CWWebserver ()

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) NLContext *nodelikeContext;

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


- (void)start
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
            DLog(@"log: %@", [obj toString]);
        }];
    };
    self.nodelikeContext[@"console"] = @{@"log": logger, @"error": logger};
    
    //Pass some infos to the webserver
    self.nodelikeContext[@"SERVER_PORT"] = [NSString stringWithFormat:@"%d", WEBSERVER_PORT];
    self.nodelikeContext[@"RESOURCES_PATH"] = [[CWBundle bundle] bundlePath];
    
    //Start the actual webserver by executing our Node.JS server script
    NSString *serverScriptPath = [[CWBundle bundle] pathForResource:@"server" ofType:@"js"];
    NSString *serverScript = [NSString stringWithContentsOfFile:serverScriptPath encoding:NSUTF8StringEncoding error:nil];
    JSValue *serverScriptReturn = [self.nodelikeContext evaluateScript:serverScript];
    
    [NLContext runEventLoopAsyncInContext:self.nodelikeContext];
    
    if (![serverScriptReturn isUndefined])
    {
        DLog(@"executed code, result is %@", [serverScriptReturn toString]);
    }
}


- (void)sendBeaconInfo:(CWBeacon *)beacon
{
    
}

@end
