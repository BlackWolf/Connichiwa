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
    CWLog(1, @"Webserver is starting with document root %@ on port %d", documentRoot, port);
    
    self.state = CWWebserverManagerStateStarting;
    
    self.documentRoot = documentRoot;
    
    self.nodelikeContext = [[NLContext alloc] initWithVirtualMachine:[[JSVirtualMachine alloc] init]];
    
    //Register JS error handler
    self.nodelikeContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
        dispatch_async(dispatch_get_main_queue(), ^{
            _CWLog(1, @"WEBSERVER", @"?????", -1, @"JAVASCRIPT ERROR: %@. Stack: %@", e, [e valueForProperty:@"stack"]);
        });
    };
    
    id logger = ^(NSString *logMessage)
    {
        NSArray *components = [logMessage componentsSeparatedByString:@"|"]; //array should contain: prio, message
        if ([components count] != 2)
        {
            _CWLog(1, @"WEBSERVER", @"?????", -1, logMessage);
        }
        else
        {
            _CWLog([[components objectAtIndex:0] intValue], @"WEBSERVER", @"?????", -1, [components objectAtIndex:1]);
        }
    };
    self.nodelikeContext[@"console"][@"log"] = logger;
    self.nodelikeContext[@"console"][@"error"] = logger;
    //TODO we should add the other console types (warn, ...) and maybe format them specially
    
    [self _registerJSCallbacks];
    
    //Pass some infos to the webserver
    self.nodelikeContext[@"HTTP_PORT"] = [NSString stringWithFormat:@"%d", port];
    self.nodelikeContext[@"DOCUMENT_ROOT"] = self.documentRoot;
    self.nodelikeContext[@"RESOURCES_PATH"] = [[CWBundle bundle] bundlePath];
    
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
    
    CWLog(1, @"Webserver is suspended, all remotes are soft-disconnected");
    
    self.state = CWWebserverManagerStateSuspended;
    [self.nodelikeContext evaluateScript:@"softDisconnectAllRemotes();"];
}


- (void)resumeWebserver
{
    CWLog(1, @"Webserver is resumed");
    
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
    CWLog(1, @"Webserver did start");
    
    self.state = CWWebserverManagerStateStarted;
    
    if ([self.delegate respondsToSelector:@selector(didStartWebserver)])
    {
        [self.delegate didStartWebserver];
    }
}


- (void)_receivedFromServer_remoteWebsocketDidClose:(NSString *)identifier
{
    CWLog(3, @"Webserver reports a remote websocket did close");
    
    if ([self.delegate respondsToSelector:@selector(remoteDidDisconnect:)])
    {
        [self.delegate remoteDidDisconnect:identifier];
    }
}


@end
