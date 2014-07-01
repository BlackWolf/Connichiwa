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

@property (readwrite) CWWebserverManagerState state;

@property (readwrite, strong) NSString *documentRoot;

/**
 *  A Nodelike-specific subclass of JSContext that is used to execute code and for communication between Objective-C and the Nodelike server
 */
@property (strong, readwrite) NLContext *nodelikeContext;

@end



@implementation CWWebserverManager


- (instancetype)initWithDocumentRoot:(NSString *)documentRoot
{
    self = [super init];
    
    self.state = CWWebserverManagerStateStopped;
    self.documentRoot = documentRoot;
    
    return self;
}


- (void)startWebserverWithDocumentRoot:(NSString *)documentRoot onPort:(int)port
{
    self.state = CWWebserverManagerStateStarting;
    
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
    
    [self _registerJSCallbacks];
    
    //Pass some infos to the webserver
    self.nodelikeContext[@"HTTP_PORT"] = [NSString stringWithFormat:@"%d", port];
    self.nodelikeContext[@"DOCUMENT_ROOT"] = self.documentRoot;
    self.nodelikeContext[@"RESOURCES_PATH"] = [[CWBundle bundle] bundlePath];
    self.nodelikeContext[@"CWDEBUG"] = [JSValue valueWithBool:NO inContext:self.nodelikeContext];;
    [CWDebug executeInDebug:^{
        self.nodelikeContext[@"CWDEBUG"] = [JSValue valueWithBool:YES inContext:self.nodelikeContext];
    }];
    
    //Start the actual webserver by executing our Node.JS server script
    NSString *serverScriptPath = [[CWBundle bundle] pathForResource:@"server" ofType:@"js"];
    NSString *serverScript = [NSString stringWithContentsOfFile:serverScriptPath encoding:NSUTF8StringEncoding error:nil];
    
    [self.nodelikeContext evaluateScript:serverScript];
    [self.nodelikeContext evaluateScript:@"startListening();"];
    [NLContext runEventLoopAsyncInContext:self.nodelikeContext];
}


- (void)startWebserverOnPort:(int)port
{
    [self startWebserverWithDocumentRoot:self.documentRoot onPort:port];
}


- (void)suspendWebserver
{
    if (self.state != CWWebserverManagerStateStarted) return;
    
    self.state = CWWebserverManagerStateSuspended;
    [self.nodelikeContext evaluateScript:@"softDisconnectAllRemotes();"];
}


- (void)resumeWebserver
{
    // When we suspended, we soft disconnected all remotes
    // On resume, we don't need to do anything - we just make it possible for remotes to connect again
    // Furthermore, the local web library connection will automatically reconnect without us doing anything
    self.state = CWWebserverManagerStateStarted;
}


#pragma mark WebView Communication


- (void)_registerJSCallbacks
{
    if (self.nodelikeContext == nil) return;
    
    __weak typeof(self) weakSelf = self;
    
    self.nodelikeContext[@"native_serverDidStart"] = ^(NSString *identifier) {
        [weakSelf _receivedFromServer_serverDidStart];
    };
    
    self.nodelikeContext[@"native_remoteWebsocketDidClose"] = ^(NSString *identifier) {
        [weakSelf _receivedFromServer_remoteWebsocketDidClose:identifier];
    };
}


- (void)_receivedFromServer_serverDidStart
{
    self.state = CWWebserverManagerStateStarted;
    
    if ([self.delegate respondsToSelector:@selector(didStartWebserver)])
    {
        [self.delegate didStartWebserver];
    }
}


- (void)_receivedFromServer_remoteWebsocketDidClose:(NSString *)identifier
{
    if ([self.delegate respondsToSelector:@selector(remoteDidDisconnect:)])
    {
        [self.delegate remoteDidDisconnect:identifier];
    }
}


@end
