import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';

let [command, name, path] = process.argv.slice(2);
let api = process.env.TURBO_API;
let team = process.env.TURBO_TEAM;
let token = process.env.TURBO_TOKEN;

if (!['get', 'put'].includes(command ?? '') || !name || !path) {
  console.error('Usage: bun blob.ts <get|put> <name> <file>');
  process.exit(2);
}

if (!api || !team || !token) {
  console.log('Warp Cache is not configured');
  process.exit(1);
}

let url = `${api}/v8/artifacts/${createHash('sha256').update(`blob:${name}`).digest('hex')}?teamId=${team}`;
let headers = { authorization: `Bearer ${token}` };

if (command === 'get') {
  let response = await fetch(url, { headers });
  if (response.status === 404) {
    console.log(`Warp blob miss: ${name}`);
    process.exit(1);
  }
  if (!response.ok || !response.body) {
    console.log(`Warp blob read failed: HTTP ${response.status}`);
    process.exit(1);
  }
  await Bun.write(path, response);
  console.log(`Warp blob hit: ${name} (${statSync(path).size} bytes)`);
} else {
  if (!existsSync(path)) {
    console.log(`Warp blob source missing: ${path}`);
    process.exit(1);
  }
  let response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'content-length': String(statSync(path).size) },
    body: Bun.file(path)
  });
  if (!response.ok) {
    console.log(`Warp blob write failed: HTTP ${response.status}`);
    process.exit(1);
  }
  console.log(`Warp blob stored: ${name} (${statSync(path).size} bytes)`);
}
