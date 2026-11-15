// Runs inside the harness container as root (see run.sh). Function code runs as uid 1501 and
// iptables only lets that uid reach the proxy ports, the way a Lambda in the deflector VPC can
// only leave through the proxy. Proxies and the log store run as uid 1500.

import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import path from 'node:path';

let require = createRequire(import.meta.url);
let grpc = require('@grpc/grpc-js');

let inputDir = '/input';
let outDir = '/out';
let runDir = '/harness/run';
let proxyUid = 1500;
let functionUid = 1501;

let deflectorSecret = crypto.randomBytes(32).toString('hex');
let logsSecret = crypto.randomBytes(32).toString('hex');
let ports = {
  deflector: 18080,
  gateway: 28080,
  gatewayMetrics: 29090,
  gatewayOnPrem: 38080,
  gatewayOnPremMetrics: 39090,
  logsRpc: 52250,
  logsIngest: 52210,
  logsQuery: 52211
};

let targets = {
  allowed: { ip: '93.184.216.34', public: true },
  other: { ip: '93.184.216.35', public: true },
  internal: { ip: '10.20.0.5', public: false },
  metadata: { ip: '169.254.169.254', public: false },
  loopback: { ip: '127.0.0.1', public: false }
};

let requests = [
  { id: 'http allowed', kind: 'http', url: 'http://allowed.test/', target: 'allowed' },
  { id: 'https allowed', kind: 'https', url: 'https://allowed.test/', target: 'allowed' },
  { id: 'fetch http allowed', kind: 'fetch', url: 'http://allowed.test/', target: 'allowed' },
  {
    id: 'fetch https allowed',
    kind: 'fetch',
    url: 'https://allowed.test/',
    target: 'allowed'
  },
  { id: 'grpc allowed', kind: 'grpc', url: 'allowed.test:50051', target: 'allowed' },
  { id: 'http other', kind: 'http', url: 'http://other.test/', target: 'other' },
  { id: 'https other', kind: 'https', url: 'https://other.test/', target: 'other' },
  { id: 'fetch https other', kind: 'fetch', url: 'https://other.test/', target: 'other' },
  { id: 'http internal', kind: 'http', url: 'http://internal.test/', target: 'internal' },
  { id: 'https internal', kind: 'https', url: 'https://internal.test/', target: 'internal' },
  {
    id: 'fetch https internal',
    kind: 'fetch',
    url: 'https://internal.test/',
    target: 'internal'
  },
  {
    id: 'http metadata host',
    kind: 'http',
    url: 'http://metadata.test/latest/meta-data/',
    target: 'metadata'
  },
  {
    id: 'http metadata ip',
    kind: 'http',
    url: 'http://169.254.169.254/latest/meta-data/',
    target: 'metadata'
  },
  {
    id: 'fetch http metadata host',
    kind: 'fetch',
    url: 'http://metadata.test/latest/meta-data/',
    target: 'metadata'
  },
  { id: 'http loopback host', kind: 'http', url: 'http://loopback.test/', target: 'loopback' },
  {
    id: 'https loopback host',
    kind: 'https',
    url: 'https://loopback.test/',
    target: 'loopback'
  }
];

let entries = list => ({
  deflector: { egressPolicy: { direction: 'egress', entries: list } },
  gateway: { policy: { entries: list } }
});

let scenarios = [
  {
    name: 'default',
    description: 'no egress policy (public internet only)',
    deflector: {},
    gateway: {}
  },
  {
    name: 'unrestricted',
    description: 'entries 0.0.0.0/0 and ::/0',
    ...entries([{ cidr: '0.0.0.0/0' }, { cidr: '::/0' }])
  },
  {
    name: 'explicit',
    description: 'entry 93.184.216.34/32',
    ...entries([{ cidr: '93.184.216.34/32' }])
  },
  {
    name: 'explicitPort',
    description: 'entry 93.184.216.34/32 port 443',
    ...entries([{ cidr: '93.184.216.34/32', portRange: { from: 443, to: 443 } }])
  },
  {
    name: 'internalEntry',
    description: 'entry 10.20.0.0/16',
    ...entries([{ cidr: '10.20.0.0/16' }])
  },
  { name: 'emptyPolicy', description: 'policy with no entries', ...entries([]) },
  {
    name: 'legacyFallback',
    description: 'deflector legacyFallback token vs gateway allowAll grant',
    deflector: { legacyFallback: true },
    gateway: { allowAll: true }
  }
];

