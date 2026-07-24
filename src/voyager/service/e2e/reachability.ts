let url = `http://127.0.0.1:${process.env.VOYAGER_PORT ?? '52060'}/metorial-voyager`;
let response = await fetch(url, {
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000)
});

if (response.status >= 500) {
  throw new Error(`Voyager returned ${response.status} from ${url}`);
}

console.log(`Voyager is reachable at ${url} (${response.status})`);
