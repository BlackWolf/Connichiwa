//
//  RemoteLibraryManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWRemoteLibraryManager.h"
#import "CWUtil.h"
#import "CWDebug.h"



@interface CWRemoteLibraryManager () <UIWebViewDelegate>

@property (readwrite, weak) id<CWWebApplicationState> appState;

@property (readwrite) CWRemoteLibraryManagerState state;

@property (readwrite, strong) JSContext *webViewContext;

@end

@implementation CWRemoteLibraryManager


- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState
{
    self = [super init];
    
    self.appState = appState;
    self.state = CWRemoteLibraryManagerStateDisconnected;
    
    return self;
}


- (void)connectToServer:(NSURL *)URL
{
    if (self.webView == nil) return;
    if ([self isActive]) return;
    
    if (self.state == CWRemoteLibraryManagerStateDisconnecting)
    {
        [self performSelector:@selector(connectToServer:) withObject:URL afterDelay:1.0];
        return;
    }
    
    DLog(@"!! SWITCHING INTO REMOTE STATE");
    
    self.state = CWRemoteLibraryManagerStateConnecting;
    
    //URL is in the form http://IP:PORT - we need to make it http://IP:PORT/remote/index.html?identifier=ID
    //This will make it retrieve the remote library of the other device and send our identifier to the other device's weblib
    NSURL *finalURL = [[URL URLByAppendingPathComponent:@"remote" isDirectory:YES] URLByAppendingPathComponent:@"index.html" isDirectory:NO];
    
    NSURLRequest *URLRequest = [NSURLRequest requestWithURL:finalURL];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setDelegate:self];
        [self.webView setHidden:NO];
        [self.webView loadRequest:URLRequest];        
    });
}


- (void)disconnect
{
    if (self.webView == nil) return;
    if ([self isActive] == NO) return;
    
    if (self.state == CWRemoteLibraryManagerStateConnecting)
    {
        [self performSelector:@selector(disconnect) withObject:nil afterDelay:1.0];
        return;
    }
    
    DLog(@"!! BACKING OUT OF REMOTE STATE");
    
    self.state = CWRemoteLibraryManagerStateDisconnecting;
    
    [self _sendToView_disconnectWebsocket];
}


- (BOOL)isActive
{
    return (self.state == CWRemoteLibraryManagerStateConnecting || self.state == CWRemoteLibraryManagerStateConnected);
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
    
    self.webViewContext[@"native_serverIsShuttingDown"] = ^{
        [weakSelf _receivedfromView_serverIsShuttingDown];
    };
}


- (void)_receivedfromView_websocketDidOpen
{
    self.state = CWRemoteLibraryManagerStateConnected;
    
    [self _sendToView_cwdebug];
    [self _sendToView_remoteIdentifier];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setHidden:NO];
    });
}


- (void)_receivedfromView_websocketDidClose
{
    DLog(@"Remote websocket did close");
    
    self.state = CWRemoteLibraryManagerStateDisconnecting;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setHidden:YES];
        [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"about:blank"]]];
    });
}


- (void)_receivedfromView_serverIsShuttingDown
{
    DLog(@"Remote master did disconnect");
    
    //We put this device out of remote state, but we don't close the websocket
    //because of an UIWebView bug that might cause the master device to crash if we do
    self.state = CWRemoteLibraryManagerStateDisconnecting;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setHidden:YES];
    });
}


- (void)_sendToView_connectWebsocket
{
    NSDictionary *data = @{
                           @"type": @"connectwebsocket"
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_disconnectWebsocket
{
    NSDictionary *data = @{
                           @"type": @"disconnectwebsocket"
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_cwdebug
{
    NSDictionary *data = @{
                           @"type": @"cwdebug",
                           @"cwdebug": @CWDEBUG
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_remoteIdentifier
{
    NSDictionary *data = @{
                           @"type": @"remoteidentifier",
                           @"identifier": self.appState.identifier
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
    NSString *js = [NSString stringWithFormat:@"parseNativeMessage('%@')", message];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    if (self.state == CWRemoteLibraryManagerStateConnecting)
    {
        //Loaded a remote server URL, set up its context
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
        [self _sendToView_connectWebsocket];
    }
    else if (self.state == CWRemoteLibraryManagerStateDisconnecting)
    {
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWRemoteLibraryManagerStateDisconnected;
    }
}

@end