let run = (command, args) =>
  execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let b64url = value => Buffer.from(value).toString('base64url');

let setupNetwork = () => {
  for (let target of Object.values(targets)) {
    if (target.ip != '127.0.0.1') run('ip', ['addr', 'add', `${target.ip}/32`, 'dev', 'lo']);
  }
  fs.appendFileSync(
    '/etc/hosts',
    Object.entries(targets)
      .map(([name, target]) => `${target.ip} ${name}.test\n`)
      .join('')
  );

  let owner = ['-m', 'owner', '--uid-owner', String(functionUid)];
  for (let port of [ports.deflector, ports.gateway, ports.gatewayOnPrem]) {
    run('iptables', [
      '-A',
      'OUTPUT',
      ...owner,
      '-p',
      'tcp',
      '-d',
      '127.0.0.1',
      '--dport',
      String(port),
      '-j',
      'ACCEPT'
    ]);
  }
  run('iptables', [
    '-A',
    'OUTPUT',
    ...owner,
    '-p',
    'tcp',
    '-j',
    'REJECT',
    '--reject-with',
    'tcp-reset'
  ]);
  run('iptables', ['-A', 'OUTPUT', ...owner, '-p', 'udp', '-j', 'REJECT']);
};

let setupCertificates = () => {
  let dir = path.join(runDir, 'tls');
  fs.mkdirSync(dir, { recursive: true });
  let file = name => path.join(dir, name);
  let ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes'];
  run('openssl', [
    'req',
    '-x509',
    ...ec,
    '-keyout',
    file('ca.key'),
    '-out',
    file('ca.crt'),
    '-days',
    '2',
    '-subj',
    '/CN=differential-ca'
  ]);
  run('openssl', [
    'req',
    ...ec,
    '-keyout',
    file('leaf.key'),
    '-out',
    file('leaf.csr'),
    '-subj',
    '/CN=allowed.test'
  ]);
  fs.writeFileSync(
    file('leaf.ext'),
    `subjectAltName=${Object.keys(targets)
      .map(name => `DNS:${name}.test`)
      .join(',')},IP:169.254.169.254\n`
  );
  run('openssl', [
    'x509',
    '-req',
    '-in',
    file('leaf.csr'),
    '-CA',
    file('ca.crt'),
    '-CAkey',
    file('ca.key'),
    '-CAcreateserial',
    '-out',
    file('leaf.crt'),
    '-days',
    '2',
    '-extfile',
    file('leaf.ext')
  ]);
  fs.chmodSync(dir, 0o755);
  fs.chmodSync(file('ca.crt'), 0o644);
  return {
    ca: file('ca.crt'),
    cert: fs.readFileSync(file('leaf.crt')),
    key: fs.readFileSync(file('leaf.key'))
  };
};

let listen = (server, host, port) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

let startTargets = async tls => {
  for (let [name, target] of Object.entries(targets)) {
    let handler = (request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain', connection: 'close' });
      response.end(`target:${name}`);
    };
    await listen(http.createServer(handler), target.ip, 80);
    await listen(
      https.createServer({ cert: tls.cert, key: tls.key }, handler),
      target.ip,
      443
    );
  }

  let identity = buffer => buffer;
  let server = new grpc.Server();
  server.addService(
    {
      ping: {
        path: '/differential.Echo/Ping',
        requestStream: false,
        responseStream: false,
        requestSerialize: identity,
        requestDeserialize: identity,
        responseSerialize: identity,
        responseDeserialize: identity
      }
    },
    { ping: (call, callback) => callback(null, Buffer.from('target:allowed')) }
  );
  await new Promise((resolve, reject) =>
    server.bindAsync(
      `${targets.allowed.ip}:50051`,
      grpc.ServerCredentials.createInsecure(),
      error => (error ? reject(error) : resolve())
    )
  );
};

