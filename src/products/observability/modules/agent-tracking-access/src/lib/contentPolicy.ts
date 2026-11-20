// Keys Metorial issues allow everything, so the instance's content setting decides what is kept:
// agent tracking applies the stricter of the key's policy and the instance's.
export let issuedKeyContentPolicy = { defaultMode: 'full' as const };
