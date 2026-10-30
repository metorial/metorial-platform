export let once = <T>(factory: () => T) => {
  let cached: { value: T } | undefined;

  return () => (cached ??= { value: factory() }).value;
};
