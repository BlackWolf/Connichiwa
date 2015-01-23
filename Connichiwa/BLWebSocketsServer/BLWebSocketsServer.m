//
//  BLWebSocketServer.m
//  LibWebSocket
//
//  Created by Benjamin Loulier on 1/22/13.
//  Copyright (c) 2013 Benjamin Loulier. All rights reserved.
//

#import "BLWebSocketsServer.h"
#import "libwebsockets.h"
#import "private-libwebsockets.h"
#import "BLAsyncMessageQueue.h"

static int pollingInterval = 20000;
static NSString * http_only_protocol = @"http-only";
const char * queueIdentifier = "com.blwebsocketsserver.network";
/* Error constants */
static NSString *errorDomain = @"com.blwebsocketsserver";

/* Declaration of the callbacks (http and websockets), libwebsockets requires an http callback even if we don't use it*/
static int callback_websockets(struct libwebsocket_context * this,
             struct libwebsocket *wsi,
             enum libwebsocket_callback_reasons reason,
             void *user, void *in, size_t len);


static int callback_http(struct libwebsocket_context *context,
                         struct libwebsocket *wsi,
                         enum libwebsocket_callback_reasons reason, void *user,
                         void *in, size_t len);

static BLWebSocketsServer *sharedInstance = nil;

static dispatch_source_t timer;
static dispatch_queue_t networkQueue;
@interface BLWebSocketsServer()

@property (nonatomic, assign, readwrite) BOOL isRunning;
//@property (nonatomic, assign) dispatch_source_t timer;
//@property (nonatomic, assign) dispatch_queue_t networkQueue;
/* Context representing the server */
@property (nonatomic, assign) struct libwebsocket_context *context;
@property (nonatomic, strong) BLAsyncMessageQueue *asyncMessageQueue;
@property (nonatomic, strong, readwrite) BLWebSocketsHandleRequestBlock defaultHandleRequestBlock;
@property (nonatomic, strong, readwrite) NSMutableDictionary *handleRequestBlocks;
/* Temporary storage for the server stopped completion block */
@property (nonatomic, strong) void(^serverStoppedCompletionBlock)();
/* Incremental value that defines the sessionId */
@property (nonatomic, assign) int sessionIdIncrementalCount;

- (void)cleanup;

@end

@implementation BLWebSocketsServer

#pragma mark - Shared instance
+ (BLWebSocketsServer *)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
        sharedInstance.defaultHandleRequestBlock = NULL;
        sharedInstance.asyncMessageQueue = [[BLAsyncMessageQueue alloc] init];
        sharedInstance.handleRequestBlocks = [NSMutableDictionary dictionary];
    });
    return sharedInstance;
}

