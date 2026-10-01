import { expect, it } from 'vitest';
import { createIngressAttestation } from '../../apps/api-cloudflare/src/ingress-attestation.ts';

const key = Buffer.alloc(32, 41).toString('base64url');

it('binds a short-lived trusted IP to the exact request target', async () => {
  const attestation = createIngressAttestation(key);
  const request = new Request(
    'https://api.example/api/v1/accounts/register?x=1',
    {
      method: 'POST',
      headers: {
        'x-hyperbug-ingress-ip': '203.0.113.99',
        'x-hyperbug-ingress-signature': 'forged',
        'cf-connecting-ip': '203.0.113.99',
        'x-forwarded-for': '203.0.113.98',
      },
    },
  );
  const headers = await attestation.sign(request, '192.0.2.42');
  expect(headers.has('cf-connecting-ip')).toBe(false);
  expect(headers.has('x-forwarded-for')).toBe(false);
  expect(await attestation.verify(new Request(request, { headers }))).toBe(
    '192.0.2.42',
  );
  await expect(
    attestation.verify(
      new Request('https://api.example/api/v1/accounts/register?x=2', {
        method: 'POST',
        headers,
      }),
    ),
  ).rejects.toThrow();
  headers.set('x-hyperbug-ingress-ip', '192.0.2.43');
  await expect(
    attestation.verify(new Request(request, { headers })),
  ).rejects.toThrow();
});

it('rejects expired, mismatched and malformed assertions', async () => {
  const attestation = createIngressAttestation(key);
  const request = new Request('https://api.example/api/v1/accounts/register', {
    method: 'POST',
  });
  const headers = await attestation.sign(request, '192.0.2.42');
  const wrongKey = createIngressAttestation(
    Buffer.alloc(32, 42).toString('base64url'),
  );
  await expect(
    wrongKey.verify(new Request(request, { headers })),
  ).rejects.toThrow();
  headers.set('x-hyperbug-ingress-time', String(Date.now() - 6000));
  await expect(
    attestation.verify(new Request(request, { headers })),
  ).rejects.toThrow();
  expect(() => createIngressAttestation('short')).toThrow();
});
