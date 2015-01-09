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
#import "CWUtil.h"
#import "CWiDevice.h"
#import "CWDebug.h"



int const DEFAULT_WEBSERVER_PORT = 8000;
double const REMOTE_WEBSOCKET_CONNECT_TIMEOUT = 5.0;
double const CLEANUP_TASK_TIMEOUT = 10.0;



@interface CWWebApplication () <CWWebserverManagerDelegate, CWBluetoothManagerDelegate, CWWebApplicationState, CWWebLibraryManagerDelegate>

/**
 *  The unique identifier of this device that is used amongst all the different parts of Connichiwa
 */
@property (readwrite, strong) NSString *identifier;

@property (readwrite, strong) NSDate *launchDate;

/**
 *  The port the webserver will run on
 */
@property (readwrite) int webserverPort;

/**
 *  The main instance of CWWebLibraryManager. Runs the actual web application, the web library and forwards and receives messages from the web library
 */
@property (readwrite, strong) CWWebLibraryManager *webLibManager;

/**
 *  The main instance of CWRemoteLibraryManager. Runs the remote library if the device is used as a remote by another Connichiwa device. Also forwards and receives messages from the remote library
 */
@property (readwrite, strong) CWRemoteLibraryManager *remoteLibManager;

/**
 *  The main instance of CWWebserverManager. Runs the local webserver and forwards and receives messages from it
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

/**
 *  Identifier for the cleanup task that is started when this device is sent to the background
 */
@property (readwrite) UIBackgroundTaskIdentifier cleanupBackgroundTaskIdentifier;

/**
 *  Called when the timer that waits for a remote device to connect via websocket expires. If the device did not establish a websocket connection by the time this is called, it usually means something went wrong and we can consider the device connection as a failure.
 *
 *  @param deviceIdentifier The identifier of the device where the timer expires
 */
- (void)remoteDeviceConnectionTimeout:(NSString *)deviceIdentifier;

/**
 *  Called when the device was when the device-sent-to-background cleanup task timed out
 */
- (void)cleanupBackgroundTaskTimeout;

@end



@implementation CWWebApplication


/**
 *  Initializes a new CWWebApplication instance. It is not advised to have multiple CWWebApplication instances at the same time
 *
 *  @return A new instance of CWWebApplication
 */
- (instancetype)init
{
    CWLog(1, @"Initializing CWWebApplication");
    
    self = [super init];
    
    self.identifier = [[NSUUID UUID] UUIDString];
    self.launchDate = [NSDate date];
    self.pendingRemoteDevices = [NSMutableArray array];
    self.remoteDevices = [NSMutableArray array];
    
    self.webLibManager = [[CWWebLibraryManager alloc] initWithApplicationState:self];
    [self.webLibManager setDelegate:self];
    
    self.remoteLibManager = [[CWRemoteLibraryManager alloc] initWithApplicationState:self];
    
    self.webserverManager = [[CWWebserverManager alloc] init];
    [self.webserverManager setDelegate:self];
    
    self.bluetoothManager = [[CWBluetoothManager alloc] initWithApplicationState:self];
    [self.bluetoothManager setDelegate:self];
    
    NSArray *ips = [CWUtil deviceInterfaceAddresses];
    if ([ips count] > 0) {
        CWLog(1, @"IP: %@", [ips objectAtIndex:0]);
    }
    
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


- (void)remoteDeviceConnectionTimeout:(NSString *)deviceIdentifier
{
    if ([self.remoteDevices containsObject:deviceIdentifier]) return;
    
    CWLog(2, @"Remote device %@ did not connect in time", deviceIdentifier);
    
    [self.pendingRemoteDevices removeObject:deviceIdentifier];
    [self.webLibManager sendRemoteConnectFailed:deviceIdentifier];
}


- (void)cleanupBackgroundTaskTimeout
{
    CWLog(3, @"Background Cleanup timed out");
    
    //By now everything should have been cleaned up nicely, we can end the background task so iOS doesn't kill us :-)
    [[UIApplication sharedApplication] endBackgroundTask:self.cleanupBackgroundTaskIdentifier];
}


#pragma mark CWWebApplicationState Protocol


- (int)ppi
{
//    //iPhone and iPod are the same: 326ppi for retina, 163 otherwise
//    if ([CWiDevice isiPhone] || [CWiDevice isiPod]) {
//        if ([CWiDevice isRetina])   return 326;
//        else                        return 163;
//    }
//    
//    //iPad's are a little more complex: 264ppi for retina, 132 for non-retina
//    //Exception: The new iPad mini 2G has 326ppi.
//    if ([CWiDevice isiPad]) {
//        if ([CWiDevice isRetina]) {
//            if ([CWiDevice model] >= CWiDeviceModeliPadMini2G)  return 326;
//            else                                                return 264;
//        } else {
//            if ([CWiDevice model] == CWiDeviceModeliPadMini1G)  return 163;
//            else                                                return 132;
//        }
//    }
//    
//    return -1;
    
    if ([CWiDevice isiPhone] || [CWiDevice isiPod]) return 163;
    
    if ([CWiDevice isiPad]) {
        if ([CWiDevice model] == CWiDeviceModeliPadMini1G) return 163;
        if ([CWiDevice model] == CWiDeviceModeliPadMini2G) return 163;
        
        return 132;
    }
    
    return -1;
}


- (NSDictionary *)deviceInfo {
    return @{
             @"identifier" : [self identifier],
             @"launchDate" : @([[self launchDate] timeIntervalSince1970]),
             @"name"       : [self deviceName],
             @"ppi"        : @([self ppi]),
             @"supportsMC" : @YES
             };
}


/**
 *  See [CWWebApplicationState isWebserverRunning]
 *
 *  @return See [CWWebApplicationState isWebserverRunning]
 */
- (BOOL)isWebserverRunning
{
    return (self.webserverManager.state == CWWebserverManagerStateStarted);
}


/**
 *  See [CWWebApplicationState isRemote]
 *
 *  @return See [CWWebApplicationState isRemote]
 */
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


/**
 *  See [CWWebLibraryManagerDelegate webLibraryIsReady]
 */
- (void)webLibraryIsReady
{
    //Weblib is ready to receive infos about detected devices, so let's start detecting and being detected
    if ([self.bluetoothManager isAdvertising] == NO) [self.bluetoothManager startAdvertising];
    if ([self.bluetoothManager isScanning] == NO)
    {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self.bluetoothManager performSelector:@selector(startScanning) withObject:nil afterDelay:0.5]; //BT starts freaking out without a small delay, no idea why
        });
    }
}


