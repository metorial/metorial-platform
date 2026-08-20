let closedContext = (kind: string, values: readonly (string | number | bigint)[]) =>
  ['metorial', 'subspace', 'managed-oauth-secret', kind, ...values.map(String)]
    .map(value => `${Buffer.byteLength(value, 'utf8')}:${value}`)
    .join('|');

let managedSecretAadGrammar = {
  1: (kind: string, values: readonly (string | number | bigint)[]) =>
    closedContext(`${kind}/v1`, values),
  2: (kind: string, values: readonly (string | number | bigint)[]) =>
    closedContext(`${kind}/v2`, ['aad-v2', ...values])
} satisfies Record<number, (kind: string, values: readonly (string | number | bigint)[]) => string>;
let versionedManagedSecretContext = (
  aadVersion: number,
  kind: string,
  values: readonly (string | number | bigint)[]
) => {
  let grammar = managedSecretAadGrammar[aadVersion as keyof typeof managedSecretAadGrammar];
  if (!grammar) throw new Error(`Unsupported managed-secret AAD grammar: ${aadVersion}`);
  return grammar(kind, values);
};

/** Platform source AAD v1 has no invented tenant. It binds the platform owner,
 * concrete managed credential, provider, auth method, purpose, and version tuple. */
export let managedCredentialSourceContext = (d: {
  managedCredentialsId: string;
  providerId: string;
  providerAuthMethodId: string;
  purpose: string;
  secretVersion: number;
  encryptionKeyVersion: number;
  aadVersion: number;
}) =>
  versionedManagedSecretContext(d.aadVersion, 'platform-source', [
    'metorial_platform',
    d.managedCredentialsId,
    d.providerId,
    d.providerAuthMethodId,
    d.purpose,
    d.secretVersion,
    d.encryptionKeyVersion,
    d.aadVersion
  ]);

/** Tenant projection AAD v1 independently binds tenant, exact backing and tenant
 * credential, source identity/version, purpose, and its own envelope tuple. */
export let managedCredentialBackingContext = (d: {
  tenantId: string;
  managedCredentialsId: string;
  backingOid: bigint;
  providerAuthCredentialsId: string;
  sourceSecretId: string;
  sourceSecretVersion: number;
  purpose: string;
  secretVersion: number;
  encryptionKeyVersion: number;
  aadVersion: number;
}) =>
  versionedManagedSecretContext(d.aadVersion, 'tenant-backing', [
    d.tenantId,
    d.managedCredentialsId,
    d.backingOid,
    d.providerAuthCredentialsId,
    d.sourceSecretId,
    d.sourceSecretVersion,
    d.purpose,
    d.secretVersion,
    d.encryptionKeyVersion,
    d.aadVersion
  ]);
