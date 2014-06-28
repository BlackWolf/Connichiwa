//
//  CWWebApplication.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWWebApplication.h"
#import "CWWebserverManager.h"
#import "CWWebserverManagerDelegate.h"
#import "CWBluetoothManager.h"
#import "CWBluetoothManagerDelegate.h"
#import "CWWebApplicationState.h"
#import "CWRemoteLibraryManager.h"
#import "CWWebLibraryManager.h"
#import "CWWebLibraryManagerDelegate.h"
#import "CWDebug.h"



int const DEFAULT_WEBSERVER_PORT = 8000;
double const REMOTE_WEBSOCKET_CONNECT_TIMEOUT = 5.0;
double const CLEANUP_TASK_TIMEOUT = 10.0;



@interface CWWebApplication () <CWWebserverManagerDelegate, CWBluetoothManagerDelegate, CWWebApplicationState, CWWebLibraryManagerDelegate>

/**
 *  The unique identifier of this device that is used amongst all the different parts of Connichiwa
 */
@property (readwrite, strong) NSString *identifier;

/**
 *  The port the webserver will run on
 */
@property (readwrite) int webserverPort;

@property (readwrite, strong) CWWebLibraryManager *webLibManager;
@property (readwrite, strong) CWRemoteLibraryManager *remoteLibManager;

/**
 *  The main instance of CWWebserverManager. Runs the local webserver and forwards and receives messages from the web library
 */
@property (readwrite, strong) CWWebserverManager *webserverManager;

/**
 *  The main instance of CWBluetoothManager. Advertises this device via BT, looks for other BT devices and allows for data exchange with other BT devices.
 */
@property (readwrite, strong) CWBluetoothManager *bluetoothManager;

/**
 *  The local UIWebView where the web application will be displayed on
 */
@property (readwrite, strong) UIWebView *localWebView;

/**
 *  Contains a list of of devices that we currently try to connect to in order to use them as remote devices. Each entry is a device identifier.
 */
@property (readwrite) NSMutableArray *pendingRemoteDevices;

/**
 *  Contains a list of devices that are currently used as remote devices. Each entry is a device identifier.
 */
@property (readwrite, strong) NSMutableArray *remoteDevices;

@property (readwrite) UIBackgroundTaskIdentifier cleanupBackgroundTaskIdentifier;

@end



@implementation CWWebApplication


/**
 *  Initializes a new CWWebApplication instance. It is not advised to have multiple CWWebApplication instances at the same time
 *
 *  @return A new instance of CWWebApplication
 */
- (instancetype)init
{
    self = [super init];
    
    self.identifier = [[NSUUID UUID] UUIDString];
    self.pendingRemoteDevices = [NSMutableArray array];
    self.remoteDevices = [NSMutableArray array];
    
    self.webLibManager = [[CWWebLibraryManager alloc] initWithApplicationState:self];
    [self.webLibManager setDelegate:self];
    
    self.remoteLibManager = [[CWRemoteLibraryManager alloc] initWithApplicationState:self];
    
    self.webserverManager = [[CWWebserverManager alloc] init];
    [self.webserverManager setDelegate:self];
    
    self.bluetoothManager = [[CWBluetoothManager alloc] initWithApplicationState:self];
    [self.bluetoothManager setDelegate:self];
    
    return self;
}


- (void)launchWithDocumentRoot:(NSString *)documentRoot onWebview:(UIWebView *)webView port:(int)port
{
    self.localWebView = webView;
    self.webserverPort = port;
    
    [self.webserverManager startWebserverWithDocumentRoot:documentRoot onPort:port];
}


- (void)launchWithDocumentRoot:(NSString *)documentRoot onWebview:(UIWebView *)webView;
{
    [self launchWithDocumentRoot:documentRoot onWebview:webView port:DEFAULT_WEBSERVER_PORT];
}


- (void)setRemoteWebView:(UIWebView *)remoteWebView
{
    [self.remoteLibManager setWebView:remoteWebView];
}


#pragma mark Timers


