//
//  CWRemoteLibraryManagerDelegate.h
//  Connichiwa
//
//  Created by Mario Schreiner on 14/06/15.
//  Copyright (c) 2015 Mario Schreiner. All rights reserved.
//

#import <Foundation/Foundation.h>



/**
 *  A delegate protocol that receives different events from the CWRemoteLibraryManager (and therefore also from the remote web library)
 */
@protocol CWRemoteLibraryManagerDelegate <NSObject>

- (void)remoteLibraryRequestsProximityTrackingStart;

- (void)remoteLibraryRequestsProximityTrackingStop;

@end
