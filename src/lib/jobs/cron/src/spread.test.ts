import { describe, expect, it } from 'vitest';
import { spreadCronPattern } from './spread';

describe('spreadCronPattern', () => {
  it('moves a literal minute off the declared value', () => {
    let spread = spreadCronPattern('org/def-policy/rec/cron', '0 * * * *');

    expect(spread).toMatch(/^\d{1,2} \* \* \* \*$/);
  });

  it('is stable for the same name', () => {
    expect(spreadCronPattern('macc/cleanup', '0 0 * * *')).toBe(
      spreadCronPattern('macc/cleanup', '0 0 * * *')
    );
  });

  it('keeps the hour and the remaining fields', () => {
    expect(spreadCronPattern('fed/sub/reconcileAuditLogRetention/cron', '15 3 * * *')).toMatch(
      /^\d{1,2} 3 \* \* \*$/
    );
    expect(spreadCronPattern('sub/cht/cron/syncWorkspaces', '0 */12 * * *')).toMatch(
      /^\d{1,2} \*\/12 \* \* \*$/
    );
  });

  // Collapsing these onto a single minute would silently change how often they run.
  it.each(['* * * * *', '*/1 * * * *', '*/2 * * * *', '*/5 * * * *', '*/15 * * * *', '*/30 * * * *'])(
    'leaves %s untouched',
    pattern => {
      expect(spreadCronPattern('any/name', pattern)).toBe(pattern);
    }
  );

  it('leaves malformed and non-literal minute fields untouched', () => {
    expect(spreadCronPattern('any/name', '0 0 * *')).toBe('0 0 * *');
    expect(spreadCronPattern('any/name', '0,30 * * * *')).toBe('0,30 * * * *');
    expect(spreadCronPattern('any/name', '0-5 * * * *')).toBe('0-5 * * * *');
  });

  it('spreads a realistic set of hourly crons across many minutes', () => {
    let names = [
      'ares/sso/delegation/sync',
      'ares/sso/user/reconcile',
      'auditing/systemEvent/cleanup/cron',
      'cargo/doc/cleanup/cron',
      'cargo/file/expiration/cron',
      'cargo/fileUpload/cleanup/cron',
      'forge/wfl-cleanup',
      'horizon/padd/cleanup',
      'hyp/accountDomain/public-email-domains',
      'hyp/accountSso/delegation/cron',
      'hyp/hrzn/organization-sync/cron',
      'outp/instance/cleanup',
      'payment/sync',
      'shub/cleanup/cron',
      'shub/trg/evt/idempotencyKeyClear/1',
      'shub/trg/whk/sweep/cron/1',
      'shub/whk/globalCleanup/cron',
      'shut/con-log/offload/cron',
      'sub/auth/cron/reconcileConfigScopes',
      'sub/auth/cron/reconcileCredentialScopes'
    ];

    let minutes = names.map(name => spreadCronPattern(name, '0 * * * *').split(' ')[0]!);
    let perMinute = new Map<string, number>();
    for (let minute of minutes) perMinute.set(minute, (perMinute.get(minute) ?? 0) + 1);

    expect(Math.max(...perMinute.values())).toBeLessThanOrEqual(3);
  });
});
