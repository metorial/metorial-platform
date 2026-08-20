import { describe, expect, it } from 'vitest';
import { toEventBase } from './eventBase';

describe('Subspace callback lifecycle event boundary', () => {
  it('separates callback input from the instance and performing actor', () => {
    let instance = { id: 'instance-1' };
    let organizationActor = { id: 'actor-1' };

    expect(
      toEventBase({
        instance,
        organizationActor,
        callbackId: 'callback-1',
        webhookSecret: 'classified-value'
      })
    ).toEqual({
      instance,
      organizationActor,
      input: {
        callbackId: 'callback-1',
        webhookSecret: 'classified-value'
      }
    });
  });

  it('does not duplicate callback context fields inside event input', () => {
    let result = toEventBase({
      instance: { id: 'instance-1' },
      organizationActor: { id: 'actor-1' },
      callbackId: 'callback-1'
    });

    expect(result.input).not.toHaveProperty('instance');
    expect(result.input).not.toHaveProperty('organizationActor');
  });
});