let children = [];

let startProcess = (name, binary, env) => {
  let log = fs.openSync(path.join(outDir, 'logs', `${name}.log`), 'w');
  let child = spawn(path.join(inputDir, 'bin', binary), [], {
    uid: proxyUid,
    gid: proxyUid,
    env: { PATH: process.env.PATH, ...env },
    stdio: ['ignore', log, log]
  });
  child.on('exit', code => {
    if (!child.stopping) console.error(`${name} exited with ${code}; see logs/${name}.log`);
  });
  children.push(child);
};

let waitHealthy = async (name, url) => {
  let deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      let response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${name} did not become healthy at ${url}`);
};

let { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
let publicKeyRaw = publicKey.export({ format: 'jwk' }).x;
let kid = crypto
  .createHash('sha256')
  .update(Buffer.from(publicKeyRaw, 'base64url'))
  .digest('hex')
  .slice(0, 16);

let gatewayEnv = (proxyPort, metricsPort, allowInternal) => ({
  EGRESS_GATEWAY_TUNNEL_ADDR: 'off',
  EGRESS_GATEWAY_PROXY_ADDR: `127.0.0.1:${proxyPort}`,
  EGRESS_GATEWAY_METRICS_ADDR: `127.0.0.1:${metricsPort}`,
  EGRESS_GRANT_PUBLIC_KEYS: JSON.stringify({ keys: { [kid]: publicKeyRaw } }),
  ALLOW_INTERNAL_DESTINATIONS: String(allowInternal),
  EGRESS_DENY_OWN_ADDRESSES: 'false',
  NETWORK_LOGS_URL: `http://127.0.0.1:${ports.logsRpc}/rpc`,
  NETWORK_LOGS_RPC_SECRET: logsSecret,
  EGRESS_OBSERVATION_FLUSH_INTERVAL_SECONDS: '1'
});

let startServices = async () => {
  fs.mkdirSync(path.join(outDir, 'logs'), { recursive: true });

  startProcess('network-logs', 'network-logs', {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PORT: '5432',
    DATABASE_NAME: 'network_logs',
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_SSLMODE: 'disable',
    NETWORK_LOGS_RPC_ADDR: `127.0.0.1:${ports.logsRpc}`,
    OBSERVER_INGEST_ADDR: `127.0.0.1:${ports.logsIngest}`,
    OBSERVER_QUERY_ADDR: `127.0.0.1:${ports.logsQuery}`,
    NETWORK_LOGS_RPC_SECRET: logsSecret
  });
  await waitHealthy('network-logs', `http://127.0.0.1:${ports.logsRpc}/healthz`);

  startProcess('deflector', 'deflector', {
    DEFLECTOR_ADDR: `127.0.0.1:${ports.deflector}`,
    DEFLECTOR_JWT_SECRET: deflectorSecret,
    OBSERVER_INGEST_URL: `http://127.0.0.1:${ports.logsIngest}/ingest`,
    OBSERVER_FLUSH_INTERVAL_SECONDS: '1'
  });
  startProcess(
    'egress-gateway',
    'egress-gateway',
    gatewayEnv(ports.gateway, ports.gatewayMetrics, false)
  );
  startProcess(
    'egress-gateway-onprem',
    'egress-gateway',
    gatewayEnv(ports.gatewayOnPrem, ports.gatewayOnPremMetrics, true)
  );

  await waitHealthy('deflector', `http://127.0.0.1:${ports.deflector}/healthz`);
  await waitHealthy('egress-gateway', `http://127.0.0.1:${ports.gatewayMetrics}/healthz`);
  await waitHealthy(
    'egress-gateway-onprem',
    `http://127.0.0.1:${ports.gatewayOnPremMetrics}/healthz`
  );
};

