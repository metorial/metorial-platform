import { describe, expect, it } from 'vitest';
import { RunLog, redactSecrets } from './runLog';

describe('RunLog', () => {
  it('prefixes entries with the elapsed time', () => {
    let log = new RunLog(Date.now() - 12_300);
    log.add('step 1');

    expect(log.toString()).toMatch(/^\[\+\s*12\.\ds\] step 1\n$/);
  });

  it('redacts secrets', () => {
    let log = new RunLog();
    log.add('Authorization: Bearer sk-live-123 and api_key=abc123');

    expect(log.toString()).not.toContain('sk-live-123');
    expect(log.toString()).not.toContain('abc123');
    expect(redactSecrets('token: hunter2')).toBe('token: [redacted]');
    expect(redactSecrets('"api_key": "abc"')).toBe('"api_key": "[redacted]"');
    expect(redactSecrets('uses an API-key method and token authentication')).toBe(
      'uses an API-key method and token authentication'
    );
  });

  it('stops growing once it hits the size limit', () => {
    let log = new RunLog();
    for (let i = 0; i < 2000; i++) log.add('x'.repeat(1000));
    log.add('after the limit');

    expect(log.toString().length).toBeLessThan(402_000);
    expect(log.toString()).toContain('[log truncated');
    expect(log.toString()).not.toContain('after the limit');
  });

  it('omits raw URLs from model and error messages', () => {
    let log = new RunLog();
    log.add('Could not fetch https://vendor.com/customer/alice?data=private');

    expect(log.toString()).toContain('[url omitted]');
    expect(log.toString()).not.toContain('alice');
    expect(log.toString()).not.toContain('private');
  });
});
