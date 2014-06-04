//
//  CWNodelikeRunner.m
//  Connichiwa
//
//  Created by Mario Schreiner on 04/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebserver.h"
#import <Nodelike/NLContext.h>



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
    
    //Register error handler
    _nodelikeContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSLog(@"%@ stack: %@", e, [e valueForProperty:@"stack"]);
        });
    };
    //Register logger handler
    id logger = ^(JSValue *thing) {
        [JSContext.currentArguments enumerateObjectsUsingBlock:^(id obj, NSUInteger idx, BOOL *stop) {
            NSLog(@"log: %@", [obj toString]);
        }];
    };
    _nodelikeContext[@"console"] = @{@"log": logger, @"error": logger};
    
    //Grab framework bundle
    NSString *mainBundlePath = [[NSBundle mainBundle] resourcePath];
    NSString *frameworkBundlePath = [mainBundlePath stringByAppendingPathComponent:@"ConnichiwaResources.bundle"];
    NSBundle *frameworkBundle = [NSBundle bundleWithPath:frameworkBundlePath];
    
    NSString *mainJsPath = [frameworkBundle pathForResource:@"server" ofType:@"js"];
    
    //Find the JS-file that will start our server and
    //NSString *mainJsPath = [[NSBundle mainBundle] pathForResource:@"server" ofType:@"js"];
    
    NSString *mainJs = [NSString stringWithContentsOfFile:mainJsPath encoding:NSUTF8StringEncoding error:nil];
    
    //Actually execute the JS and by that start our NodeJS server
    JSValue *ret = [_nodelikeContext evaluateScript:mainJs];
    [NLContext runEventLoopAsyncInContext:self.nodelikeContext];
    
    if (![ret isUndefined])
    {
        NSLog(@"executed code, result is %@", [ret toString]);
    }
}

@end
