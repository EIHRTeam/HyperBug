/** Structural stand-ins for the library's ceremony JSON shapes. */
export interface FakeRegistrationResponseJSON {
  id: string;
  rawId: string;
  type: 'public-key';
  clientExtensionResults: Record<string, never>;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}
export interface FakeAuthenticationResponseJSON {
  id: string;
  rawId: string;
  type: 'public-key';
  clientExtensionResults: Record<string, never>;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}

/**
 * Minimal software authenticator for ceremony tests: fmt "none" registration
 * and ECDSA P-256 assertions, with a tiny fixed-shape CBOR encoder. Test-only;
 * never production code.
 */

function cborHead(major: number, length: number): number[] {
  if (length < 24) return [(major << 5) | length];
  if (length <= 0xff) return [(major << 5) | 24, length];
  return [(major << 5) | 25, length >> 8, length & 0xff];
}

function cborText(value: string): number[] {
  return [...cborHead(3, value.length), ...Buffer.from(value, 'utf8')];
}

function cborBytes(value: Uint8Array): number[] {
  return [...cborHead(2, value.length), ...value];
}

function cborUnsigned(value: number): number[] {
  if (value < 24) return [value];
  if (value <= 0xff) return [24, value];
  if (value <= 0xffff) return [25, value >> 8, value & 0xff];
  return [
    26,
    value >>> 24,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function cborNegative(magnitude: number): number[] {
  const n = magnitude - 1;
  if (n < 24) return [0x20 | n];
  if (n <= 0xff) return [0x38, n];
  if (n <= 0xffff) return [0x39, n >> 8, n & 0xff];
  return [0x3a, n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

const b64u = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64url');

export interface FakeAuthenticator {
  readonly credentialId: string;
  registration(
    challenge: string,
    userId: Uint8Array,
  ): Promise<FakeRegistrationResponseJSON>;
  assertion(
    challenge: string,
    counter: number,
  ): Promise<FakeAuthenticationResponseJSON>;
}

export async function createFakeAuthenticator(
  rpID: string,
  origin: string,
): Promise<FakeAuthenticator> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );
  // Uncompressed SEC1 point: 0x04 || X || Y
  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);
  // COSE EC2 key: {1: 2, 3: -7, -1: 1, -2: x, -3: y}
  const coseKey = new Uint8Array([
    ...cborHead(5, 5),
    ...cborUnsigned(1),
    ...cborUnsigned(2),
    ...cborUnsigned(3),
    ...cborNegative(7),
    ...cborNegative(1),
    ...cborUnsigned(1),
    ...cborNegative(2),
    ...cborBytes(x),
    ...cborNegative(3),
    ...cborBytes(y),
  ]);
  const credentialId = crypto.getRandomValues(new Uint8Array(32));
  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpID)),
  );

  async function clientData(
    type: 'webauthn.create' | 'webauthn.get',
    challenge: string,
  ): Promise<Uint8Array> {
    return new TextEncoder().encode(
      JSON.stringify({ type, challenge, origin }),
    );
  }

  /** Web Crypto returns raw r||s; WebAuthn assertions use ASN.1 DER. */
  function derSignature(sig: Uint8Array): Uint8Array {
    const component = (bytes: Uint8Array): number[] => {
      let start = 0;
      while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
      const value = [...bytes.slice(start)];
      const needsPad = value[0]! >= 0x80;
      const body = needsPad ? [0, ...value] : value;
      return body.length < 0x80
        ? [0x02, body.length, ...body]
        : [0x02, 0x81, body.length, ...body];
    };
    const r = component(sig.slice(0, 32));
    const s = component(sig.slice(32));
    const body = [...r, ...s];
    const head =
      body.length < 0x80 ? [0x30, body.length] : [0x30, 0x81, body.length];
    return new Uint8Array([...head, ...body]);
  }

  async function sign(
    authenticatorData: Uint8Array,
    clientDataBytes: Uint8Array,
  ): Promise<Uint8Array> {
    const clientHash = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        clientDataBytes as Uint8Array<ArrayBuffer>,
      ),
    );
    const signed = new Uint8Array(
      authenticatorData.length + clientHash.length,
    ) as Uint8Array<ArrayBuffer>;
    signed.set(authenticatorData);
    signed.set(clientHash, authenticatorData.length);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      signed,
    );
    return derSignature(new Uint8Array(signature));
  }

  return {
    credentialId: b64u(credentialId),
    async registration(challenge, userId) {
      const flags = 0x45; // UP | UV | AT
      const counter = 0;
      const aaguid = new Uint8Array(16);
      const authData = new Uint8Array([
        ...rpIdHash,
        flags,
        0,
        0,
        0,
        0,
        ...aaguid,
        credentialId.length >> 8,
        credentialId.length & 0xff,
        ...credentialId,
        ...coseKey,
      ]);
      const clientDataBytes = await clientData('webauthn.create', challenge);
      // attestationObject: {fmt: 'none', attStmt: {}, authData: bytes}
      const attestationObject = new Uint8Array([
        ...cborHead(5, 3),
        ...cborText('fmt'),
        ...cborText('none'),
        ...cborText('attStmt'),
        ...cborHead(5, 0),
        ...cborText('authData'),
        ...cborBytes(authData),
      ]);
      void counter;
      void userId;
      return {
        id: b64u(credentialId),
        rawId: b64u(credentialId),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64u(clientDataBytes),
          attestationObject: b64u(attestationObject),
          transports: ['internal'],
        },
      };
    },
    async assertion(challenge, counter) {
      const flags = 0x05; // UP | UV
      const authData = new Uint8Array([
        ...rpIdHash,
        flags,
        (counter >> 24) & 0xff,
        (counter >> 16) & 0xff,
        (counter >> 8) & 0xff,
        counter & 0xff,
      ]);
      const clientDataBytes = await clientData('webauthn.get', challenge);
      const signature = await sign(authData, clientDataBytes);
      return {
        id: b64u(credentialId),
        rawId: b64u(credentialId),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64u(clientDataBytes),
          authenticatorData: b64u(authData),
          signature: b64u(signature),
          userHandle: null,
        },
      };
    },
  };
}
