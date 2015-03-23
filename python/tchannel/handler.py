import collections

EndPoint = collections.namedtuple('EndPoint', ['handler', 'opts'])


class RequestHandler(object):
    """Base class for request handlers.

    Usage example:
        class CustomerReqHandler(RequestHandler):
            def handle_request(self, context, conn):
                Add customized request handling
                logic here

    """
    def handle_request(self, context, conn):
        """Handle incoming request

        :param context: context contains received CallRequestMessage
        :param conn: An incoming TornadoConnection
        """
        raise NotImplementedError()


class TChannelRequestHandler(RequestHandler):
    def __init__(self):
        super(TChannelRequestHandler, self).__init__()
        self.endpoints = {}

    def handle_request(self, context, conn):
        """dispatch incoming request to particular endpoint

        :param context: context contains received CallRequestMessage
        :param conn: An incoming TornadoConnection
        """
        request = TChannelRequest(context, conn)
        endpoint = self._find_endpoint(request.method)
        if endpoint is not None:
            response = TChannelResponse(conn)
            endpoint.handler(request, response, endpoint.opts)
            response.finish()
        else:
            # TODO error handling if endpoint is not found
            raise NotImplementedError()

    def route(self, rule, **opts):
        def decorator(handler):
            self.register_handler(rule, handler, **opts)
            return handler

        return decorator

    def register_handler(self, rule, handler, **opts):
        self.endpoints[rule] = EndPoint(handler=handler, opts=opts)

    def _find_endpoint(self, rule):
        return self.endpoints.get(rule, None)


class TChannelRequest(object):
    """TChannel Request Wrapper"""

    __slots__ = ('message', 'header',
                 'body', 'method',
                 'connection')

    def __init__(self, context, conn):
        self.message = context.message
        self.header = self.message.arg_2
        self.body = self.message.arg_3
        self.method = self.message.arg_1
        self.connection = conn

        # TODO fill up more attributes


class TChannelResponse(object):
    """TChannel Response Wrapper"""

    __slots__ = ('_connection',)

    def __init__(self, conn):
        self._connection = conn

    def write(self, msg):
        self._connection.write(msg)

    def finish(self):
        self._connection.finish()
