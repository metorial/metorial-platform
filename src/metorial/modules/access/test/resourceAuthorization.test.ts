import { describe, expect, it } from 'vitest';
import { createResourceAuthorization } from '../src/services/resourceAuthorization';

let restrictedInput = {
  restricted: true as const,
  project: { oid: 1n },
  instance: { oid: 3n, projectOid: 1n },
  consumerProfile: { oid: 4n, instanceOid: 3n },
  resourceActor: {
    oid: 5n,
    projectOid: 1n,
    consumerProfileOid: 4n
  } as any,
  accessTags: [{ accessTagOid: 6n }] as any
};

describe('resource authorization', () => {
  it('accepts a restricted profile within its own instance', () => {
    expect(createResourceAuthorization(restrictedInput)).toEqual({
      type: 'restricted',
      resourceActor: restrictedInput.resourceActor,
      accessTags: restrictedInput.accessTags
    });
  });

  it('rejects an instance from a sibling project', () => {
    expect(() =>
      createResourceAuthorization({
        ...restrictedInput,
        instance: { oid: 3n, projectOid: 999n }
      })
    ).toThrow('does not match the selected instance scope');
  });

  it('rejects a profile from a sibling instance', () => {
    expect(() =>
      createResourceAuthorization({
        ...restrictedInput,
        consumerProfile: { oid: 4n, instanceOid: 999n }
      })
    ).toThrow('does not match the selected instance scope');
  });

  it('rejects an actor from a sibling project', () => {
    expect(() =>
      createResourceAuthorization({
        ...restrictedInput,
        resourceActor: { oid: 5n, projectOid: 999n, consumerProfileOid: 4n } as any
      })
    ).toThrow('does not match the selected instance scope');
  });

  it('rejects consumer-only actors', () => {
    expect(() =>
      createResourceAuthorization({
        restricted: false,
        resourceActor: {
          consumerOid: 4n,
          consumerProfileOid: null
        } as any
      })
    ).toThrow('must be linked to a consumer profile');
  });
});
