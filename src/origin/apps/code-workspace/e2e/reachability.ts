let url = 'http://127.0.0.1:3302';
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (!response.ok) {
  throw new Error(`Code workspace returned ${response.status} from ${url}`);
}

console.log(`Code workspace is reachable at ${url}`);
