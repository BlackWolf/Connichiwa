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

/**
 *  The state object of this connichiwa application
 */
@property (readwrite, weak) id<CWWebApplicationState> appState;

/**
 *  The current state of the web library manager
 */
@property (readwrite) CWWebLibraryManagerState state;

/**
 *  The context of the currently opened page on the UIWebView or nil if no page is open there
 */
@property (readwrite, strong) JSContext *webViewContext;

/**
 *  Registers callback functions that the remote library can call to execute native methods
 */
- (void)_registerJSCallbacks;

/**
 *  Called by the web library once the websocket to the local webserver was established
 */
- (void)_receivedfromView_websocketDidOpen;

/**
 *  Called by the web library when the websocket to the local webserver was closed (which should never happen)
 */
- (void)_receivedfromView_websocketDidClose;

/**
 *  Called by the web library if it wants to use another device was a remote device and requests to connect to it
 *
 *  @param identifier The identifier of the device that shall be connected
 */
- (void)_receivedFromView_connectRemote:(NSString *)identifier;

/**
 *  Called by the web library if it reports that a remote device successfully connected and messages can now be exchanged
 *
 *  @param identifier The identifier of the connected remote device
 */
- (void)_receivedFromView_remoteDidConnect:(NSString *)identifier;

/**
 *  Asks the web library to connect its websocket to the local webserver
 */
- (void)_sendToView_connectWebsocket;

/**
 *  Asks the web library to disconnect its websocket from the local webserver
 */
- (void)_sendToView_disconnectWebsocket;

/**
 *  Tells the web library if we are running in debug mode or not
 */
- (void)_sendToView_cwdebug;

/**
 *  Tells the web library the unique connichiwa identifier we are known under
 */
- (void)_sendToView_localIdentifier;

/**
 *  Tells the web library that a new device was detected, also see sendDeviceDetected:
 *
 *  @param identifier The identifier of the detected device
 */
- (void)_sendToView_deviceDetected:(NSString *)identifier;

/**
 *  Tells the web library that a device changed its distance, also see sendDevice:changedDistance:
 *
 *  @param identifier The identifier of the device
 *  @param distance   The new distance in meters
 */
- (void)_sendToView_device:(NSString *)identifier changedDistance:(double)distance;

/**
 *  Tells the web library that a device was lost, also see sendDeviceLost:
 *
 *  @param identifier The identifier of the lost device
 */
- (void)_sendToView_deviceLost:(NSString *)identifier;

/**
 *  Tells the web library that a connection to a remote device failed, also see sendRemoteConnectFailed:
 *
 *  @param identifier The identifier of the device that was not connected
 */
- (void)_sendToView_remoteConnectFailed:(NSString *)identifier;

/**
 *  Tells the web library that a remote device disconnected, also see sendRemoteDisconnected:
 *
 *  @param identifier The identifier of the disconnected device
 */
- (void)_sendToView_remoteDisconnected:(NSString *)identifier;

/**
 *  Sends the given dictionary to the web library as a JSON string
 *
 *  @param dictionary The dictionary to send. Every entry of the dictionary must be convertable by [CWUtil escapedJSONStringFromDictionary:]
 */
- (void)_sendToView_dictionary:(NSDictionary *)dictionary;

/**
 *  Sends the given string to the web library
 *
 *  @param message The message string to send
 */
- (void)_sendToView:(NSString *)message;

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
    if (self.appState.isWebserverRunning == NO) return;
    if (self.webView == nil) return;
    if ([self isActive]) return;
    
    if (self.state == CWWebLibraryManagerStateDisconnecting)
    {
        [self performSelector:@selector(connect) withObject:nil afterDelay:1.0];
        return;
    }
    
    CWLog(1, @"Connecting web library");
    
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
    
    self.webViewContext[@"nativeCallWebsocketDidOpen"] = ^{
        [weakSelf _receivedfromView_websocketDidOpen];
    };
    
    self.webViewContext[@"nativeCallWebsocketDidClose"] = ^{
        [weakSelf _receivedfromView_websocketDidClose];
    };
    
    self.webViewContext[@"nativeCallConnectRemote"] = ^(NSString *identifier) {
        [weakSelf _receivedFromView_connectRemote:identifier];
    };
    
    self.webViewContext[@"nativeCallRemoteDidConnect"] = ^(NSString *identifier) {
        [weakSelf _receivedFromView_remoteDidConnect:identifier];
    };
}


- (void)_receivedfromView_websocketDidOpen
{
    CWLog(3, @"Remote weblibrary websocket did open, sending initial data");
    
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
    CWLog(3, @"Remote websocket library did close, this shouldn't happen. Never.");
    [NSException raise:@"NOOOO" format:@"This should totally not happen. Damn you, sockets!"];
}


- (void)_receivedFromView_connectRemote:(NSString *)identifier
{
    CWLog(3, @"Web library requested a connection to %@", identifier);
    if ([self.delegate respondsToSelector:@selector(didReceiveConnectionRequestForRemote:)])
    {
        [self.delegate didReceiveConnectionRequestForRemote:identifier];
    }
}


- (void)_receivedFromView_remoteDidConnect:(NSString *)identifier
{
    CWLog(3, @"Web Library reported remote device %@ connected", identifier);
    if ([self.delegate respondsToSelector:@selector(remoteDidConnect:)])
    {
        [self.delegate remoteDidConnect:identifier];
    }
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
                           @"type": @"remoteconnectfailed",
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
    CWLog(4, @"Sending message to web library: %@", message);
    NSString *js = [NSString stringWithFormat:@"CWNativeCommunicationParser.parse('%@')", message];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    if (self.state == CWWebLibraryManagerStateConnecting)
    {
        CWLog(3, @"Web library webview did load, setting things up and connecting websocket");
        
        self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
        
        //Register JS error handler
        self.webViewContext.exceptionHandler = ^(JSContext *c, JSValue *e) {
            dispatch_async(dispatch_get_main_queue(), ^{
                _CWLog(1, @"WEBLIB", @"?????", -1, @"JAVASCRIPT ERROR: %@. Stack: %@", e, [e valueForProperty:@"stack"]);
            });
        };
        
        id logger = ^(NSString *logMessage)
        {
            NSArray *components = [logMessage componentsSeparatedByString:@"|"]; //array should contain: prio, message
            if ([components count] != 2)
            {
                _CWLog(1, @"WEBLIB", @"?????", -1, logMessage);
            }
            else
            {
                _CWLog([[components objectAtIndex:0] intValue], @"WEBLIB", @"?????", -1, [components objectAtIndex:1]);
            }
        };
        self.webViewContext[@"console"][@"log"] = logger;
        self.webViewContext[@"console"][@"error"] = logger;
        //TODO we should add the other console types (warn, ...) and maybe format them specially
        
        [self _registerJSCallbacks];
        [self _sendToView_connectWebsocket];
    }
    else if (self.state == CWWebLibraryManagerStateDisconnecting)
    {
        CWLog(3, @"Web library webview did blank, we are fully disconnected... why would we want that?");
        
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWWebLibraryManagerStateDisconnected;
    }
}

@end
