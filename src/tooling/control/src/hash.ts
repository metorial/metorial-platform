let mask = (1n << 64n) - 1n;

let rotate = (value: bigint, bits: bigint) =>
  ((value << bits) | (value >> (64n - bits))) & mask;

export let sipHash13 = (bytes: Uint8Array): bigint => {
  let state = [
    0x736f6d6570736575n,
    0x646f72616e646f6dn,
    0x6c7967656e657261n,
    0x7465646279746573n
  ];
  let round = () => {
    state[0] = (state[0]! + state[1]!) & mask;
    state[1] = rotate(state[1]!, 13n) ^ state[0]!;
    state[0] = rotate(state[0]!, 32n);

    state[2] = (state[2]! + state[3]!) & mask;
    state[3] = rotate(state[3]!, 16n) ^ state[2]!;
    state[0] = (state[0]! + state[3]!) & mask;
    state[3] = rotate(state[3]!, 21n) ^ state[0]!;

    state[2] = (state[2]! + state[1]!) & mask;
    state[1] = rotate(state[1]!, 17n) ^ state[2]!;
    state[2] = rotate(state[2]!, 32n);
  };
  let block = (value: bigint) => {
    state[3] = state[3]! ^ value;
    round();
    state[0] = state[0]! ^ value;
  };
  let offset = 0;

  for (; offset + 8 <= bytes.length; offset += 8) {
    let value = 0n;

    for (let index = 0; index < 8; index++)
      value |= BigInt(bytes[offset + index]!) << BigInt(index * 8);
    block(value);
  }

  let tail = BigInt(bytes.length & 255) << 56n;

  for (let index = 0; offset + index < bytes.length; index++)
    tail |= BigInt(bytes[offset + index]!) << BigInt(index * 8);
  block(tail);
  state[2] = state[2]! ^ 255n;

  for (let index = 0; index < 3; index++) round();

  return state[0]! ^ state[1]! ^ state[2]! ^ state[3]!;
};

let usize = (value: bigint) => {
  let bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);

  return bytes;
};

export let rustString = (value: string) =>
  Buffer.concat([Buffer.from(value), Buffer.from([255])]);

export let rustBytes = (value: Uint8Array) =>
  Buffer.concat([usize(BigInt(value.length)), value]);

export let rustHash = (...values: Uint8Array[]) =>
  sipHash13(Buffer.concat(values)).toString(16).padStart(16, '0');

export let shortHash = (value: string) => rustHash(rustString(value)).slice(-12);

// Preserve Rust 1.91 Path::hash so existing Compose projects and volumes retain their identity.
export let rustPathHash = (path: string) => {
  let bytes = Buffer.from(path);
  let chunks: Uint8Array[] = [];
  let start = 0;
  let bits = 0n;

  let add = (chunk: Uint8Array) => {
    bits = rotate((bits + BigInt(chunk.length)) & mask, 62n);
    chunks.push(chunk);
  };

  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index] !== 47) continue;

    if (index > start) add(bytes.subarray(start, index));
    start = index + 1;

    if (bytes[start] === 46 && (start + 1 === bytes.length || bytes[start + 1] === 47))
      start++;
  }

  if (start < bytes.length) add(bytes.subarray(start));

  return rustHash(...chunks, usize(bits));
};
