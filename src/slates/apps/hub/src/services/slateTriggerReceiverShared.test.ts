import { describe, expect, it } from 'vitest';
import { isRoutableWebhookReceiverTrigger } from './slateTriggerReceiverShared';

describe('routable webhook receiver triggers', () => {
  it.each([
    ['active webhook', 'webhook', null, null, true],
    ['tombstoned webhook', 'webhook', new Date('2030-01-01T00:00:00.000Z'), null, false],
    ['ingress-disabled webhook', 'webhook', null, new Date('2030-01-01T00:00:00.000Z'), false],
    ['polling trigger', 'polling', null, null, false]
  ] as const)(
    '%s is routable: %s',
    (_name, source, tombstonedAt, ingressDisabledAt, expected) => {
      expect(
        isRoutableWebhookReceiverTrigger({
          source,
          tombstonedAt,
          ingressDisabledAt
        })
      ).toBe(expected);
    }
  );
});
