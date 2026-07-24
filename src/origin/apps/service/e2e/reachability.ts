let url = `http://127.0.0.1:${process.env.ORIGIN_API_PORT ?? '52090'}/metorial-origin`;
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (response.status >= 500) {
  throw new Error(`Origin returned ${response.status} from ${url}`);
}

console.log(`Origin is reachable at ${url} (${response.status})`);
