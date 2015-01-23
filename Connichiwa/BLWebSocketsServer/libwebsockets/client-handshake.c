#include "private-libwebsockets.h"

struct libwebsocket *__libwebsocket_client_connect_2(
	struct libwebsocket_context *context,
	struct libwebsocket *wsi
) {
	struct pollfd pfd;
	struct timeval tv;
	struct hostent *server_hostent;
	struct sockaddr_in server_addr;
	int n;
	int plen = 0;
	char pkt[512];
	int opt = 1;
#if defined(__APPLE__)
	struct protoent *tcp_proto;
#endif

	lwsl_client("__libwebsocket_client_connect_2\n");
#ifndef LWS_NO_EXTENSIONS
	wsi->candidate_children_list = NULL;
#endif

	/*
	 * proxy?
	 */

	if (context->http_proxy_port) {
		plen = sprintf(pkt, "CONNECT %s:%u HTTP/1.0\x0d\x0a"
			"User-agent: libwebsockets\x0d\x0a"
/*Proxy-authorization: basic aGVsbG86d29ybGQ= */
			"\x0d\x0a", wsi->c_address, wsi->c_port);

		/* OK from now on we talk via the proxy */

		free(wsi->c_address);
		wsi->c_address = strdup(context->http_proxy_address);
		wsi->c_port = context->http_proxy_port;
	}

	/*
	 * prepare the actual connection (to the proxy, if any)
	 */

	lwsl_client("__libwebsocket_client_connect_2: address %s", wsi->c_address);

	server_hostent = gethostbyname(wsi->c_address);
	if (server_hostent == NULL) {
		lwsl_err("Unable to get host name from %s\n", wsi->c_address);
		goto oom4;
	}

	wsi->sock = socket(AF_INET, SOCK_STREAM, 0);

	if (wsi->sock < 0) {
		lwsl_warn("Unable to open socket\n");
		goto oom4;
	}

	server_addr.sin_family = AF_INET;
	server_addr.sin_port = htons(wsi->c_port);
	server_addr.sin_addr = *((struct in_addr *)server_hostent->h_addr);
	bzero(&server_addr.sin_zero, 8);

	/* Disable Nagle */
#if !defined(__APPLE__)
	setsockopt(wsi->sock, SOL_TCP, TCP_NODELAY,
					      (const void *)&opt, sizeof(opt));
#else
	tcp_proto = getprotobyname("TCP");
	setsockopt(wsi->sock, tcp_proto->p_proto, TCP_NODELAY,
							    &opt, sizeof(opt));
#endif

	/* Set receiving timeout */
	tv.tv_sec = 0;
	tv.tv_usec = 100 * 1000;
	setsockopt(wsi->sock, SOL_SOCKET, SO_RCVTIMEO, (char *)&tv, sizeof tv);

	if (connect(wsi->sock, (struct sockaddr *)&server_addr,
					     sizeof(struct sockaddr)) == -1)  {
		lwsl_debug("Connect failed\n");
		compatible_close(wsi->sock);
		goto oom4;
	}

	lwsl_client("connected\n");

	insert_wsi_socket_into_fds(context, wsi);

	/* we are connected to server, or proxy */

	if (context->http_proxy_port) {

		n = send(wsi->sock, pkt, plen, 0);
		if (n < 0) {
			compatible_close(wsi->sock);
			lwsl_debug("ERROR writing to proxy socket\n");
			goto bail1;
		}

		libwebsocket_set_timeout(wsi,
			PENDING_TIMEOUT_AWAITING_PROXY_RESPONSE, AWAITING_TIMEOUT);

		wsi->mode = LWS_CONNMODE_WS_CLIENT_WAITING_PROXY_REPLY;

		return wsi;
	}

	/*
	 * provoke service to issue the handshake directly
	 * we need to do it this way because in the proxy case, this is the
	 * next state and executed only if and when we get a good proxy
	 * response inside the state machine... but notice in SSL case this
	 * may not have sent anything yet with 0 return, and won't until some
	 * many retries from main loop.  To stop that becoming endless,
	 * cover with a timeout.
	 */

	libwebsocket_set_timeout(wsi,
		PENDING_TIMEOUT_SENT_CLIENT_HANDSHAKE, AWAITING_TIMEOUT);

	wsi->mode = LWS_CONNMODE_WS_CLIENT_ISSUE_HANDSHAKE;
	pfd.fd = wsi->sock;
	pfd.revents = POLLIN;

	n = libwebsocket_service_fd(context, &pfd);

	if (n < 0)
		goto oom4;

	if (n) /* returns 1 on failure after closing wsi */
		return NULL;

	return wsi;

oom4:
	if (wsi->c_protocol)
		free(wsi->c_protocol);

	if (wsi->c_origin)
		free(wsi->c_origin);

	free(wsi->c_host);
	free(wsi->c_path);

bail1:
	free(wsi);

	return NULL;
}

