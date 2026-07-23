let url = 'http://127.0.0.1:52160/ping';
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (!response.ok) {
  throw new Error(`Synthesis ping endpoint returned ${response.status} from ${url}`);
}

console.log(`Synthesis ping endpoint is reachable at ${url}`);
