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
}) =>
  d.attemptAppOid == d.clientAppOid &&
  (d.clientAccountOid == null || d.attemptAccountOid == d.clientAccountOid);

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

export type SsoEmailDomainDenialReason =
  | 'invalid_domain'
  | 'domain_not_configured'
  | 'domain_other_account'
  | 'connection_not_allowed';

export type SsoEmailDomainDecision =
  | { allowed: true }
  | { allowed: false; reason: SsoEmailDomainDenialReason };

export let evaluateSsoEmailDomain = (d: {
  domain: string;
  tenantOid: bigint;
  connectionOid: bigint;
  accountOid: bigint | null;
  accountDomain: {
    accountOid: bigint;
    allowedTenantOids: bigint[];
    allowedConnectionOids: bigint[];
  } | null;
}): SsoEmailDomainDecision => {
  if (!isValidAccountDomain(d.domain)) {
    return { allowed: false, reason: 'invalid_domain' };
  }

  if (d.accountOid == null) {
    if (!d.accountDomain) return { allowed: true };
    return { allowed: false, reason: 'domain_other_account' };
  }

  if (!d.accountDomain) {
    return { allowed: false, reason: 'domain_not_configured' };
  }

  if (d.accountDomain.accountOid != d.accountOid) {
    return { allowed: false, reason: 'domain_other_account' };
  }

  if (
    !isAccountDomainConnectionAllowed({
      tenantOid: d.tenantOid,
      connectionOid: d.connectionOid,
      allowedTenantOids: d.accountDomain.allowedTenantOids,
      allowedConnectionOids: d.accountDomain.allowedConnectionOids
    })
  ) {
    return { allowed: false, reason: 'connection_not_allowed' };
  }

  return { allowed: true };
};
