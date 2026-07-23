let url = 'http://127.0.0.1:52110/metorial-relay';
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (response.status >= 500) {
  throw new Error(`Relay returned ${response.status} from ${url}`);
}

console.log(`Relay is reachable at ${url} (${response.status})`);
