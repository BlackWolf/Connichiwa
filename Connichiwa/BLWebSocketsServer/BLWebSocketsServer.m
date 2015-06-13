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
#import "BLWebSocketConnection.h"

static int DEFAULT_POLLING_INTERVAL = INT_MAX;

static NSString *HTTP_ONLY_PROTOCOL_NAME = @"http-only";

const char *QUEUE_IDENTIFIER = "com.blwebsocketsserver.network";

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

//static dispatch_source_t timer;
//static dispatch_queue_t networkQueue;

@interface BLWebSocketsServer()

@property (nonatomic, assign, readwrite) BOOL isRunning;
@property (nonatomic, retain) dispatch_source_t timer;
@property (nonatomic, retain) dispatch_queue_t networkQueue;

/* Context representing the server */
@property (nonatomic, assign) struct libwebsocket_context *context;
@property (nonatomic, strong, readwrite) BLWebSocketOnMessageHandler defaultOnMessageHandler;
@property (nonatomic, strong, readwrite) BLWebSocketOnCloseHandler defaultOnCloseHandler;
@property (nonatomic, strong, readwrite) NSMutableDictionary *connections;
//@property (strong, readwrite) NSTimer *stopFastPollingTimer;

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
        sharedInstance.defaultOnMessageHandler = NULL;
        sharedInstance.connections = [NSMutableDictionary dictionary];
    });
    return sharedInstance;
}

