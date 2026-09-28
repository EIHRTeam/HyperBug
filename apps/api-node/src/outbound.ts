import type { LookupAddress } from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import type { TLSSocket } from 'node:tls';
import {
  canonicalIpAddress,
  createOutboundFetcher,
  type OutboundLimits,
} from '@hyperbug/security';
import { isPublicOutboundAddress } from './outbound-address.ts';

export type NodeOutboundResolver = (
  hostname: string,
) => Promise<readonly LookupAddress[]>;

const systemResolver: NodeOutboundResolver = (hostname) =>
  dnsLookup(hostname, { all: true });

function rejectedLookup(): NodeJS.ErrnoException {
  const failure = new Error(
    'Outbound address verification failed.',
  ) as NodeJS.ErrnoException;
  failure.code = 'EACCES';
  return failure;
}

function nodeHttpsTransport(resolver: NodeOutboundResolver): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (
      typeof input !== 'string' ||
      init?.redirect !== 'manual' ||
      (init.method !== 'GET' && init.method !== 'POST')
    )
      throw new Error('Invalid outbound transport request');
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error('Invalid outbound transport destination');
    const body = init.body;
    if (body !== null && body !== undefined && !(body instanceof ArrayBuffer))
      throw new Error('Invalid outbound transport body');
    const headers = Object.fromEntries(new Headers(init.headers));
    headers['accept-encoding'] = 'identity';
    if (body) headers['content-length'] = String(body.byteLength);
    let pinned: LookupAddress | null = null;
    const lookup: LookupFunction = (hostname, options, callback) => {
      if (hostname !== url.hostname) {
        callback(rejectedLookup(), '');
        return;
      }
      void resolver(hostname).then(
        (addresses) => {
          let chosen: LookupAddress;
          try {
            if (
              init.signal?.aborted ||
              !Array.isArray(addresses) ||
              addresses.length < 1 ||
              addresses.length > 32
            )
              throw rejectedLookup();
            const candidates = addresses.map((entry) => ({
              address: entry?.address,
              family: entry?.family,
            }));
            if (
              candidates.some(
                (entry) =>
                  (entry.family !== 4 && entry.family !== 6) ||
                  isIP(entry.address) !== entry.family ||
                  !isPublicOutboundAddress(entry.address),
              )
            )
              throw rejectedLookup();
            chosen = candidates[0]!;
          } catch {
            callback(rejectedLookup(), '');
            return;
          }
          pinned = chosen;
          if (options.all) callback(null, [chosen]);
          else callback(null, chosen.address, chosen.family);
        },
        () => callback(rejectedLookup(), ''),
      );
    };

    return new Promise<Response>((resolve, reject) => {
      const request = httpsRequest(
        url,
        {
          method: init.method,
          headers,
          agent: false,
          lookup,
          servername: url.hostname,
          rejectUnauthorized: true,
          signal: init.signal ?? undefined,
          maxHeaderSize: 8192,
        },
        (response) => {
          try {
            const remote = (response.socket as TLSSocket).remoteAddress;
            if (
              !pinned ||
              !remote ||
              canonicalIpAddress(remote) !==
                canonicalIpAddress(pinned.address) ||
              !(response.socket as TLSSocket).authorized ||
              init.signal?.aborted
            )
              throw new Error('Outbound connection verification failed');
            const status = response.statusCode;
            if (!status || status < 200 || status > 599)
              throw new Error('Invalid upstream status');
            const encoding = response.headers['content-encoding'];
            if (encoding !== undefined && encoding !== 'identity')
              throw new Error('Compressed upstream response denied');
            const responseHeaders = new Headers();
            for (const name of ['content-type', 'content-length'] as const) {
              const value = response.headers[name];
              if (typeof value === 'string') responseHeaders.set(name, value);
            }
            resolve(
              new Response(
                [204, 205, 304].includes(status)
                  ? null
                  : (Readable.toWeb(response) as ReadableStream<Uint8Array>),
                { status, headers: responseHeaders },
              ),
            );
          } catch (error) {
            response.destroy();
            reject(error);
          }
        },
      );
      request.on('error', reject);
      request.end(body ? new Uint8Array(body) : undefined);
    });
  }) as typeof fetch;
}

/** Node-only direct TLS transport. The shared policy still owns destinations and bounds. */
export function createNodeOutboundFetcher(
  limits: OutboundLimits,
  resolver: NodeOutboundResolver = systemResolver,
) {
  return createOutboundFetcher(limits, nodeHttpsTransport(resolver));
}
