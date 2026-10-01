declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}

declare namespace Cloudflare {
  interface Env {
    TURNSTILE_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_HOSTNAME?: string;
  }
}

declare module 'libsodium-sumo' {
  interface RawSodium {
    HEAPU8: Uint8Array;
    _malloc(bytes: number): number;
    _free(pointer: number): void;
    _sodium_init(): number;
    _crypto_pwhash(
      output: number,
      outputLength: number,
      outputLengthHigh: number,
      password: number,
      passwordLength: number,
      passwordLengthHigh: number,
      salt: number,
      passes: number,
      passesHigh: number,
      memoryBytes: number,
      algorithm: number,
    ): number;
    _crypto_verify_32(left: number, right: number): number;
  }
  export default function sodiumFactory(options: {
    getRandomValue(): number;
    instantiateWasm(
      imports: WebAssembly.Imports,
      receive: (
        instance: WebAssembly.Instance,
        module: WebAssembly.Module,
      ) => void,
    ): WebAssembly.Exports;
  }): Promise<RawSodium>;
}
