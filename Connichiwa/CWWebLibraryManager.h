//
//  CWWebLibraryManager.h
//  Connichiwa
//
//  Created by Mario Schreiner on 27/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import "CWWebApplicationState.h"
#import "CWWebLibraryManagerDelegate.h"



typedef NS_ENUM(NSInteger, CWWebLibraryManagerState)
{
    CWWebLibraryManagerStateDisconnected,
    CWWebLibraryManagerStateConnecting,
    CWWebLibraryManagerStateConnected,
    CWWebLibraryManagerStateDisconnecting
};



@interface CWWebLibraryManager : NSObject

@property (readwrite, strong) id<CWWebLibraryManagerDelegate> delegate;
@property (readwrite, strong) UIWebView *webView;

- (instancetype)initWithApplicationState:(id<CWWebApplicationState>)appState;
- (void)connect;
- (void)sendDeviceDetected:(NSString *)identifier;
- (void)sendDevice:(NSString *)identifier changedDistance:(double)distance;
- (void)sendDeviceLost:(NSString *)identifier;
- (void)sendRemoteConnectFailed:(NSString *)identifier;
- (void)sendRemoteDisconnected:(NSString *)identifier;
- (BOOL)isActive;

@end