let signHS256 = claims => {
  let signingInput = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  return `${signingInput}.${crypto.createHmac('sha256', deflectorSecret).update(signingInput).digest('base64url')}`;
};

let signEdDSA = claims => {
  let signingInput = `${b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid }))}.${b64url(JSON.stringify(claims))}`;
  return `${signingInput}.${crypto.sign(null, Buffer.from(signingInput), privateKey).toString('base64url')}`;
};

let identity = (tenantId, commit, scenario) => ({
  tenantId,
  functionId: `fn.${commit}.${scenario.name}`,
  functionVersionId: `fnv.${commit}.${scenario.name}`
});

let proxies = {
  deflector: {
    url: `http://127.0.0.1:${ports.deflector}`,
    tenantId: 'ten_deflector',
    token: (commit, scenario) => {
      let now = Math.floor(Date.now() / 1000);
      let base = { aud: 'deflector', iat: now, nbf: now - 30 };
      if (scenario.deflector.legacyFallback)
        return signHS256({ ...base, legacyFallback: true, exp: now + 7 * 86400 });
      let ids = identity('ten_deflector', commit, scenario);
      return signHS256({
        ...base,
        sub: ids.functionVersionId,
        ...ids,
        jti: crypto.randomUUID(),
        exp: now + 300,
        ...scenario.deflector
      });
    }
  },
  gateway: {
    url: `http://127.0.0.1:${ports.gateway}`,
    tenantId: 'ten_gateway',
    token: (commit, scenario) => egressGrant('ten_gateway', commit, scenario)
  },
  gatewayOnPrem: {
    url: `http://127.0.0.1:${ports.gatewayOnPrem}`,
    tenantId: 'ten_gateway_onprem',
    token: (commit, scenario) => egressGrant('ten_gateway_onprem', commit, scenario)
  }
};

let egressGrant = (tenantId, commit, scenario) => {
  let now = Math.floor(Date.now() / 1000);
  return signEdDSA({
    iss: 'function-bay',
    aud: 'metorial-egress',
    jti: `inv_${crypto.randomUUID()}`,
    ...identity(tenantId, commit, scenario),
    source: 'lambda',
    iat: now,
    nbf: now,
    exp: now + 300,
    ...scenario.gateway
  });
};

let prepareWrappers = () => {
  let manifest = JSON.parse(
    fs.readFileSync(path.join(inputDir, 'wrappers', 'manifest.json'), 'utf8')
  );
  for (let version of manifest) {
    let dir = path.join(runDir, 'wrappers', version.commit);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(
      path.join(inputDir, 'wrappers', version.commit, version.wrapper),
      path.join(dir, version.wrapper)
    );
    fs.copyFileSync('/harness/case.cjs', path.join(dir, 'index.js'));
    version.wrapperPath = path.join(dir, version.wrapper);
  }
  fs.mkdirSync(path.join(runDir, 'events'), { recursive: true });
  return manifest;
};

