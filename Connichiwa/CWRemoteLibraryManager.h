//
//  RemoteLibraryManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import "CWWebApplicationState.h"



typedef NS_ENUM(NSInteger, CWRemoteLibraryManagerState)
{
    CWRemoteLibraryManagerStateDisconnected,
    CWRemoteLibraryManagerStateConnecting,
    CWRemoteLibraryManagerStateConnected,
    CWRemoteLibraryManagerStateDisconnecting,
    CWRemoteLibraryManagerStateSoftDisconnected
};



@interface CWRemoteLibraryManager : NSObject

@property (readwrite, strong) UIWebView *webView;

- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState;
- (BOOL)isActive;
- (void)connectToServer:(NSURL *)URL;
- (void)disconnect;

@end
