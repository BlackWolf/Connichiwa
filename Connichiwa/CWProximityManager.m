//
//  CWProximitySensor.m
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/15.
//  Copyright (c) 2015 Mario Schreiner. All rights reserved.
//

#import "CWProximityManager.h"


@interface CWProximityManager()

-(void)_proximitySensorStateChanged;

@end

@implementation CWProximityManager

- (instancetype)init {
    self = [super init];
    
    //Setup the change event handler
    //The event handler will not be called until UIDevice's
    //setProximityMonitoringEnabled is set to YES (see start/stopMonitoring)
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(_proximitySensorStateChanged)
                                                 name:UIDeviceProximityStateDidChangeNotification
                                               object:nil];
    
    return self;
}

-(void)startMonitoring {
    [[UIDevice currentDevice] setProximityMonitoringEnabled:YES];
}

-(void)stopMonitoring {
    [[UIDevice currentDevice] setProximityMonitoringEnabled:NO];
}


-(void)_proximitySensorStateChanged {
    if ([self.delegate respondsToSelector:@selector(proximityStateChanged:)]) {
        [self.delegate proximityStateChanged:[[UIDevice currentDevice] proximityState]];
    }
}

@end
