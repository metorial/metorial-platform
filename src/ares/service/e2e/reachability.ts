let url = 'http://127.0.0.1:52120';
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (response.status >= 500) {
  throw new Error(`Ares auth returned ${response.status} from ${url}`);
}

console.log(`Ares auth is reachable at ${url} (${response.status})`);
