import type { Instance, Project, ResourceActor } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { productAssistantConversationParticipantService as service } from './participant';

let project = { oid: 1n } as Project;
let instance = { oid: 2n, projectOid: 1n } as Instance;
let owner = { oid: 10n, projectOid: 1n } as ResourceActor;
let other = { oid: 11n, projectOid: 1n } as ResourceActor;
let conversation = {
  id: 'conv',
  projectOid: 1n,
  instanceOid: 2n,
  createdByResourceActorOid: owner.oid
};

describe('productAssistantConversationParticipantService', () => {
  it('only grants access to the owning actor', () => {
    expect(
      service.hasConversationAccess({ project, instance, conversation, actor: owner })
    ).toBe(true);
    expect(
      service.hasConversationAccess({ project, instance, conversation, actor: other })
    ).toBe(false);
    expect(() =>
      service.assertConversationAccess({ project, instance, conversation, actor: other })
    ).toThrow();
  });

  it('rejects conversations from another instance', () => {
    expect(
      service.hasConversationAccess({
        project,
        instance,
        conversation: { ...conversation, instanceOid: 3n },
        actor: owner
      })
    ).toBe(false);
  });

  it('scopes queries to the owner only', () => {
    expect(service.ownerAccessWhere({ actor: owner })).toEqual({
      createdByResourceActorOid: owner.oid
    });
  });
});