/**
 *  See [CWWebLibraryManagerDelegate didReceiveConnectionRequestForRemote:]
 *
 *  @param identifier See [CWWebLibraryManagerDelegate didReceiveConnectionRequestForRemote:]
 */
- (void)didReceiveConnectionRequestForRemote:(NSString *)identifier
{
    if ([self isWebserverRunning] == NO) return; //no remote connections while webserver is down
    if ([self.pendingRemoteDevices containsObject:identifier]) return;
    
    if ([self isRemote] == YES || [self.remoteDevices containsObject:identifier])
    {
        [self.webLibManager sendRemoteConnectFailed:identifier];
        return;
    }
    
    [self.pendingRemoteDevices addObject:identifier];
    [self.bluetoothManager sendNetworkAddressesToDevice:identifier];
}


/**
 *  See [CWWebLibraryManagerDelegate remoteDidConnect:]
 *
 *  @param identifier See [CWWebLibraryManagerDelegate remoteDidConnect:]
 */
- (void)remoteDidConnect:(NSString *)identifier
{
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


/**
 *  See [CWWebserverManagerDelegate remoteDidDisconnect:]
 *
 *  @param identifier See [CWWebserverManagerDelegate remoteDidDisconnect:]
 */
- (void)remoteDidDisconnect:(NSString *)identifier
{
    //A remote disconnect can happen before the remote device was initialized, the remote might still be pending
    [self.pendingRemoteDevices removeObject:identifier];
    [self.remoteDevices removeObject:identifier];
    
    [self.webLibManager sendRemoteDisconnected:identifier];
}


#pragma mark CWBluetoothManagerDelegate


/**
 *  See [CWBluetoothManagerDelegate deviceDetected:]
 *
 *  @param identifier See [CWBluetoothManagerDelegate deviceDetected:]
 */
- (void)deviceDetected:(NSString *)identifier information:(NSDictionary *)deviceInfo
{
    [self.webLibManager sendDeviceDetected:identifier information:deviceInfo];
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


/**
 *  See [CWBluetoothManagerDelegate deviceLost:]
 *
 *  @param identifier See [CWBluetoothManagerDelegate deviceLost:]
 */
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
    //If we successfully transferred our IPs wait for the remote library to connect to us
    //Once the remote device establishes a websocket connection CWWebserverManager will report the new connection
    if (success && [self.remoteDevices containsObject:deviceIdentifier] == NO)
    {
        CWLog(2, @"IPs were sent to %@, waiting for a websocket connection...", deviceIdentifier);
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
    
    //Because pausing the webserver is a threaded task, simply doing it in this method is not possible because iOS would suspend the thread before the close completes
    //beginBackgroundTaskWithExpirationHandler: tells iOS that we still have to do work and iOS gives us up to 10 minutes to perform our task (although not guaranteed)
    //Luckily, we don't need that long: after a short delay we will end the background task, but it is more than enough time for the websocket to close
    //Be aware that the block passed to beginBackgroundTaskWithExpirationHandler: is called when the background task is ended forcefully by iOS and is not the code that is executed in the background. Calling beginBackgroundTaskWithExpirationHandler: simply tells iOS that we want to continue executing our code
    
    self.cleanupBackgroundTaskIdentifier = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
        CWLog(3, @"Background Task Expired");
        [[UIApplication sharedApplication] endBackgroundTask:self.cleanupBackgroundTaskIdentifier];
        self.cleanupBackgroundTaskIdentifier = UIBackgroundTaskInvalid;
    }];
    [self performSelector:@selector(cleanupBackgroundTaskTimeout) withObject:nil afterDelay:CLEANUP_TASK_TIMEOUT];
    
    CWLog(1, @"App entering background, pausing BT and webserver...");
    [self.bluetoothManager stopAdvertising];
    [self.bluetoothManager stopScanning];
    [self.webserverManager suspendWebserver];
    
    //If we are a remote device we should shut down the websocket gracefully to let the master device know we are not available to display information
    //The websocket connection is resumed in willEnterForeground
    if ([self isRemote])
    {
        CWLog(1, @"App entering background while being a remote, closing remote connection");
        [self.remoteLibManager disconnect];
    }
}


- (void)applicationWillEnterForeground
{
    //Called whenever an application goes to the foreground, so when it is re-launched after going to the background
    
    CWLog(1, @"App entering foreground, resuming webserver...");
    [self.webserverManager resumeWebserver];
    [self.bluetoothManager startAdvertising];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.bluetoothManager performSelector:@selector(startScanning) withObject:nil afterDelay:0.5]; //BT starts freaking out without a small delay, no idea why
    });
    
    
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
