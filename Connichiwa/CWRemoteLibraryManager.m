//
//  RemoteLibraryManager.m
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWRemoteLibraryManager.h"
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
    
    DLog(@"!! SWITCHING INTO REMOTE STATE");
    
    self.state = CWRemoteLibraryManagerStateConnecting;
    
    //URL is in the form http://IP:PORT - we need to make it http://IP:PORT/remote/index.html?identifier=ID
    //This will make it retrieve the remote library of the other device and send our identifier to the other device's weblib
    NSURL *extendedURL = [URL URLByAppendingPathComponent:@"remote" isDirectory:YES];
    NSString *queryString = [NSString stringWithFormat:@"identifier=%@", self.appState.identifier];
    NSString *finalURLString = [[NSString alloc] initWithFormat:@"%@index.html%@%@", [extendedURL absoluteString], [extendedURL query] ? @"&" : @"?", queryString];
    NSURL *finalURL = [NSURL URLWithString:finalURLString];
    
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
    
    self.state = CWRemoteLibraryManagerStateDisconnecting;
    
    //Close the websocket. This will trigger the websocketWasClosed callback which finished up the disconnect
    [self _sendToView_disconnect];
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
        [weakSelf _fromView_websocketDidOpen];
    };
    
    self.webViewContext[@"native_websocketDidClose"] = ^{
        [weakSelf _fromView_websocketDidClose];
    };
}


- (void)_fromView_websocketDidOpen
{
    self.state = CWRemoteLibraryManagerStateConnected;
    [self.webView setHidden:NO];
}


- (void)_fromView_websocketDidClose
{
    self.state = CWRemoteLibraryManagerStateDisconnecting;
    [self.webView setHidden:YES];
    [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"about:blank"]]];
}


- (void)_sendToView_disconnect
{
    [self.webView stringByEvaluatingJavaScriptFromString:@"disconnect();"];
}


#pragma mark UIWebViewDelegate


- (void)webViewDidFinishLoad:(UIWebView *)webView
{
    if (self.state == CWRemoteLibraryManagerStateConnecting)
    {
        //Loaded a remote server URL, set up its context
        self.webViewContext = [self.webView valueForKeyPath:@"documentView.webView.mainFrame.javaScriptContext"];
        [self _registerJSCallbacks];
    }
    else if (self.state == CWRemoteLibraryManagerStateDisconnecting)
    {
        //Loaded the empty page in the process of disconnecting, clear the context
        self.webViewContext = nil;
        self.state = CWRemoteLibraryManagerStateDisconnected;
    }
}

@end
