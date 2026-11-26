import { readFileSync } from 'node:fs';

// The SSO database URL follows node-postgres, like every other database URL of an installation:
// sslmode=no-verify encrypts without verifying, and the other modes except disable verify the
// certificate, against sslrootcert when it's set. Bun's SQL client rejects no-verify and ignores
// sslrootcert, so both become TLS options here.
export let ssoSqlConnection = (url: string, sslFallback?: string) => {
  let parsed = new URL(url);
  let mode = parsed.searchParams.get('sslmode');
  let rootCert = parsed.searchParams.get('sslrootcert');

  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('sslrootcert');

  let tls = (() => {
    if (!mode) return sslFallback === 'true' ? { rejectUnauthorized: false } : false;
    if (mode == 'disable') return false;
    if (mode == 'no-verify') return { rejectUnauthorized: false };
    return rootCert ? { ca: readFileSync(rootCert, 'utf8') } : true;
  })();

  return { url: parsed.toString(), tls };
};
