import { canonicalize } from '@lowerdeck/canonicalize';

let sameObject = (a: unknown, b: unknown) =>
  canonicalize(a ?? null) === canonicalize(b ?? null);

export let hasMaterialIntegrationProviderChange = (d: {
  currentVersion:
    | {
        deploymentOid: bigint;
        authMethodOid: bigint | null;
        authCredentialsOid: bigint | null;
        configOid: bigint | null;
        toolFilter: unknown;
      }
    | null
    | undefined;
  input: {
    deploymentOid?: bigint;
    authMethodOid?: bigint | null;
    authCredentialsOid?: bigint | null;
    configOid?: bigint | null;
    toolFilter?: unknown;
  };
}) => {
  if (!d.currentVersion) return true;

  if (d.input.deploymentOid && d.input.deploymentOid !== d.currentVersion.deploymentOid)
    return true;
  if (
    d.input.authMethodOid !== undefined &&
    (d.input.authMethodOid ?? null) !== d.currentVersion.authMethodOid
  )
    return true;
  if (
    d.input.authCredentialsOid !== undefined &&
    (d.input.authCredentialsOid ?? null) !== d.currentVersion.authCredentialsOid
  )
    return true;
  if (
    d.input.configOid !== undefined &&
    (d.input.configOid ?? null) !== d.currentVersion.configOid
  )
    return true;

  if (
    d.input.toolFilter !== undefined &&
    !sameObject(d.input.toolFilter, d.currentVersion.toolFilter)
  )
    return true;

  return false;
};
