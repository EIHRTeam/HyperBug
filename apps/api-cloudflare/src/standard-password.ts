/// <reference path="./vendor.d.ts" />
/* oxlint-disable no-underscore-dangle -- libsodium's raw Wasm exports use leading underscores. */
import sodiumFactory from 'libsodium-sumo';
import sodiumWasm from './vendor/libsodium-sumo-0.8.4.wasm';
import type { DeploymentConfig } from '@hyperbug/config';
import {
  createStandardPasswordService,
  CryptoFailure,
  snapshotStandardPasswordPolicy,
  validArgon2idParameters,
  type Argon2idParameters,
  type Argon2idProvider,
  type StandardPasswordPolicy,
  type StandardPasswordService,
} from '@hyperbug/security';

const saltBytes = 16;
const verifierBytes = 32;

type Sodium = Awaited<ReturnType<typeof sodiumFactory>>;
let sodium: Promise<Sodium> | undefined;

function loadSodium(): Promise<Sodium> {
  // The factory uses CSPRNG during initialization; Workers forbids this in
  // global scope, so instantiate on the first request and reuse the instance.
  return (sodium ??= sodiumFactory({
    getRandomValue: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
    instantiateWasm(imports, receive) {
      const instance = new WebAssembly.Instance(sodiumWasm, imports);
      receive(instance, sodiumWasm);
      return instance.exports;
    },
  }).then((loaded) => {
    if (loaded._sodium_init() < 0) throw new CryptoFailure();
    return loaded;
  }));
}

function alloc(loaded: Sodium, bytes: number): number {
  const pointer = loaded._malloc(bytes);
  if (!Number.isSafeInteger(pointer) || pointer <= 0) throw new CryptoFailure();
  return pointer;
}

function wipeAndFree(loaded: Sodium, pointer: number, bytes: number): void {
  if (pointer <= 0) return;
  loaded.HEAPU8.fill(0, pointer, pointer + bytes);
  loaded._free(pointer);
}

/** Candidate for paid-capable standard Workers only; no account route is wired. */
export function createCloudflareArgon2idProvider(
  maximumMemoryKiB: number,
): Argon2idProvider {
  if (
    !Number.isSafeInteger(maximumMemoryKiB) ||
    maximumMemoryKiB < 19 * 1024 ||
    maximumMemoryKiB > 1_048_576
  )
    throw new CryptoFailure();
  let active = false;
  const derive = async (
    password: Uint8Array,
    salt: Uint8Array,
    parameters: Argon2idParameters,
    signal?: AbortSignal,
  ): Promise<Uint8Array> => {
    let cost: Argon2idParameters;
    try {
      cost = Object.freeze({
        memoryKiB: parameters.memoryKiB,
        passes: parameters.passes,
        parallelism: parameters.parallelism,
      });
    } catch {
      throw new CryptoFailure();
    }
    // libsodium's pwhash ABI does not expose a lane-count argument.
    if (
      !(password instanceof Uint8Array) ||
      password.byteLength < 1 ||
      password.byteLength > 1024 ||
      !(salt instanceof Uint8Array) ||
      salt.byteLength !== saltBytes ||
      !validArgon2idParameters(cost) ||
      cost.parallelism !== 1 ||
      cost.memoryKiB > maximumMemoryKiB ||
      signal?.aborted ||
      active
    )
      throw new CryptoFailure();
    active = true;
    const message = Uint8Array.from(password);
    const nonce = Uint8Array.from(salt);
    let loaded: Sodium | undefined;
    let messagePtr = 0;
    let noncePtr = 0;
    let outputPtr = 0;
    try {
      loaded = await loadSodium();
      if (signal?.aborted) throw new CryptoFailure();
      messagePtr = alloc(loaded, message.byteLength);
      noncePtr = alloc(loaded, saltBytes);
      outputPtr = alloc(loaded, verifierBytes);
      loaded.HEAPU8.set(message, messagePtr);
      loaded.HEAPU8.set(nonce, noncePtr);
      const result = loaded._crypto_pwhash(
        outputPtr,
        verifierBytes,
        0,
        messagePtr,
        message.byteLength,
        0,
        noncePtr,
        cost.passes,
        0,
        cost.memoryKiB * 1024,
        2,
      );
      if (result !== 0 || signal?.aborted) throw new CryptoFailure();
      return Uint8Array.from(
        loaded.HEAPU8.subarray(outputPtr, outputPtr + verifierBytes),
      );
    } catch {
      throw new CryptoFailure();
    } finally {
      if (loaded) {
        wipeAndFree(loaded, outputPtr, verifierBytes);
        wipeAndFree(loaded, noncePtr, saltBytes);
        wipeAndFree(loaded, messagePtr, message.byteLength);
      }
      message.fill(0);
      nonce.fill(0);
      active = false;
    }
  };
  return Object.freeze({
    derive,
    async matches(
      password: Uint8Array,
      salt: Uint8Array,
      verifier: Uint8Array,
      parameters: Argon2idParameters,
      signal?: AbortSignal,
    ): Promise<boolean> {
      if (
        !(verifier instanceof Uint8Array) ||
        verifier.byteLength !== verifierBytes
      )
        throw new CryptoFailure();
      const expected = Uint8Array.from(verifier);
      let derived: Uint8Array | undefined;
      let loaded: Sodium | undefined;
      let left = 0;
      let right = 0;
      try {
        derived = await derive(password, salt, parameters, signal);
        loaded = await loadSodium();
        if (signal?.aborted) throw new CryptoFailure();
        left = alloc(loaded, verifierBytes);
        right = alloc(loaded, verifierBytes);
        loaded.HEAPU8.set(derived, left);
        loaded.HEAPU8.set(expected, right);
        return loaded._crypto_verify_32(left, right) === 0;
      } catch {
        throw new CryptoFailure();
      } finally {
        if (loaded) {
          wipeAndFree(loaded, right, verifierBytes);
          wipeAndFree(loaded, left, verifierBytes);
        }
        derived?.fill(0);
        expected.fill(0);
      }
    },
  });
}

/** Paid-capable standard Workers only; reject unsupported stored-cost policy. */
export function createCloudflareStandardPasswordService(
  deployment: DeploymentConfig,
  policy: StandardPasswordPolicy,
  maximumMemoryKiB: number,
): StandardPasswordService {
  if (deployment?.tier !== 'standard') throw new CryptoFailure();
  const selected = snapshotStandardPasswordPolicy(policy);
  if (
    selected.maximum.parallelism !== 1 ||
    selected.maximum.memoryKiB > maximumMemoryKiB
  )
    throw new CryptoFailure();
  return createStandardPasswordService(
    createCloudflareArgon2idProvider(maximumMemoryKiB),
    selected,
  );
}
