//
//  CWWebLibraryManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebLibraryManager.h"
#import "CWUtil.h"
#import "CWDebug.h"



@interface CWWebLibraryManager () <UIWebViewDelegate>

@property (readwrite, weak) id<CWWebApplicationState> appState;

@property (readwrite) CWWebLibraryManagerState state;

@property (readwrite, strong) JSContext *webViewContext;

@end

@implementation CWWebLibraryManager


- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState
{
    self = [super init];
    
    self.appState = appState;
    self.state = CWWebLibraryManagerStateDisconnected;
    
    return self;
}


- (void)connect
{
    if (self.webView == nil) return;
    if ([self isActive]) return;
    
    self.state = CWWebLibraryManagerStateConnecting;
    
    NSURL *localhostURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d", self.appState.webserverPort]];
    NSURLRequest *localhostURLRequest = [NSURLRequest requestWithURL:localhostURL];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setDelegate:self];
        [self.webView loadRequest:localhostURLRequest];
    });
}


- (void)sendDeviceDetected:(NSString *)identifier
{
    [self _sendToView_deviceDetected:identifier];
}


- (void)sendDevice:(NSString *)identifier changedDistance:(double)distance
{
    [self _sendToView_device:identifier changedDistance:distance];
}


- (void)sendDeviceLost:(NSString *)identifier
{
    [self _sendToView_deviceLost:identifier];
}


- (void)sendRemoteConnectFailed:(NSString *)identifier
{
    [self _sendToView_remoteConnectFailed:identifier];
}


- (void)sendRemoteDisconnected:(NSString *)identifier
{
    [self _sendToView_remoteDisconnected:identifier];
}


- (BOOL)isActive
{
    return (self.state == CWWebLibraryManagerStateConnecting || self.state == CWWebLibraryManagerStateConnected);
}


#pragma mark WebView Communication


- (void)_registerJSCallbacks
{
    if (self.webViewContext == nil) return;
    
    __weak typeof(self) weakSelf = self;
    
    self.webViewContext[@"native_websocketDidOpen"] = ^{
        [weakSelf _receivedfromView_websocketDidOpen];
    };
    
    self.webViewContext[@"native_websocketDidClose"] = ^{
        [weakSelf _receivedfromView_websocketDidClose];
    };
    
    self.webViewContext[@"native_connectRemote"] = ^(NSString *identifier) {
        [weakSelf _receivedFromView_connectRemote:identifier];
    };
    
    self.webViewContext[@"native_remoteDidConnect"] = ^(NSString *identifier) {
        [weakSelf _receivedFromView_remoteDidConnect:identifier];
    };
}


- (void)_receivedfromView_websocketDidOpen
{
    self.state = CWWebLibraryManagerStateConnected;
    
    [self _sendToView_cwdebug];
    [self _sendToView_localIdentifier];
    
    if ([self.delegate respondsToSelector:@selector(webLibraryIsReady)])
    {
        [self.delegate webLibraryIsReady];
    }
}


- (void)_receivedfromView_websocketDidClose
{
    self.state = CWWebLibraryManagerStateDisconnecting;
    [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"about:blank"]]];
    
    [NSException raise:@"Weblib websocket did close" format:@"Oops, that totally shouldn't happen, should it?"];
}


- (void)_receivedFromView_connectRemote:(NSString *)identifier
{
    if ([self.delegate respondsToSelector:@selector(didReceiveConnectionRequestForRemote:)])
    {
        [self.delegate didReceiveConnectionRequestForRemote:identifier];
    }
}


- (void)_receivedFromView_remoteDidConnect:(NSString *)identifier
{
    if ([self.delegate respondsToSelector:@selector(remoteDidConnect:)])
    {
        [self.delegate remoteDidConnect:identifier];
    }
}


- (void)_sendToView_cwdebug
{
    NSDictionary *data = @{
                           @"type": @"cwdebug",
                           @"cwdebug": @CWDEBUG
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_localIdentifier
{
    NSDictionary *data = @{
                           @"type": @"localidentifier",
                           @"identifier": self.appState.identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_deviceDetected:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"devicedetected",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_device:(NSString *)identifier changedDistance:(double)distance
{
    NSDictionary *data = @{
                           @"type": @"devicedistancechanged",
                           @"identifier": identifier,
                           @"distance": [NSNumber numberWithDouble:(round(distance * 10) / 10)]
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_deviceLost:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"devicelost",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_remoteConnectFailed:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"connectfailed",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}

- (void)_sendToView_remoteDisconnected:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"type": @"remotedisconnected",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_dictionary:(NSDictionary *)dictionary
{
    NSString *json = [CWUtil escapedJSONStringFromDictionary:dictionary];
    [self _sendToView:json];
}


- (void)_sendToView:(NSString *)message
{
    if (self.webViewContext == nil) return;
    
    //stringByEvaluatingJavaScriptFromString: must be called on the main thread, but it seems buggy with dispatch_async, so we use performSelectorOnMainThread:
    //Also see http://stackoverflow.com/questions/11593900/uiwebview-stringbyevaluatingjavascriptfromstring-hangs-on-ios5-0-5-1-when-called
//    DLog(@"Sending %@", message);
    NSString *js = [NSString stringWithFormat:@"CWNativeCommunicationParser.parse('%@')", message];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    if (self.state == CWWebLibraryManagerStateConnecting)
    {
        self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
        
        //Register JS error handler
        self.webViewContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
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
        self.webViewContext[@"console"] = @{@"log": logger, @"error": logger};
        
        [self _registerJSCallbacks];
        
        //
        //
        //
        //TODO we need to send a message to the weblib that it should connect the websocket
        //otherwise it can happen that websocketDidOpen is received before the JS Callbacks are in place - and therefore gets lost
        //the same should be done on the remote lib
        //
        //
        //
    }
    else if (self.state == CWWebLibraryManagerStateDisconnecting)
    {
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWWebLibraryManagerStateDisconnected;
    }
}

@end
