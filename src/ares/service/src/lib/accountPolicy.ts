export let normalizeAccountDomain = (domain: string) => domain.trim().toLowerCase();

export let getInitialSsoTenantEnrollment = (enrollment: 'app' | 'account') =>
  enrollment == 'account' ? ('disabled' as const) : ('app' as const);

export let getAccountSsoClientId = (appClientId: string, accountClientId?: string | null) =>
  accountClientId ?? appClientId;

export let getAccountEmailAuthFlow = (
  hasAccount: boolean,
  eligibleConnectionCount: number
) => {
  if (!hasAccount || eligibleConnectionCount == 0) return 'email' as const;
  if (eligibleConnectionCount == 1) return 'sso_redirect' as const;
  return 'sso_selection' as const;
};

export let isSsoTenantAssignableToAccount = (d: {
  enrollment: 'app' | 'account' | 'disabled';
  accountOid: bigint | null;
  targetAccountOid?: bigint;
}) =>
  (d.enrollment == 'disabled' && d.accountOid == null) ||
  (d.enrollment == 'account' &&
    d.targetAccountOid != null &&
    d.accountOid == d.targetAccountOid);

export let doesAuthAttemptMatchClient = (d: {
  attemptAppOid: bigint;
  attemptAccountOid: bigint | null;
  clientAppOid: bigint;
  clientAccountOid: bigint | null;
}) => d.attemptAppOid == d.clientAppOid && d.attemptAccountOid == d.clientAccountOid;

export let isValidAccountDomain = (domain: string) => {
  if (!domain || domain.length > 253 || domain.includes('@') || /\s/.test(domain)) {
    return false;
  }

  return domain.split('.').every(label => {
    if (!label || label.length > 63) return false;
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label);
  });
};

export let isAccountDomainConnectionAllowed = (d: {
  tenantOid: bigint;
  connectionOid: bigint;
  allowedTenantOids: bigint[];
  allowedConnectionOids: bigint[];
}) => {
  if (d.allowedTenantOids.length === 0 && d.allowedConnectionOids.length === 0) {
    return true;
  }

  return (
    d.allowedTenantOids.includes(d.tenantOid) ||
    d.allowedConnectionOids.includes(d.connectionOid)
  );
};
