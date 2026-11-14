import { normalizeEmail } from '@lowerdeck/normalize-email';
import { disposableEmailDomains as defaultDisposableEmailDomains } from './disposable';
import { getEmailDomain, matchesDomainSuffix } from './domain';
import { hasMxRecords } from './mx';

let EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let MAX_EMAIL_LENGTH = 254;

export type EmailDomainCheckFailureReason =
  | 'invalid'
  | 'blocked_domain'
  | 'disposable'
  | 'no_mx';

export type EmailDomainCheckResult =
  | { ok: true; email: string; normalizedEmail: string; domain: string }
  | { ok: false; reason: EmailDomainCheckFailureReason };

export let checkEmailDomain = async (
  email: string,
  opts: {
    blockedDomainSuffixes?: string[];
    checkDisposable?: boolean;
    checkMx?: boolean;
    disposableEmailDomains?: { isDisposable: (domain: string) => Promise<boolean> };
    hasMxRecords?: (domain: string) => Promise<boolean>;
  } = {}
): Promise<EmailDomainCheckResult> => {
  let trimmed = email.trim().toLowerCase();
  if (trimmed.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'invalid' };
  }

  let domain = getEmailDomain(trimmed);
  if (!domain || !domain.includes('.')) return { ok: false, reason: 'invalid' };

  if (opts.blockedDomainSuffixes && matchesDomainSuffix(domain, opts.blockedDomainSuffixes)) {
    return { ok: false, reason: 'blocked_domain' };
  }

  if (opts.checkDisposable ?? true) {
    let disposable = opts.disposableEmailDomains ?? defaultDisposableEmailDomains;
    if (await disposable.isDisposable(domain)) return { ok: false, reason: 'disposable' };
  }

  if (opts.checkMx ?? true) {
    let lookup = opts.hasMxRecords ?? hasMxRecords;
    if (!(await lookup(domain))) return { ok: false, reason: 'no_mx' };
  }

  return {
    ok: true,
    email: trimmed,
    normalizedEmail: normalizeEmail(trimmed),
    domain
  };
};