/**
 * libwebsocket_client_connect() - Connect to another websocket server
 * @context:	Websocket context
 * @address:	Remote server address, eg, "myserver.com"
 * @port:	Port to connect to on the remote server, eg, 80
 * @ssl_connection:	0 = ws://, 1 = wss:// encrypted, 2 = wss:// allow self
 *			signed certs
 * @path:	Websocket path on server
 * @host:	Hostname on server
 * @origin:	Socket origin name
 * @protocol:	Comma-separated list of protocols being asked for from
 *		the server, or just one.  The server will pick the one it
 *		likes best.
 * @ietf_version_or_minus_one: -1 to ask to connect using the default, latest
 *		protocol supported, or the specific protocol ordinal
 *
 *	This function creates a connection to a remote server
 */

struct libwebsocket *
libwebsocket_client_connect(struct libwebsocket_context *context,
			      const char *address,
			      int port,
			      int ssl_connection,
			      const char *path,
			      const char *host,
			      const char *origin,
			      const char *protocol,
			      int ietf_version_or_minus_one)
{
	struct libwebsocket *wsi;
	int n;
#ifndef LWS_NO_EXTENSIONS
	int m;
	struct libwebsocket_extension *ext;
	int handled;
#endif

#ifndef LWS_OPENSSL_SUPPORT
	if (ssl_connection) {
		lwsl_err("libwebsockets not configured for ssl\n");
		return NULL;
	}
#endif

	wsi = (struct libwebsocket *) malloc(sizeof(struct libwebsocket));
	if (wsi == NULL)
		goto bail1;

	memset(wsi, 0, sizeof *wsi);

	/* -1 means just use latest supported */

	if (ietf_version_or_minus_one == -1)
		ietf_version_or_minus_one = SPEC_LATEST_SUPPORTED;

	wsi->ietf_spec_revision = ietf_version_or_minus_one;
	wsi->u.hdr.name_buffer_pos = 0;
	wsi->user_space = NULL;
	wsi->state = WSI_STATE_CLIENT_UNCONNECTED;
	wsi->u.ws.pings_vs_pongs = 0;
	wsi->protocol = NULL;
	wsi->pending_timeout = NO_PENDING_TIMEOUT;
#ifndef LWS_NO_EXTENSIONS
	wsi->count_active_extensions = 0;
#endif
#ifdef LWS_OPENSSL_SUPPORT
	wsi->use_ssl = ssl_connection;
#endif

	wsi->c_port = port;
	wsi->c_address = strdup(address);

	/* copy parameters over so state machine has access */

	wsi->c_path = (char *)malloc(strlen(path) + 1);
	if (wsi->c_path == NULL)
		goto bail1;
	strcpy(wsi->c_path, path);

	wsi->c_host = (char *)malloc(strlen(host) + 1);
	if (wsi->c_host == NULL)
		goto oom1;
	strcpy(wsi->c_host, host);

	if (origin) {
		wsi->c_origin = (char *)malloc(strlen(origin) + 1);
		if (wsi->c_origin == NULL)
			goto oom2;
		strcpy(wsi->c_origin, origin);
	} else
		wsi->c_origin = NULL;

	wsi->c_callback = NULL;
	if (protocol) {
		const char *pc;
		struct libwebsocket_protocols *pp;

		wsi->c_protocol = (char *)malloc(strlen(protocol) + 1);
		if (wsi->c_protocol == NULL)
			goto oom3;

		strcpy(wsi->c_protocol, protocol);

		pc = protocol;
		while (*pc && *pc != ',')
			pc++;
		n = pc - protocol;
		pp = context->protocols;
		while (pp->name && !wsi->c_callback) {
			if (!strncmp(protocol, pp->name, n))
				wsi->c_callback = pp->callback;
			pp++;
		}
	} else
		wsi->c_protocol = NULL;

	if (!wsi->c_callback)
		wsi->c_callback = context->protocols[0].callback;

	for (n = 0; n < WSI_TOKEN_COUNT; n++) {
		wsi->utf8_token[n].token = NULL;
		wsi->utf8_token[n].token_len = 0;
	}

#ifndef LWS_NO_EXTENSIONS
	/*
	 * Check with each extension if it is able to route and proxy this
	 * connection for us.  For example, an extension like x-google-mux
	 * can handle this and then we don't need an actual socket for this
	 * connection.
	 */

	handled = 0;
	ext = context->extensions;
	n = 0;

	while (ext && ext->callback && !handled) {
		m = ext->callback(context, ext, wsi,
			LWS_EXT_CALLBACK_CAN_PROXY_CLIENT_CONNECTION,
				 (void *)(long)n, (void *)address, port);
		if (m)
			handled = 1;

		ext++;
		n++;
	}

	if (handled) {
		lwsl_client("libwebsocket_client_connect: ext handling conn\n");

		libwebsocket_set_timeout(wsi,
			PENDING_TIMEOUT_AWAITING_EXTENSION_CONNECT_RESPONSE, AWAITING_TIMEOUT);

		wsi->mode = LWS_CONNMODE_WS_CLIENT_WAITING_EXTENSION_CONNECT;
		return wsi;
	}
#endif
	lwsl_client("libwebsocket_client_connect: direct conn\n");

	return __libwebsocket_client_connect_2(context, wsi);

oom3:
	if (wsi->c_origin)
		free(wsi->c_origin);

oom2:
	free(wsi->c_host);

oom1:
	free(wsi->c_path);

bail1:
	free(wsi);

	return NULL;
}


