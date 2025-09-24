export let parseRedisUrl = (url: string) => {
  let u = new URL(url);

  return {
    host: u.hostname,
    port: parseInt(u.port),
    password: u.password,
    db: parseInt(u.pathname.slice(1)),

    tls: u.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
  };
};
