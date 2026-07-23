let url = `http://127.0.0.1:${process.env.SUBSPACE_PUBLIC_PORT ?? '52071'}`;
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (response.status >= 500) {
  throw new Error(`Subspace public returned ${response.status} from ${url}`);
}

console.log(`Subspace public is reachable at ${url} (${response.status})`);
