export let parseRedisUrl = (url: string) => {
  let u = new URL(url);
  let db = u.pathname.slice(1);

  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 6379,
    password: decodeURIComponent(u.password),
    db: db ? parseInt(db) : 0,
    tls: u.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
  };
};