let invoke = (version, scenario, proxyName, caFile) =>
  new Promise(resolve => {
    let proxy = proxies[proxyName];
    let eventFile = path.join(
      runDir,
      'events',
      `${version.commit}.${scenario.name}.${proxyName}.json`
    );
    fs.writeFileSync(
      eventFile,
      JSON.stringify({
        requests,
        __functionBay: {
          deflector: { proxyUrl: proxy.url, token: proxy.token(version.commit, scenario) }
        }
      })
    );
    fs.chmodSync(eventFile, 0o644);

    let child = spawn('node', ['/harness/case.cjs', version.wrapperPath, eventFile], {
      uid: functionUid,
      gid: functionUid,
      cwd: path.dirname(version.wrapperPath),
      env: { PATH: process.env.PATH, HOME: '/tmp', NODE_EXTRA_CA_CERTS: caFile },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    let timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
    child.on('exit', () => {
      clearTimeout(timer);
      try {
        resolve({ ...JSON.parse(stdout), stderr });
      } catch {
        resolve({ crashed: { error: 'no_output', message: stderr.slice(-2000) } });
      }
    });
  });

let summarize = (request, result) => {
  if (!result) return 'missing';
  if (result.status == 200 && result.body == `target:${request.target}`) return 'reached';
  if (result.status !== undefined) return `http ${result.status}: ${result.body}`;
  return `error ${result.error}: ${result.message}`;
};

let reached = summary => summary == 'reached';

let rpc = async (method, payload) => {
  let body = JSON.stringify(payload);
  let pathAndQuery = `/rpc/${method}`;
  let timestamp = Date.now();
  let signature = crypto
    .createHmac('sha256', logsSecret)
    .update(`v1\n${timestamp}\nPOST\n${pathAndQuery}\n${body}`)
    .digest('hex');
  let response = await fetch(`http://127.0.0.1:${ports.logsRpc}${pathAndQuery}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/rpc+json',
      'metorial-rpc-signature': `t=${timestamp},v1=${signature}`
    },
    body
  });
  let json = await response.json();
  if (!response.ok)
    throw new Error(`${method} failed: ${response.status} ${JSON.stringify(json)}`);
  return json.records ?? json.data?.records ?? [];
};

let observationKey = record => `${record.hostname} ${record.ip}:${record.port}`;

let collectObservations = async () => {
  let byProxy = {};
  for (let [name, proxy] of Object.entries(proxies)) {
    let records = await rpc('observation:list', { tenantId: proxy.tenantId });
    let grouped = {};
    for (let record of records) {
      let entry = (grouped[record.functionId] ??= { allowed: {}, denied: {} });
      let bucket = entry[record.decision];
      bucket[observationKey(record)] = (bucket[observationKey(record)] ?? 0) + record.count;
    }
    byProxy[name] = grouped;
  }
  return byProxy;
};

let main = async () => {
  fs.mkdirSync(runDir, { recursive: true });
  setupNetwork();
  let tls = setupCertificates();
  await startTargets(tls);
  await startServices();
  let versions = prepareWrappers();

  let cases = [];
  for (let version of versions) {
    for (let scenario of scenarios) {
      let outputs = {};
      for (let proxyName of Object.keys(proxies))
        outputs[proxyName] = await invoke(version, scenario, proxyName, tls.ca);
      cases.push({ version, scenario, outputs });
      console.error(`ran ${version.commit} ${scenario.name}`);
    }
  }

  await sleep(5000);
  let observations = await collectObservations();

  let unexpected = [];
  let intended = [];
  let onPremDifferences = [];
  let rows = [];

  for (let { version, scenario, outputs } of cases) {
    for (let [proxyName, output] of Object.entries(outputs)) {
      if (output.crashed)
        unexpected.push({
          commit: version.commit,
          scenario: scenario.name,
          proxy: proxyName,
          crashed: output.crashed
        });
    }

    let resultFor = (proxyName, request) =>
      (outputs[proxyName].results ?? []).find(result => result.id == request.id);
    for (let request of requests) {
      let deflector = summarize(request, resultFor('deflector', request));
      let gateway = summarize(request, resultFor('gateway', request));
      let gatewayOnPrem = summarize(request, resultFor('gatewayOnPrem', request));
      let row = {
        commit: version.commit,
        scenario: scenario.name,
        request: request.id,
        deflector,
        gateway,
        gatewayOnPrem
      };
      rows.push(row);

      if (deflector != gateway) {
        if (!targets[request.target].public && reached(deflector) && !reached(gateway))
          intended.push(row);
        else unexpected.push(row);
      }

      let onPremMayOpen = request.target == 'internal' && scenario.name == 'internalEntry';
      if (gatewayOnPrem != gateway && !(onPremMayOpen && reached(gatewayOnPrem)))
        onPremDifferences.push(row);
    }

    let functionId = `fn.${version.commit}.${scenario.name}`;
    let allowedKeys = proxyName =>
      Object.keys(observations[proxyName][functionId]?.allowed ?? {}).sort();
    let deflectorKeys = allowedKeys('deflector');
    let gatewayKeys = allowedKeys('gateway');
    if (scenario.deflector.legacyFallback) continue;
    let missing = deflectorKeys.filter(key => !gatewayKeys.includes(key));
    let extra = gatewayKeys.filter(key => !deflectorKeys.includes(key));
    let nonPublic = key =>
      Object.values(targets).some(target => !target.public && key.includes(` ${target.ip}:`));
    if (missing.some(key => !nonPublic(key)) || extra.length > 0) {
      unexpected.push({
        commit: version.commit,
        scenario: scenario.name,
        observations: { missing, extra }
      });
    } else if (missing.length > 0) {
      intended.push({
        commit: version.commit,
        scenario: scenario.name,
        observationsOnlyInDeflector: missing
      });
    }
  }

  let report = {
    versions: versions.map(({ wrapperPath, ...version }) => version),
    scenarios: scenarios.map(({ name, description }) => ({ name, description })),
    requests,
    rows,
    observations,
    intended,
    unexpected,
    onPremDifferences
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(report));
  console.log(renderMarkdown(report));

  for (let child of children) {
    child.stopping = true;
    child.kill('SIGTERM');
  }
  process.exit(unexpected.length > 0 ? 1 : 0);
};

let renderMarkdown = report => {
  let lines = ['# Egress differential: deflector vs egress gateway', ''];
  lines.push(
    `Wrappers: ${report.versions.map(version => `${version.commit} (${version.date})`).join(', ')}`,
    ''
  );
  lines.push(
    `Cases: ${report.rows.length}, intended differences: ${report.intended.length}, unexpected: ${report.unexpected.length}`,
    ''
  );

  let byVersionDifference = {};
  for (let row of report.rows) {
    let key = `${row.scenario} | ${row.request} | ${row.deflector} | ${row.gateway} | ${row.gatewayOnPrem}`;
    (byVersionDifference[key] ??= []).push(row.commit);
  }

  lines.push(
    '## Verdicts',
    '',
    '| scenario | request | deflector | gateway (cloud) | gateway (on-prem) | wrappers |',
    '|---|---|---|---|---|---|'
  );
  for (let [key, commits] of Object.entries(byVersionDifference)) {
    let all = commits.length == report.versions.length ? 'all' : commits.join(', ');
    lines.push(`| ${key.replaceAll('|', '\\|').replaceAll(' \\| ', ' | ')} | ${all} |`);
  }

  lines.push('', '## Unexpected differences', '');
  if (report.unexpected.length == 0) lines.push('None.');
  for (let entry of report.unexpected) lines.push(`- \`${JSON.stringify(entry)}\``);

  lines.push(
    '',
    '## Gateway cloud vs on-prem differences beyond internalEntry → internal',
    ''
  );
  if (report.onPremDifferences.length == 0) lines.push('None.');
  for (let entry of report.onPremDifferences) lines.push(`- \`${JSON.stringify(entry)}\``);

  lines.push(
    '',
    '## Observations (allowed / denied keys per function, summed over wrappers)',
    ''
  );
  for (let [proxyName, grouped] of Object.entries(report.observations)) {
    let allowed = {};
    let denied = {};
    for (let entry of Object.values(grouped)) {
      for (let key of Object.keys(entry.allowed)) allowed[key] = (allowed[key] ?? 0) + 1;
      for (let key of Object.keys(entry.denied)) denied[key] = (denied[key] ?? 0) + 1;
    }
    lines.push(
      `- ${proxyName}: allowed ${JSON.stringify(allowed)}, denied ${JSON.stringify(denied)}`
    );
  }
  return lines.join('\n') + '\n';
};

main().catch(error => {
  console.error(error);
  for (let child of children) child.kill('SIGKILL');
  process.exit(2);
});
