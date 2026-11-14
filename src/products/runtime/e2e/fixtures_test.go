package e2e

// probeFunction is one CommonJS handler with an operation per scenario, so the suite needs few
// cold starts. Every result is plain JSON; network errors come back as values, not throws.
const probeFunction = `
const net = require('node:net');
const dns = require('node:dns');
const fs = require('node:fs');
const os = require('node:os');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const describe = err => String(err?.cause?.code || err?.cause?.message || err?.code || err?.message || err);

const connect = (host, port) => new Promise(resolve => {
  const socket = net.connect({ host, port });
  const done = result => { socket.destroy(); resolve(result); };
  socket.setTimeout(8000, () => done({ ok: false, error: 'timeout' }));
  socket.once('connect', () => done({ ok: true }));
  socket.once('error', err => done({ ok: false, error: describe(err) }));
});

const rawConnect = (host, port) => new Promise(resolve => {
  let binding;
  try {
    binding = process.binding('tcp_wrap');
  } catch (err) {
    return resolve({ ok: false, error: 'binding unavailable: ' + err.message });
  }
  const { TCP, TCPConnectWrap, constants } = binding;
  const handle = new TCP(constants.SOCKET);
  const timer = setTimeout(() => { handle.close(); resolve({ ok: false, error: 'timeout' }); }, 6000);
  const req = new TCPConnectWrap();
  req.oncomplete = status => { clearTimeout(timer); handle.close(); resolve(status === 0 ? { ok: true } : { ok: false, error: 'status ' + status }); };
  req.address = host;
  req.port = port;
  const err = handle.connect(req, host, port);
  if (err) { clearTimeout(timer); handle.close(); resolve({ ok: false, error: 'connect ' + err }); }
});

const ops = {
  echo: async p => {
    console.log('echo ' + JSON.stringify(p.value));
    console.error('to stderr');
    process.stdout.write('raw stdout write\n');
    return { value: p.value, greeting: process.env.GREETING, host: os.hostname(), pid: process.pid };
  },
  sleep: async p => {
    const startedAt = Date.now();
    await sleep(p.ms);
    return { host: os.hostname(), pid: process.pid, startedAt, endedAt: Date.now() };
  },
  log: async p => {
    const line = 'x'.repeat(p.lineBytes);
    for (let i = 0; i < p.lines; i++) console.log(i + ':' + line);
    return { logged: p.lines };
  },
  fetch: async p => {
    try {
      const res = await fetch(p.url, { signal: AbortSignal.timeout(15000) });
      await res.arrayBuffer();
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, error: describe(err) };
    }
  },
  connect: p => connect(p.host, p.port),
  raw: p => rawConnect(p.host, p.port),
  lookup: p => new Promise(resolve =>
    dns.lookup(p.host, { all: true }, (err, addresses) =>
      resolve(err ? { ok: false, error: describe(err) } : { ok: true, addresses: addresses.map(a => a.address) }))),
  resolve: p => dns.promises.resolve4(p.host).then(a => ({ ok: true, addresses: a }), err => ({ ok: false, error: describe(err) })),
  env: async () => ({ keys: Object.keys(process.env).sort() }),
  files: async () => ({
    token: fs.existsSync('/var/run/metorial/identity/token'),
    rootWritable: (() => { try { fs.writeFileSync('/probe', 'x'); return true; } catch { return false; } })(),
    uid: process.getuid()
  }),
  throw: async () => { throw new Error('handler exploded'); },
  crash: async () => { setImmediate(() => { throw new Error('uncaught crash'); }); await sleep(1000); return 'unreachable'; }
};

exports.handler = async payload => ops[payload.op](payload);
`

const esmFunction = `
export default async payload => ({ esm: true, value: payload.value });
`

const envelopedFunction = `
exports.handler = async event => {
  console.log('enveloped got ' + typeof event.payload);
  return { statusCode: 201, body: { result: { enveloped: event.payload } } };
};
`

const bootErrorFunction = `
console.log('about to fail');
throw new Error('boom at boot');
`
