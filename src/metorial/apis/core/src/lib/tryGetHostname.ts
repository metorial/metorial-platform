export let tryGetHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return 'unknown';
  }
};
