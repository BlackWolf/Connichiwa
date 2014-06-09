//
//  CWConstants.m
//  Connichiwa
//
//  Created by Mario Schreiner on 05/06/14.
//  Copyright (c) 2014 Mario Schreiner. All rights reserved.
//

#import "CWConstants.h"




int const WEBSERVER_PORT = 8000;
NSString *const BEACON_UUID = @"715DD7E3-5AA4-4A3A-B9A6-46CBB9A01901";

#ifdef CWDEBUG
    NSJSONWritingOptions const JSON_WRITING_OPTIONS = NSJSONWritingPrettyPrinted;
#else
    NSJSONWritingOptions const JSON_WRITING_OPTIONS = kNilOptions;
#endif