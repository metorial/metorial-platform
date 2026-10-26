export let randomBigInt = () => {
  let array = new Uint32Array(2);
  crypto.getRandomValues(array);
  return (BigInt(array[0] & 0x7fffffff) << 32n) | BigInt(array[1]);
};
