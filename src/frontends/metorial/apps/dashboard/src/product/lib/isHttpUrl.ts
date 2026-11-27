export let isHttpUrl = (value: string) => {
  try {
    let { protocol } = new URL(value);

    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
