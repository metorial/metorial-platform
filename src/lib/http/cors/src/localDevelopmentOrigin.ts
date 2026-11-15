let localHostnames = ['localhost', '127.0.0.1', '[::1]'];

export let isLocalhostOrigin = (origin: string | null | undefined) => {
  if (!origin) return false;

  try {
    let url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    let hostname = url.hostname.toLowerCase();
    return localHostnames.includes(hostname) || hostname.endsWith('.localhost');
  } catch {
    return false;
  }
};

export let isLocalDevelopmentOrigin = (origin: string | null | undefined) =>
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  isLocalhostOrigin(origin);
