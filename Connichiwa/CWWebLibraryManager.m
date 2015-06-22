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

- (void)_receivedFromView_startProximityTracking;

- (void)_receivedFromView_stopProximityTracking;

/**
 *  Tells the web library if we are running in debug mode or not
 */
- (void)_sendToView_debuginfo;

/**
 *  Tells the web library the unique connichiwa identifier we are known under
 */
- (void)_sendToView_localInfo;

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

- (void)_sendToView_proximityStateChanged:(BOOL)proximityState;

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


- (void)sendDeviceDetected:(NSString *)identifier information:(NSDictionary *)deviceInfo
{
    [self _sendToView_deviceDetected:identifier information:deviceInfo];
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

- (void)sendProximityStateChanged:(BOOL)proximityState
{
    [self _sendToView_proximityStateChanged:proximityState];
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
    
    self.webViewContext[@"nativeCallLocalInfo"] = ^(NSDictionary *info) {
        [weakSelf _receivedFromView_localInfo:info];
    };
    
    self.webViewContext[@"nativeCallLibraryDidLoad"] = ^{
        [weakSelf _receivedFromView_libraryDidLoad];
    };
    
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
    
    self.webViewContext[@"nativeCallStartProximityTracking"] = ^{
        [weakSelf _receivedFromView_startProximityTracking];
    };
    
    self.webViewContext[@"nativeCallStopProximityTracking"] = ^{
        [weakSelf _receivedFromView_stopProximityTracking];
    };
}


-(void)_receivedFromView_localInfo:(NSDictionary *)info {
    if ([self.delegate respondsToSelector:@selector(webLibrarySentLocalInfo:)])
    {
        [self.delegate webLibrarySentLocalInfo:info];
    }
//    [self.appState setIdentifier:[info objectForKey:@"identifier"]];
}


-(void)_receivedFromView_libraryDidLoad {
    CWLog(3, @"Weblibrary did fully load");
}


- (void)_receivedfromView_websocketDidOpen
{
    CWLog(3, @"Weblibrary websocket did open, sending initial data");
    
    self.state = CWWebLibraryManagerStateConnected;
    
    [self _sendToView_debuginfo];
    [self _sendToView_localInfo];
    
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


-(void)_receivedFromView_startProximityTracking {
    CWLog(3, @"Web Library requested proximity tracking start.");
    if ([self.delegate respondsToSelector:@selector(webLibraryRequestsProximityTrackingStart)])
    {
        [self.delegate webLibraryRequestsProximityTrackingStart];
    }
}


-(void)_receivedFromView_stopProximityTracking {
    CWLog(3, @"Web Library requested proximity tracking stop.");
    if ([self.delegate respondsToSelector:@selector(webLibraryRequestsProximityTrackingStop)])
    {
        [self.delegate webLibraryRequestsProximityTrackingStop];
    }
}


- (void)_sendToView_debuginfo
{
    NSDictionary *data = @{
                           @"_name": @"debuginfo",
                           @"debug": @([CWDebug isDebugging]),
                           @"logLevel": @([CWDebug logLevel])
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_localInfo
{
    NSMutableDictionary *data = [[self.appState deviceInfo] mutableCopy];
    [data setObject:@"localinfo" forKey:@"_name"];
    
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_deviceDetected:(NSString *)identifier information:(NSDictionary *)deviceInfo
{
    NSMutableDictionary *data = [deviceInfo mutableCopy];
    NSDictionary *moreData = @{
                           @"_name": @"devicedetected",
                           @"identifier": identifier
                           };
    [data addEntriesFromDictionary:moreData];
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_device:(NSString *)identifier changedDistance:(double)distance
{
    NSDictionary *data = @{
                           @"_name": @"devicedistancechanged",
                           @"identifier": identifier,
                           @"distance": [NSNumber numberWithDouble:(round(distance * 10) / 10)]
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_deviceLost:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"_name": @"devicelost",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_remoteConnectFailed:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"_name": @"remoteconnectfailed",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_remoteDisconnected:(NSString *)identifier
{
    NSDictionary *data = @{
                           @"_name": @"remotedisconnected",
                           @"identifier": identifier
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_proximityStateChanged:(BOOL)proximityState; {
    NSDictionary *data = @{
                           @"_name": @"proximitystatechanged",
                           @"proximityState": @(proximityState)
                           };
    [self _sendToView_dictionary:data];
}


- (void)_sendToView_dictionary:(NSDictionary *)dictionary
{
//    NSMutableDictionary *mutableDictionary = [NSMutableDictionary dictionaryWithDictionary:dictionary];
//    [mutableDictionary setObject:@"master" forKey:@"_source"];
//    [mutableDictionary setObject:@"master" forKey:@"_target"];
//    NSString *json = [CWUtil escapedJSONStringFromDictionary:mutableDictionary];
//    NSData *data = [NSJSONSerialization dataWithJSONObject:mutableDictionary options:NSJSONWritingPrettyPrinted error:nil];
//    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    NSString *json = [CWUtil escapedJSONStringFromDictionary:dictionary];
    [self _sendToView:json];
}


- (void)_sendToView:(NSString *)message
{
    if (self.webViewContext == nil) return;
    
    //stringByEvaluatingJavaScriptFromString: must be called on the main thread, but it seems buggy with dispatch_async, so we use performSelectorOnMainThread:
    //Also see http://stackoverflow.com/questions/11593900/uiwebview-stringbyevaluatingjavascriptfromstring-hangs-on-ios5-0-5-1-when-called
    CWLog(4, @"Sending message to web library: %@", message);
//    [self.serverManager sendWebsocketMessage:[message dataUsingEncoding:NSUTF8StringEncoding]];
    NSString *js = [NSString stringWithFormat:@"CWNativeBridge.parse('%@');", message];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidStartLoad:(UIWebView *)webView
{
    //We need to tell the web library it is run by a native application. This needs to be done ASAP (before the library loads).
    //Therefore, we simply execute a script that sets a global variable to true. When the web library is loaded, it can check
    //this variable and by that know that a native layer is running in the background.
//    self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
    [self createWebViewContext];
    NSString *js = [NSString stringWithFormat:@"var _CW_NATIVE = {};"];
    [self.webView performSelectorOnMainThread:@selector(stringByEvaluatingJavaScriptFromString:) withObject:js waitUntilDone:NO];
}


- (void)webViewDidFinishLoad:(UIWebView *)webView
{
//    if (self.state == CWWebLibraryManagerStateConnecting)
//    {
//        CWLog(3, @"Web library webview did load, setting things up and connecting websocket");
        //WebView's are a strange little thing - the JS context might or might not change between our load request and
        //this point. Therefore, create the context again even though we already did so in connect:
//        [self createWebViewContext];
//    }
//    else if (self.state == CWWebLibraryManagerStateDi rsconnecting)
    if (self.state == CWWebLibraryManagerStateDisconnecting)
    {
        CWLog(3, @"Web library webview did blank, we are fully disconnected... why would we want that?");
        
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWWebLibraryManagerStateDisconnected;
    }
}

- (void)createWebViewContext {
    //Find the context
    self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
    
    [self _registerJSCallbacks];
    
    //Create JS loggers
    id logger = ^(NSString *logMessage) {
        NSArray *components = [logMessage componentsSeparatedByString:@"|"]; //array should contain: prio, message
        if ([components count] != 2) {
            WLLog(1, logMessage);
        } else {
            WLLog([[components objectAtIndex:0] intValue], [components objectAtIndex:1]);
        }
    };
    
    id errorLogger = ^(NSString *logMessage, NSString *url, NSNumber *line, NSNumber *column, JSValue *err) {
        NSString *firstLine = logMessage;
        
        NSString *secondLine = @"";
        if (url && [url length] > 0 && line) {
            secondLine = [NSString stringWithFormat:@"\n%@:%@", url, [line stringValue]];
        }
        
        NSString *thirdLine = @"";
        if (err != [JSValue valueWithUndefinedInContext:self.webViewContext]) {
            secondLine = @"";
            thirdLine = [NSString stringWithFormat:@"\n%@", [err valueForProperty:@"stack"]];
        }
        ErrLog(@"JAVASCRIPT ERROR: %@%@%@", firstLine, secondLine, thirdLine);
    };
    
    id exceptionLogger = ^(JSContext *context, JSValue *err) {
        ErrLog(@"JAVASCRIPT EXCEPTION: %@: %@\n%@:%@\n%@", [err valueForProperty:@"name"], [err valueForProperty:@"message"], [err valueForProperty:@"fileName"], [err valueForProperty:@"lineNumber"], [err valueForProperty:@"stack"]);
    };
    
    //Attach logger
    self.webViewContext[@"console"][@"log"]   = logger;
    self.webViewContext[@"console"][@"info"]  = logger;
    self.webViewContext[@"console"][@"err"]   = errorLogger;
    self.webViewContext[@"console"][@"warn"]  = logger;
    
    //The JS interpreter uses window.onerror - redirect that to console.err
    [self.webViewContext evaluateScript:@"window.onerror = function(msg, url, line, column, err) { try { throw new Error('test'); } catch (e) { console.err(e.stack); } console.err(msg, url, line, column, err); }"];
    
    //Exceptions wind up in the exception handler
    [self.webViewContext setExceptionHandler:exceptionLogger];
}

@end
