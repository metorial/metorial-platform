let url = `http://127.0.0.1:${process.env.SLATES_REGISTRY_PUBLIC_PORT ?? '52040'}`;
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (response.status >= 500) {
  throw new Error(`Slates registry returned ${response.status} from ${url}`);
}

console.log(`Slates registry is reachable at ${url} (${response.status})`);
