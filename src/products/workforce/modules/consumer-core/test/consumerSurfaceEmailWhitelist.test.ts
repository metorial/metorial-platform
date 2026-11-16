import { describe, expect, it } from 'vitest';
import {
  isConsumerSurfaceEmailWhitelisted,
  normalizeConsumerSurfaceEmailWhitelist
} from '../src/lib/consumerSurfaceEmailWhitelist';

describe('consumerSurfaceEmailWhitelist', () => {
  it('normalizes exact emails, domains, and wildcard domains', () => {
    expect(
      normalizeConsumerSurfaceEmailWhitelist([
        ' Admin@Example.com ',
        '*@Example.com',
        'example.com'
      ])
    ).toEqual(['admin@example.com', 'example.com']);
  });

  it('matches exact email and domain entries', () => {
    let emailWhitelist = normalizeConsumerSurfaceEmailWhitelist([
      'admin@example.com',
      'team.metorial.dev'
    ]);

    expect(
      isConsumerSurfaceEmailWhitelisted({
        email: 'admin@example.com',
        emailWhitelist
      })
    ).toBe(true);
    expect(
      isConsumerSurfaceEmailWhitelisted({
        email: 'person@team.metorial.dev',
        emailWhitelist
      })
    ).toBe(true);
    expect(
      isConsumerSurfaceEmailWhitelisted({
        email: 'person@example.com',
        emailWhitelist
      })
    ).toBe(false);
  });

  it('rejects invalid whitelist inputs', () => {
    expect(() => normalizeConsumerSurfaceEmailWhitelist(['@example.com'])).toThrow(
      'Invalid consumer surface email whitelist entry'
    );
    expect(() => normalizeConsumerSurfaceEmailWhitelist(['foo@bar@baz.com'])).toThrow(
      'Invalid consumer surface email whitelist entry'
    );
  });
});