#pragma mark - Initialization/Teardown
- (id)init {
    self = [super init];
    if (self) {
        self.networkQueue = dispatch_queue_create(QUEUE_IDENTIFIER, DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

#pragma mark - Context management
- (struct libwebsocket_context *)createContextWithProtocolName:(NSString *)protocolName callbackFunction:(callback_function)callback andPort:(int)port {
//    struct libwebsocket_protocols * protocols = (struct libwebsocket_protocols *) calloc(3, sizeof(struct libwebsocket_protocols));
////
////    /* first protocol must always be HTTP handler */
//    [self createProtocol:protocols withName:HTTP_ONLY_PROTOCOL_NAME callback:callback_http andSessionDataSize:0];
//    [self createProtocol:protocols+1 withName:protocolName callback:callback_websockets andSessionDataSize:sizeof(int)];
//    [self createProtocol:protocols+2 withName:NULL callback:NULL andSessionDataSize:0];
    
    struct libwebsocket_protocols * protocols = (struct libwebsocket_protocols *) calloc(2, sizeof(struct libwebsocket_protocols));
    [self createProtocol:protocols withName:protocolName callback:callback_websockets andSessionDataSize:sizeof(int)];
    [self createProtocol:protocols+1 withName:NULL callback:NULL andSessionDataSize:0];
    
//    struct lws_context_creation_info i;
//    i.port = port;
//    i.iface = NULL;
//    i.gid = -1;
//    i.uid = -1;
//    i.options = 0;
//    i.protocols = protocols;
////    i.extensions = libwebsocket_get_internal_extensions;
//    i.extensions = NULL;
//    i.ssl_cert_filepath = NULL;
//    i.ssl_private_key_filepath = NULL;
//    lws_set_log_level(LLL_WARN | LLL_NOTICE | LLL_INFO | LLL_DEBUG | LLL_CLIENT | LLL_ERR, NULL);
//    return libwebsocket_create_context(&i);
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
    
    self.timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, self.networkQueue);
    
    dispatch_source_set_timer(self.timer, DISPATCH_TIME_NOW, 1, 0);
//    dispatch_source_set_timer(self.timer, DISPATCH_TIME_NOW, DEFAULT_POLLING_INTERVAL*NSEC_PER_USEC, (DEFAULT_POLLING_INTERVAL/2)*NSEC_PER_USEC);
    
    dispatch_source_set_event_handler(self.timer, ^{
        @autoreleasepool {
            libwebsocket_service(self.context, DEFAULT_POLLING_INTERVAL);
//            libwebsocket_service(self.context, 0);
        }
    });
    
    dispatch_source_set_cancel_handler(self.timer, ^{
        dispatch_async(dispatch_get_main_queue(), ^{
            self.isRunning = NO;
            [self cleanup];
            self.serverStoppedCompletionBlock();
        });
    });
    
    dispatch_async(dispatch_get_main_queue(), ^{
        completionBlock(error);
    });
    
    dispatch_resume(self.timer);
}

- (void)stopWithCompletionBlock:(void (^)())completionBlock {
    
    self.serverStoppedCompletionBlock = completionBlock;

    if (!self.isRunning) {
        self.serverStoppedCompletionBlock();
        return;
    }
    else {
        dispatch_source_cancel(self.timer);
    }
}

- (void)cleanup {
//    dispatch_release(self.timer);
    [self destroyContext:self.context];
    self.context = NULL;
    
    [self.connections removeAllObjects];
}

#pragma mark Session Management

- (void)setOnMessageHandler:(BLWebSocketOnMessageHandler)handler forConnection:(int)connectionID {
    BLWebSocketConnection *connection = [BLWebSocketsServer connectionForID:connectionID];
    [connection setOnMessageHandler:handler];
}

- (void)setOnCloseHandler:(BLWebSocketOnCloseHandler)handler forConnection:(int)connectionID {
    BLWebSocketConnection *connection = [BLWebSocketsServer connectionForID:connectionID];
    [connection setOnCloseHandler:handler];
}

#pragma mark - Async messaging

- (void)pushMessage:(NSData *)message toConnection:(int)connectionID {
    BLWebSocketConnection *connection = [BLWebSocketsServer connectionForID:connectionID];
    if (connection == nil) {
//        NSLog(@"LOST MESSAGE %@", [[NSString alloc] initWithData:message encoding:NSUTF8StringEncoding]);
        return;
    }
    [connection enqueueOutgoingMessage:message];
    
    //Make sure the new message is sent as soon as the socket is writable
    libwebsocket_callback_on_writable(self.context, connection.socket);
    libwebsocket_cancel_service(self.context);
}

- (void)pushMessageToAll:(NSData *)message {
    [self pushMessageToAll:message except:nil];
}


- (void)pushMessageToAll:(NSData *)message except:(NSArray *)exceptions {
    for (BLWebSocketConnection *connection in self.connections.allValues) {
        if ([exceptions containsObject:@(connection.ID)]) continue;
        [connection enqueueOutgoingMessage:message];
    }
    
    //Make sure all connections call the writable callback when they are ready
    libwebsocket_callback_on_writable_all_protocol(&(self.context->protocols[0]));
    libwebsocket_cancel_service(self.context);
}


+ (BLWebSocketConnection *)connectionForID:(int)connectionID {
    id key = [BLWebSocketsServer keyForConnectionID:connectionID];
    return [sharedInstance.connections objectForKey:key];
}

+ (id)keyForConnectionID:(int)connectionID {
    return [NSNumber numberWithInt:connectionID];
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
        int *connectionID = (int *) user;
        switch (reason) {
            case LWS_CALLBACK_ESTABLISHED: {
                *connectionID = sharedInstance.sessionIdIncrementalCount++;
                
//                NSLog(@"CREATING CONNECTION %d", *connectionID);
                
                id connectionKey = [BLWebSocketsServer keyForConnectionID:*connectionID];
                BLWebSocketConnection *connection = [[BLWebSocketConnection alloc] initWithID:*connectionID socket:wsi];
                [sharedInstance.connections setObject:connection forKey:connectionKey];
                
                break;
            }
            case LWS_CALLBACK_RECEIVE: {
                BLWebSocketConnection *connection = [BLWebSocketsServer connectionForID:*connectionID];
                
                NSData *chunk = [NSData dataWithBytes:(const void *)in length:len];
                if (connection.incomingMessage == nil) connection.incomingMessage = [NSMutableData data];
                [connection.incomingMessage appendData:chunk];
                
                //Check if this chunk is the last chunk of the message. If so we trigger the
                //onMessage callback, otherwise we just keep on collecting chunks
                int isFinalFragment = libwebsocket_is_final_fragment(wsi);
                const size_t remainingBytes = libwebsockets_remaining_packet_payload(wsi);
                if (isFinalFragment && remainingBytes == 0) {
                    BLWebSocketOnMessageHandler callback = connection.onMessageHandler;
                    if (!callback) callback = sharedInstance.defaultOnMessageHandler;
                    if (callback) callback(*connectionID, connection.incomingMessage);
                    connection.incomingMessage = nil;
                }
                
                break;
            }
            case LWS_CALLBACK_SERVER_WRITEABLE: {
                //Get the first message on the outgoing message queue of this connection and send it
                BLWebSocketConnection *connection = [BLWebSocketsServer connectionForID:*connectionID];
                NSData *message = [connection dequeueOutgoingMessage];
                if (message != nil) {
//                    NSLog(@"SENDING MESSAGE TO %d", *connectionID);
//                    NSLog(@"SENDING MESSAGE %@", [[NSString alloc] initWithData:message encoding:NSUTF8StringEncoding]);
                    write_data_websockets(message, wsi);
                    
                    //Make sure the rest of the message queue is processed
                    libwebsocket_callback_on_writable(sharedInstance.context, wsi);
                }
                break;
            }
            case LWS_CALLBACK_CLOSED: {
                //Call the onClose handler
                BLWebSocketConnection *connection = [BLWebSocketsServer connectionForID:*connectionID];
//                NSLog(@"CLOSED CONNECTION %d", *connectionID);
                BLWebSocketOnCloseHandler callback = connection.onCloseHandler;
                if (!callback) callback = sharedInstance.defaultOnCloseHandler;
                if (callback) callback(*connectionID);
                
                //Cleanup the connection
                id connectionKey = [BLWebSocketsServer keyForConnectionID:*connectionID];
                [sharedInstance.connections removeObjectForKey:connectionKey];
                break;
            }
            default:
                break;
        }
    
//        dispatch_source_set_timer(timer,DISPATCH_TIME_NOW, FAST_POLLING_INTERVAL, (FAST_POLLING_INTERVAL/2));
    
        return 0;
}



static int callback_http(struct libwebsocket_context *context,
                         struct libwebsocket *wsi,
                         enum libwebsocket_callback_reasons reason, void *user,
                         void *in, size_t len)
{
    return 0;
}

