import { IncomingMessage, ServerResponse } from 'node:http';

/** srvx exposes these primitives only at the Node composition boundary. */
export function closeRejectedNodeRequest(request: Request): void {
  const runtime = (
    request as Request & {
      runtime?: { node?: { req?: IncomingMessage; res?: ServerResponse } };
    }
  ).runtime?.node;
  if (
    runtime?.req instanceof IncomingMessage &&
    runtime.res instanceof ServerResponse &&
    !runtime.req.complete &&
    !runtime.res.headersSent
  ) {
    // Do not reuse an HTTP/1 connection containing an unread/rejected body.
    // Send the safe error first; closing afterward avoids unbounded draining.
    runtime.res.shouldKeepAlive = false;
    runtime.res.setHeader('connection', 'close');
  }
}