/**
 *  Called when the timer that waits for a remote device to connect via websocket expires. If the device did not establish a websocket connection by the time this is called, it usually means something went wrong and we can consider the device connection as a failure.
 *
 *  @param deviceIdentifier The identifier of the device where the timer expires
 */
- (void)remoteDeviceConnectionTimeout:(NSString *)deviceIdentifier
{
    if ([self.remoteDevices containsObject:deviceIdentifier]) return;
    
    [self.pendingRemoteDevices removeObject:deviceIdentifier];
    [self.webLibManager sendRemoteConnectFailed:deviceIdentifier];
}


- (void)cleanupBackgroundTaskTimeout
{
    //By now everything should have been cleaned up nicely, we can end the background task so iOS doesn't kill us :-)
    [[UIApplication sharedApplication] endBackgroundTask:self.cleanupBackgroundTaskIdentifier];
}


#pragma mark CWWebApplicationState Protocol


- (BOOL)isRemote
{
    return self.remoteLibManager.isActive;
}


/**
 *  See [CWWebApplicationState canBecomeRemote]
 *
 *  @return See [CWWebApplicationState canBecomeRemote]
 */
- (BOOL)canBecomeRemote
{
    return ([self isRemote] == NO && [self.pendingRemoteDevices count] == 0 && [self.remoteDevices count] == 0);
}


#pragma mark CWWebLibraryManagerDelegate


- (void)webLibraryIsReady
{
    //Weblib is ready to receive infos about detected devices, so let's start detecting and being detected
    [self.bluetoothManager startAdvertising];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.bluetoothManager performSelector:@selector(startScanning) withObject:nil afterDelay:0.5]; //BT starts freaking out without a small delay, no idea why
    });
}


- (void)didReceiveConnectionRequestForRemote:(NSString *)identifier
{
    if ([self.pendingRemoteDevices containsObject:identifier]) return;
    
    DLog(@" !! TRYING TO GET DEVICE AS REMOTE");
    
    if ([self isRemote] == YES || [self.remoteDevices containsObject:identifier])
    {
        [self.webLibManager sendRemoteConnectFailed:identifier];
        return;
    }
    
    [self.pendingRemoteDevices addObject:identifier];
    [self.bluetoothManager sendNetworkAddressesToDevice:identifier];
}


- (void)remoteDidConnect:(NSString *)identifier
{
    DLog(@" !! REMOTE DID CONNECT");
    
    [self.pendingRemoteDevices removeObject:identifier];
    [self.remoteDevices addObject:identifier];
}


#pragma mark CWWebserverManagerDelegate


/**
 *  See [CWWebserverManagerDelegate didStartWebserver]
 */
- (void)didStartWebserver
{
    [self.webLibManager setWebView:self.localWebView];
    [self.webLibManager connect];
}

- (void)remoteDidDisconnect:(NSString *)identifier
{
    DLog(@" !! REMOTE DID DISCONNECT");
    [self.pendingRemoteDevices removeObject:identifier];
    [self.remoteDevices addObject:identifier];
    [self.webLibManager sendRemoteDisconnected:identifier];
}

#pragma mark CWBluetoothManagerDelegate


/**
 *  See [CWBluetoothManagerDelegate deviceDetected:]
 *
 *  @param identifier See [CWBluetoothManagerDelegate deviceDetected:]
 */
- (void)deviceDetected:(NSString *)identifier
{
    [self.webLibManager sendDeviceDetected:identifier];
}


/**
 *  See [CWBluetoothManagerDelegate device:changedDistance:]
 *
 *  @param identifier See [CWBluetoothManagerDelegate device:changedDistance:]
 *  @param distance   See [CWBluetoothManagerDelegate device:changedDistance:]
 */
- (void)device:(NSString *)identifier changedDistance:(double)distance
{
    [self.webLibManager sendDevice:identifier changedDistance:distance];
}


- (void)deviceLost:(NSString *)identifier
{
    [self.webLibManager sendDeviceLost:identifier];
}