#pragma mark - Initialization/Teardown
- (id)init {
    self = [super init];
    if (self) {
        networkQueue = dispatch_queue_create(queueIdentifier, DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

#pragma mark - Context management
- (struct libwebsocket_context *)createContextWithProtocolName:(NSString *)protocolName callbackFunction:(callback_function)callback andPort:(int)port {
    struct libwebsocket_protocols * protocols = (struct libwebsocket_protocols *) calloc(3, sizeof(struct libwebsocket_protocols));
    
    /* first protocol must always be HTTP handler */
    [self createProtocol:protocols withName:http_only_protocol callback:callback_http andSessionDataSize:0];
    [self createProtocol:protocols+1 withName:protocolName callback:callback_websockets andSessionDataSize:sizeof(int)];
    [self createProtocol:protocols+2 withName:NULL callback:NULL andSessionDataSize:0];
    
    return libwebsocket_create_context(port, NULL, protocols,
                                       libwebsocket_internal_extensions,
                                       NULL, NULL, NULL, -1, -1, 0, NULL);
}

- (void)createProtocol:(struct libwebsocket_protocols *)protocol withName:(NSString *)name callback:(callback_function)callback andSessionDataSize:(int)sessionDataSize {
    
    if (name != NULL) {
        protocol->name = calloc(1 + name.length, sizeof(char));
        [name getCString:(char *)protocol->name maxLength:(1 + name.length) encoding:NSASCIIStringEncoding];
    }
    else {
        protocol->name = NULL;
    }
    
    protocol->callback = callback;
    protocol->per_session_data_size = sessionDataSize;
}

- (void)destroyProtocol:(struct libwebsocket_protocols *)protocol {
    free((char *)protocol->name);
}

- (void)destroyContext:(struct libwebsocket_context *)context {
    for (int i=0; i<3; i++) {
        [self destroyProtocol:context->protocols+i];
    }
    libwebsocket_context_destroy(context);
}

#pragma mark - Server management
- (void)startListeningOnPort:(int)port withProtocolName:(NSString *)protocolName andCompletionBlock:(void(^)(NSError *error))completionBlock {
    
    if (self.isRunning) {
        return;
    }
    
    self.isRunning = YES;
    
    self.context = [self createContextWithProtocolName:protocolName callbackFunction:callback_websockets andPort:port];
    NSError *error = nil;
    if (self.context == NULL) {
        error = [NSError errorWithDomain:errorDomain code:0 userInfo:@{NSLocalizedDescriptionKey: NSLocalizedString(@"Couldn't create the libwebsockets context.", @"")}];
    }
    
    timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, networkQueue);
//    self.timer = &*test;
    
    dispatch_source_set_timer(timer,DISPATCH_TIME_NOW, pollingInterval*NSEC_PER_USEC, (pollingInterval/2)*NSEC_PER_USEC);
    
    dispatch_source_set_event_handler(timer, ^{
        @autoreleasepool {
            libwebsocket_service(self.context, 0);
        }
    });
    
    dispatch_source_set_cancel_handler(timer, ^{
        dispatch_async(dispatch_get_main_queue(), ^{
            self.isRunning = NO;
            [self cleanup];
            self.serverStoppedCompletionBlock();
        });
    });
    
    dispatch_async(dispatch_get_main_queue(), ^{
        completionBlock(error);
    });
    
    dispatch_resume(timer);
    
//    self.timer = test;
}

- (void)stopWithCompletionBlock:(void (^)())completionBlock {
    
    self.serverStoppedCompletionBlock = completionBlock;

    if (!self.isRunning) {
        self.serverStoppedCompletionBlock();
        return;
    }
    else {
        dispatch_source_cancel(timer);
    }
}

- (void)cleanup {
//    dispatch_release(self.timer);
    [self destroyContext:self.context];
    self.context = NULL;
    [self.asyncMessageQueue reset];
}

#pragma mark Session Management

- (void)setHandleRequestBlock:(BLWebSocketsHandleRequestBlock)handleRequestBlock forSession:(int)user {
    NSString *key = [NSString stringWithFormat:@"%d", user];
    BLWebSocketsHandleRequestBlock value = [handleRequestBlock copy];
    [self.handleRequestBlocks setValue:value forKey:key];
}

#pragma mark - Async messaging

- (void)push:(NSData *)data toSession:(int)session {
    [self.asyncMessageQueue enqueueMessage:data forUserWithId:session];
    dispatch_async(networkQueue, ^{
        //TODO we should change this to "libwebsocket_callback_on_writable", but we need the libwebsocket object that
        //TODO corresponds with the session id for that. we might need to store that in an additional dictionary
        libwebsocket_callback_on_writable_all_protocol(&(self.context->protocols[1]));
    });
}

- (void)pushToAll:(NSData *)data {
    [self.asyncMessageQueue enqueueMessageForAllUsers:data];
    dispatch_async(networkQueue, ^{
        libwebsocket_callback_on_writable_all_protocol(&(self.context->protocols[1]));
    });
}


@end

static void write_data_websockets(NSData *data, struct libwebsocket *wsi) {
    
    unsigned char *response_buf;
    
    if (data.length > 0) {
        response_buf = (unsigned char*) malloc(LWS_SEND_BUFFER_PRE_PADDING + data.length +LWS_SEND_BUFFER_POST_PADDING);
        bcopy([data bytes], &response_buf[LWS_SEND_BUFFER_PRE_PADDING], data.length);
        libwebsocket_write(wsi, &response_buf[LWS_SEND_BUFFER_PRE_PADDING], data.length, LWS_WRITE_TEXT);
        free(response_buf);
    }
    else {
        NSLog(@"Attempt to write empty data on the websocket");
    }
}

/* Implementation of the callbacks (http and websockets) */
static int callback_websockets(struct libwebsocket_context * this,
             struct libwebsocket *wsi,
             enum libwebsocket_callback_reasons reason,
             void *user, void *in, size_t len) {
    int *session_id = (int *) user;
    switch (reason) {
        case LWS_CALLBACK_ESTABLISHED:
            NSLog(@"%@", @"Connection established");
            *session_id = sharedInstance.sessionIdIncrementalCount++;
            [sharedInstance.asyncMessageQueue addMessageQueueForUserWithId:*session_id];
            
            break;
        case LWS_CALLBACK_RECEIVE: {
            //TODO we can use libwebsocket_is_final_fragment() and libwebsockets_remaining_packet_payload() to check if this is just a fragment of the message
            //If so, we should add it to a buffer and only deliver it to the HandleRequestBlock after the entire message has been received
            const size_t remaining = libwebsockets_remaining_packet_payload(wsi);
            NSLog(@"Receive. Is Final: %d || Remain: %zu", libwebsocket_is_final_fragment(wsi), remaining);
            NSData *data = [NSData dataWithBytes:(const void *)in length:len];
            NSData *response = nil;
            NSString *key = [NSString stringWithFormat:@"%d", *session_id];
            BLWebSocketsHandleRequestBlock hrb = (BLWebSocketsHandleRequestBlock)[sharedInstance.handleRequestBlocks objectForKey:key];
            if (!hrb) {
                hrb = sharedInstance.defaultHandleRequestBlock;
            }
            if (hrb) {
                response = hrb(*session_id, data);
            }
            if (response) {
                write_data_websockets(response, wsi);
            }
            break;
        }
        case LWS_CALLBACK_SERVER_WRITEABLE: {
            NSData *message = [sharedInstance.asyncMessageQueue messageForUserWithId:*session_id];
            if (message != nil) {
                write_data_websockets(message, wsi);
                
                //TODO we need this so the writeable callback is called again
                //this might produce a lot of overhead, we should check if there are messages in the queue left
                //also, we should change writable_all_protocol to writeable
                libwebsocket_callback_on_writable_all_protocol(&(sharedInstance.context->protocols[1]));
            }
            break;
        }
        case LWS_CALLBACK_CLOSED: {
            [sharedInstance.asyncMessageQueue removeMessageQueueForUserWithId:*session_id];
            break;
        }
        default:
            break;
    }
    
    return 0;
}



static int callback_http(struct libwebsocket_context *context,
                         struct libwebsocket *wsi,
                         enum libwebsocket_callback_reasons reason, void *user,
                         void *in, size_t len)
{
    return 0;
}


