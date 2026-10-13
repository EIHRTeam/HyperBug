import { argon2, timingSafeEqual } from 'node:crypto';
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

/** Candidate Node 24 provider; production policy and acceptance remain open. */
export function createNodeArgon2idProvider(
  maxConcurrent: number,
  memoryBudgetKiB: number,
): Argon2idProvider {
  if (
    !Number.isSafeInteger(maxConcurrent) ||
    maxConcurrent < 1 ||
    maxConcurrent > 32 ||
    !Number.isSafeInteger(memoryBudgetKiB) ||
    memoryBudgetKiB < 19456 ||
    memoryBudgetKiB > 4_194_304
  )
    throw new CryptoFailure();
  let active = 0;
  let reservedMemoryKiB = 0;
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
    if (
      !(password instanceof Uint8Array) ||
      password.byteLength < 1 ||
      password.byteLength > 1024 ||
      !(salt instanceof Uint8Array) ||
      salt.byteLength !== saltBytes ||
      !validArgon2idParameters(cost) ||
      signal?.aborted ||
      active >= maxConcurrent ||
      reservedMemoryKiB + cost.memoryKiB > memoryBudgetKiB
    )
      throw new CryptoFailure();
    const message = Uint8Array.from(password);
    const nonce = Uint8Array.from(salt);
    active++;
    reservedMemoryKiB += cost.memoryKiB;
    try {
      const result = await new Promise<Uint8Array>((resolve, reject) => {
        try {
          argon2(
            'argon2id',
            {
              message,
              nonce,
              parallelism: cost.parallelism,
              tagLength: verifierBytes,
              memory: cost.memoryKiB,
              passes: cost.passes,
            },
            (error, key) => {
              if (error) {
                reject(new CryptoFailure());
                return;
              }
              try {
                resolve(Uint8Array.from(key));
              } finally {
                key.fill(0);
              }
            },
          );
        } catch {
          reject(new CryptoFailure());
        }
      });
      if (signal?.aborted) {
        result.fill(0);
        throw new CryptoFailure();
      }
      return result;
    } finally {
      // An abandoned native operation retains this slot until its callback.
      active--;
      reservedMemoryKiB -= cost.memoryKiB;
      message.fill(0);
      nonce.fill(0);
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
      let expected: Uint8Array;
      try {
        expected = Uint8Array.from(verifier);
      } catch {
        throw new CryptoFailure();
      }
      let derived: Uint8Array | undefined;
      try {
        derived = await derive(password, salt, parameters, signal);
        return timingSafeEqual(derived, expected);
      } finally {
        derived?.fill(0);
        expected.fill(0);
      }
    },
  });
}

/** Bind one explicit standard policy to the Node provider before account use. */
export function createNodeStandardPasswordService(
  deployment: DeploymentConfig,
  policy: StandardPasswordPolicy,
  maxConcurrent: number,
  memoryBudgetKiB: number,
): StandardPasswordService {
  if (deployment?.tier !== 'standard') throw new CryptoFailure();
  const selected = snapshotStandardPasswordPolicy(policy);
  if (selected.maximum.memoryKiB > memoryBudgetKiB) throw new CryptoFailure();
  return createStandardPasswordService(
    createNodeArgon2idProvider(maxConcurrent, memoryBudgetKiB),
    selected,
  );
}
