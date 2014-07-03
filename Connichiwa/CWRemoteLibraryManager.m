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
    
    CWLog(1, @"Connecting as a remote to %@, device is now a remote!", URL);
    
    self.state = CWRemoteLibraryManagerStateConnecting;
    
    //URL is in the form http://IP:PORT - we need to make it http://IP:PORT/remote/index.html
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
    
    CWLog(1, @"Device is disconnecting from master device, stop being a remote!");
    
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
    
    self.webViewContext[@"native_softDisconnect"] = ^{
        [weakSelf _receivedfromView_softDisconnect];
    };
}


- (void)_receivedfromView_websocketDidOpen
{
    CWLog(3, @"Remote websocket did open, sending initial data");
    
    self.state = CWRemoteLibraryManagerStateConnected;
    
    [self _sendToView_cwdebug];
    [self _sendToView_remoteIdentifier];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setHidden:NO];
    });
}


- (void)_receivedfromView_websocketDidClose
{
    CWLog(3, @"Remote websocket did close, stop being a remote");
    
    self.state = CWRemoteLibraryManagerStateDisconnecting;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView setHidden:YES];
        [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"about:blank"]]];
    });
}


- (void)_receivedfromView_softDisconnect
{
    CWLog(1, @"Soft-Disconnecting from master");
    
    //"Soft Disconnecting" means that we put this device out of remote state but don't actually close the websocket connection
    //Technically, this means the server can still send us messages but we just don't care about it
    //We do this because there are situations where a bug in UIWebView can cause a crash if the websocket is closed, but we still want to disconnect the client
    //The actual websocket close comes when the server either shuts down the connection or we replace the webview with a new remote connection
    self.state = CWRemoteLibraryManagerStateSoftDisconnected;
    
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
    CWLog(4, @"Sending message to remote library: %@", message);
    NSString *js = [NSString stringWithFormat:@"parseNativeMessage('%@')", message];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    if (self.state == CWRemoteLibraryManagerStateConnecting)
    {
        CWLog(3, @"Remote webview did load, setting things up and connecting websocket");
        
        //Loaded a remote server URL, set up its context
        self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];

        //Register JS error handler
        self.webViewContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
            dispatch_async(dispatch_get_main_queue(), ^{
                _CWLog(1, @"REMOTELIB", @"?????", -1, @"JAVASCRIPT ERROR: %@. Stack: %@", e, [e valueForProperty:@"stack"]);
            });
        };
        
        id logger = ^(NSString *logMessage)
        {
            NSArray *components = [logMessage componentsSeparatedByString:@"|"]; //array should contain: prio, message
            if ([components count] != 2)
            {
                _CWLog(1, @"REMOTELIB", @"?????", -1, logMessage);
            }
            else
            {
                _CWLog([[components objectAtIndex:0] intValue], @"REMOTELIB", @"?????", -1, [components objectAtIndex:1]);
            }
        };
        self.webViewContext[@"console"][@"log"] = logger;
        self.webViewContext[@"console"][@"error"] = logger;
        
        [self _registerJSCallbacks];
        [self _sendToView_connectWebsocket];
    }
    else if (self.state == CWRemoteLibraryManagerStateDisconnecting)
    {
        CWLog(3, @"Remote webview did blank, we are fully disconnected");
        
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWRemoteLibraryManagerStateDisconnected;
    }
}

@end
