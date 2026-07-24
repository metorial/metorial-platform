import { createConnection } from 'node:net';

let redisUrl = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0');

await new Promise<void>((resolve, reject) => {
  let socket = createConnection({
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379)
  });
  let timeout = setTimeout(() => {
    socket.destroy();
    reject(new Error(`Timed out connecting to Redis at ${redisUrl.host}`));
  }, 10_000);

  socket.once('error', reject);
  socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'));
  socket.once('data', data => {
    clearTimeout(timeout);
    socket.end();
    if (!data.toString().startsWith('+PONG')) {
      reject(new Error(`Redis at ${redisUrl.host} did not answer PING`));
      return;
    }
    resolve();
  });
});

console.log(`Subspace worker dependency Redis is reachable at ${redisUrl.host}`);
