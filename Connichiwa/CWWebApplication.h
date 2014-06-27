//
//  CWWebApplication.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>



/**
 *  Represents the web application in Objective-C. This is the central class, mainly responsible for coordinating the different parts of the native layer. It sets up the webserver and BT and receives callbacks from all the classes and initiates appropriate actions. For example, it forwards BT events about device discovery to the web library, or on the other hands forwards connection requests from the web application to BT.
 */
@interface CWWebApplication : NSObject

/**
 *  The webview where the remote lib will be loaded on. Should be set to a valid webview if this device should be used as a remote device. 
 *  TODO: dirty, we should find some other implementation for this.
 */
@property (readwrite, strong) UIWebView *remoteWebView;

/**
 *  Starts the web application on the given webview. This will fire up the webserver, which will serve the given document root and listen on the specified port.
 *
 *  @param documentRoot The full path where the web application files are stored. This will be served as the root of the webserver. For security reasons, it is advised to use a dictionary where ONLY the files of the web application are stored, otherwise access to the other files in the directory can not be precluded.
 *  @param webView      The webview on which the local content of the web application is displayed
 *  @param port         The port on which the webserver will listen on. Note that the webserver will also act as a websocket server, the websocket port will be this + 1
 */
- (void)launchWithDocumentRoot:(NSString *)documentRoot onWebview:(UIWebView *)webView port:(int)port;

/**
 *  The same as launchWithDocumentRoot:onWebview:port: but will use the default port (8000)
 *
 *  @param documentRoot See launchWithDocumentRoot:onWebview:port:
 *  @param webView      See launchWithDocumentRoot:onWebview:port:
 */
- (void)launchWithDocumentRoot:(NSString *)documentRoot onWebview:(UIWebView *)webView;

- (void)applicationWillResignActive;
- (void)applicationDidEnterBackground;
- (void)applicationWillEnterForeground;
- (void)applicationDidBecomeActive;
- (void)applicationWillTerminate;

@end
