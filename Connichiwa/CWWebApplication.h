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
 *  This class represents the web applicatin that is run by Connichiwa. It is the main public interface exposed by the Connichiwa Framework. Through this class, the web application can be controlled, for example by setting or receiving callbacks.
 *  @TODO more to come
 */
@interface CWWebApplication : NSObject

- (void)launchOnWebView:(UIWebView *)webView;

@end
