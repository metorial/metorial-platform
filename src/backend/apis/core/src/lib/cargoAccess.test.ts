import { describe, expect, it } from 'vitest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from './cargoAccess';

describe('cargoAccess', () => {
  it('treats consumer-only requests as consumer-scoped', () => {
    expect(
      hasInstanceConsumerAccess({
        consumerProfile: {
          consumer: {
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toBe(true);
  });

  it('keeps member requests on the member bypass path', () => {
    expect(
      hasInstanceConsumerAccess({
        member: {
          actor: {
            id: 'ora_1',
            name: 'Org Actor'
          }
        } as any,
        consumerProfile: {
          consumer: {
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toBe(false);
  });

  it('maps consumer requests to a consumer cargo actor', () => {
    expect(
      getInstanceCargoAccess({
        consumerProfile: {
          consumer: {
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toEqual({
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer',
        consumerId: 'con_1'
      }
    });
  });
});
