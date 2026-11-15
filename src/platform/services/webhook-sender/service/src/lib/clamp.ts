export let clamp = (
  num: number,
  opts: {
    min: number;
    max: number;
  }
) => {
  return Math.max(Math.min(num, opts.max), opts.min);
};
