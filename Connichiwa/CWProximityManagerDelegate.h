//
//  CWProximityManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 13/06/15.
//  Copyright (c) 2015 Mario Schreiner. All rights reserved.
//

@protocol CWProximityManagerDelegate <NSObject>

@optional

-(void)proximityStateChanged:(BOOL)proximityState;

@end