import baseX from 'base-x';

// base62: 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ
// base62:  123456789abcdefghijk mnopqrstuvwxyzABCDEFGH JKLMN PQRSTUVWXYZ
// -> missing characters: 0, l, I, O

let internal = baseX('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

export let base62 = {
  encode: (input: string | Uint8Array) =>
    internal.encode(typeof input == 'string' ? new TextEncoder().encode(input) : input),
  decode: (input: string) => new TextDecoder().decode(internal.decode(input)),
  decodeRaw: (input: string) => internal.decode(input)
};
