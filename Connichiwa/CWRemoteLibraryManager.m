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

/**
 *  The application state of this connichiwa application
 */
@property (readwrite, weak) id<CWWebApplicationState> appState;

/**
 *  The current state of this manager
 */
@property (readwrite) CWRemoteLibraryManagerState state;

/**
 *  The JSContext of the web view. nil if the device is not currently connected as a remote device.
 */
@property (readwrite, strong) JSContext *webViewContext;

/**
 *  Registers callback functions that the remote library can call to execute native methods
 */
- (void)_registerJSCallbacks;

/**
 *  Called by the remote library once the websocket to the master device was established
 */
- (void)_receivedfromView_websocketDidOpen;

/**
 *  Called by the remote library when the websocket to the master device was closed (the master disconnected)
 */
- (void)_receivedfromView_websocketDidClose;

/**
 *  Called by the remote library if we should soft-disconnect from the master
 */
- (void)_receivedfromView_softDisconnect;

/**
 *  Asks the remote library to disconnect its websocket from the master
 */
- (void)_sendToView_disconnectWebsocket;

/**
 *  Tells the remote library the unique connichiwa identifier we are known under
 */
- (void)_sendToView_localInfo;

/**
 *  Sends the given dictionary to the remote library as a JSON string
 *
 *  @param dictionary The dictionary to send. Every entry of the dictionary must be convertable by [CWUtil escapedJSONStringFromDictionary:]
 */
- (void)_sendToView_dictionary:(NSDictionary *)dictionary;

/**
 *  Sends the given string to the remote library
 *
 *  @param message The message string to send
 */
- (void)_sendToView:(NSString *)message;

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
    
    //URL is in the form http://IP:PORT - we need to make it http://IP:PORT/remote
    NSURL *finalURL = [URL URLByAppendingPathComponent:@"remote" isDirectory:NO]; //directory NO to avoid trailing slash
    
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
    
    self.webViewContext[@"nativeWebsocketDidOpen"] = ^{
        [weakSelf _receivedfromView_websocketDidOpen];
    };
    
    self.webViewContext[@"nativeWebsocketDidClose"] = ^{
        [weakSelf _receivedfromView_websocketDidClose];
    };
    
    self.webViewContext[@"nativeSoftDisconnect"] = ^{
        [weakSelf _receivedfromView_softDisconnect];
    };
}


- (void)_receivedfromView_websocketDidOpen
{
    CWLog(3, @"Remote websocket did open, sending initial data");
    
    self.state = CWRemoteLibraryManagerStateConnected;
    
    [self _sendToView_localInfo];
    
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


- (void)_sendToView_disconnectWebsocket
{
    NSDictionary *data = @{
                           @"_name": @"disconnectwebsocket"
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_localInfo
{
    NSMutableDictionary *data = [[self.appState deviceInfo] mutableCopy];
    [data setObject:@"localinfo" forKey:@"_name"];
    
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
    NSString *js = [NSString stringWithFormat:@"CWNativeBridge.parse('%@')", message];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidStartLoad:(UIWebView *)webView
{
    //We need to tell the remote library it is run by a native application. This needs to be done ASAP (before the library loads).
    //Therefore, we simply execute a script that sets a global variable to true. When the web library is loaded, it can check
    //this variable and by that know that a native layer is running in the background.
//    self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
    [self createWebViewContext];
    NSString *js = [NSString stringWithFormat:@"var RUN_BY_CONNICHIWA_NATIVE = true;"];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}



/**
 *  Called by the UIWebView once it finished loading a page. This means the page is fully ready, the UIWebView JSContext is ready and we can start using the page.
 *
 *  @param webView The UIWebView that triggered this call
 */
- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    if (self.state == CWRemoteLibraryManagerStateDisconnecting)
    {
        CWLog(3, @"Remote webview did blank, we are fully disconnected");
        
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWRemoteLibraryManagerStateDisconnected;
    }
}

-(void)createWebViewContext {
    //Loaded a remote server URL, set up its context
    self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
    
    [self _registerJSCallbacks];
    
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
    self.webViewContext[@"console"][@"log"]   = logger;
    self.webViewContext[@"console"][@"info"]  = logger;
    self.webViewContext[@"console"][@"error"] = logger;
    self.webViewContext[@"console"][@"warn"]  = logger;
}

@end