/**
 *  See [CWBluetoothManagerDelegate didReceiveDeviceURL:]
 *
 *  @param URL See [CWBluetoothManagerDelegate didReceiveDeviceURL:]
 */
- (void)didReceiveDeviceURL:(NSURL *)URL;
{
    if ([self canBecomeRemote] == NO) return;
        
    //This is it, the moment we have all been waiting for: Switching to remote state!
    [self.remoteLibManager connectToServer:URL];
}


/**
 *  See [CWBluetoothManagerDelegate didSendNetworkAddresses:success:]
 *
 *  @param deviceIdentifier See [CWBluetoothManagerDelegate didSendNetworkAddresses:success:]
 *  @param success          See [CWBluetoothManagerDelegate didSendNetworkAddresses:success:]
 */
- (void)didSendNetworkAddresses:(NSString *)deviceIdentifier success:(BOOL)success
{
    DLog(@" !! DID SEND NETWORK INTERFACE ADDRESSES");
    
    //If we successfully transferred our IPs wait for the remote library to connect to us
    //Once the remote device establishes a websocket connection CWWebserverManager will report the new connection
    if (success && [self.remoteDevices containsObject:deviceIdentifier] == NO)
    {
        [self performSelector:@selector(remoteDeviceConnectionTimeout:) withObject:deviceIdentifier afterDelay:REMOTE_WEBSOCKET_CONNECT_TIMEOUT];
    }
    else
    {
        [self.pendingRemoteDevices removeObject:deviceIdentifier];
        [self.webLibManager sendRemoteConnectFailed:deviceIdentifier];
    }
}


#pragma mark ApplicationDelegate Forwards


- (void)applicationWillResignActive
{
    //Called whenever the app "loses focus", often when the app will resume shortly (except for a home button press)
    //This includes home button presses, alert popups, opening the control or notification center, ...
}


- (void)applicationDidEnterBackground
{
    //Called whenever the application goes to the background, so mainly when the user presses the home button or locks the device
    //willResignActive will always be called before this
    
    //If we are a remote device we should shut down the websocket gracefully to let the master device know we are not available to display information
    //The websocket connection is resumed in willEnterForeground
    if ([self isRemote])
    {
        DLog(@"App entering background while being  a remote device... closing websocket connection");
        
        //Because closing the websocket is a threaded task, simply doing it in this method is not possible because iOS would suspend the thread before the close completes
        //beginBackgroundTaskWithExpirationHandler: tells iOS that we still have to do work and iOS gives us up to 10 minutes to perform our task (although not guaranteed)
        //Luckily, we don't need that long: after a short delay we will end the background task, but it is more than enough time for the websocket to close
        //Be aware that the block passed to beginBackgroundTaskWithExpirationHandler: is called when the background task is ended forcefully by iOS and is not the code that is executed in the background. Calling beginBackgroundTaskWithExpirationHandler: simply tells iOS that we want to continue executing our code
        
        self.cleanupBackgroundTaskIdentifier = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
            [[UIApplication sharedApplication] endBackgroundTask:self.cleanupBackgroundTaskIdentifier];
            self.cleanupBackgroundTaskIdentifier = UIBackgroundTaskInvalid;
        }];
        
        [self.remoteLibManager disconnect];
        [self performSelector:@selector(cleanupBackgroundTaskTimeout) withObject:nil afterDelay:CLEANUP_TASK_TIMEOUT];
    }
}


// http://stackoverflow.com/questions/21714365/uiwebview-javascript-losing-reference-to-ios-jscontext-namespace-object


- (void)applicationWillEnterForeground
{
    //Called whenever an application goes to the foreground, so when it is re-launched after going to the background
    
    //TODO resume websocket connection?
}


- (void)applicationDidBecomeActive
{
    //Called when the application resumes activity, so after whatever caused willResignActivity is "resolved"
}


- (void)applicationWillTerminate
{
    //Called when the application terminates and is closed. Caused, for example, when the user flicks the application out of the task manager or if iOS needs to free resources.
}

@end
