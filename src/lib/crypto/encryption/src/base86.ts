import baseX from 'base-x';

let internal = baseX(
  '!#$%()*+-.0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~§'
);

export let base86 = {
  encode: (input: string | Uint8Array) =>
    internal.encode(typeof input == 'string' ? new TextEncoder().encode(input) : input),
  decode: (input: string) => internal.decode(input)
};
