//
//  CWWebApplication.h
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>



/**
 *  The representative of the web application in Objective-C. This is the main class responsible for setting the web application and everything it needs up. This includes setting up this device as an iBeacon and listening for iBeacons. It additionally is responsible for the communication between the different parts - for example it relays information about found iBeacons to the web application. This class can also be used to send information to the web server or web application. It can also be used to retrieve events coming from the web server or web application.
 */
@interface CWWebApplication : NSObject

@property (readwrite, strong) UIWebView *remoteWebView;

/**
 *  Initializes a new web application. It fires up the web server and starts the web application at the given path. It also takes care of displaying the web application on a local UIWebView.
 *
 *  @param documentRoot The full path where the web application files are stored. Note that the web application files should usually get their own folder to prevent access to other files through the webserver. Also see [CWWebserver documentRoot].
 *  @param webView      The local webview on which the local content of the web application is displayed.
 *
 *  @return A new CWWebApplication instance
 */
- (instancetype)initWithDocumentRoot:(NSString *)documentRoot onWebView:(UIWebView *)webView;

@end