/**
 * libwebsocket_client_connect_extended() - Connect to another websocket server
 * @context:	Websocket context
 * @address:	Remote server address, eg, "myserver.com"
 * @port:	Port to connect to on the remote server, eg, 80
 * @ssl_connection:	0 = ws://, 1 = wss:// encrypted, 2 = wss:// allow self
 *			signed certs
 * @path:	Websocket path on server
 * @host:	Hostname on server
 * @origin:	Socket origin name
 * @protocol:	Comma-separated list of protocols being asked for from
 *		the server, or just one.  The server will pick the one it
 *		likes best.
 * @ietf_version_or_minus_one: -1 to ask to connect using the default, latest
 * 		protocol supported, or the specific protocol ordinal
 * @userdata: Pre-allocated user data
 *
 *	This function creates a connection to a remote server
 */

struct libwebsocket *
libwebsocket_client_connect_extended(struct libwebsocket_context *context,
			      const char *address,
			      int port,
			      int ssl_connection,
			      const char *path,
			      const char *host,
			      const char *origin,
			      const char *protocol,
			      int ietf_version_or_minus_one,
            void *userdata)
{
	struct libwebsocket *ws =
		libwebsocket_client_connect(context, address, port, ssl_connection, path, host, origin, protocol, ietf_version_or_minus_one) ;

	if (ws && !ws->user_space && userdata)
		ws->user_space = userdata ;

	return ws ;
  }
