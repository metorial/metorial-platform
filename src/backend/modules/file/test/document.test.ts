import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(factory => ({
      run: factory()
    }))
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/services/scope', () => ({
  resolveCargoScopeForOwner: vi.fn()
}));

vi.mock('../src/cargo', () => ({
  cargo: {
    actor: {
      upsert: vi.fn()
    },
    document: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      clone: vi.fn()
    },
    documentParticipant: {
      list: vi.fn(),
      get: vi.fn()
    },
    documentVersion: {
      list: vi.fn(),
      get: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationActor: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-consumer', () => ({
  consumerProfileService: {
    findConsumerProfilesByIdForInstance: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { consumerProfileService } from '@metorial/module-consumer';
import { cargo } from '../src/cargo';
import { documentService } from '../src/services/document';
import { documentParticipantService } from '../src/services/documentParticipant';
import { documentVersionService } from '../src/services/documentVersion';
import { resolveCargoScopeForOwner } from '../src/services/scope';

let owner = {
  type: 'instance' as const,
  organization: {
    id: 'org_1',
    oid: 11n
  },
  instance: {
    id: 'ins_1',
    oid: 22n
  }
};

let scope = {
  tenantId: 'ten_1',
  environmentId: 'env_1'
};

describe('file document services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCargoScopeForOwner).mockResolvedValue(scope as any);
  });

  it('upserts a cargo actor for member-backed document writes', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_1'
    } as any);
    vi.mocked(cargo.document.create).mockResolvedValue({
      id: 'doc_1'
    } as any);

    await documentService.createDocument({
      owner: owner as any,
      performedByMember: {
        organizationActorId: 'ora_1',
        name: 'Member Name'
      },
      input: {
        title: 'Notes',
        content: 'Hello'
      }
    });

    expect(cargo.actor.upsert).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      identifier: 'organization_actor:ora_1',
      name: 'Member Name',
      organizationActorId: 'ora_1',
      consumerProfileId: undefined
    });
    expect(cargo.document.create).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: undefined,
      title: 'Notes',
      content: 'Hello',
      actorId: 'act_1'
    });
  });

  it('maps cargo document pagination through the OSS service', async () => {
    vi.mocked(cargo.document.list).mockResolvedValue({
      items: [{ id: 'doc_1' }],
      pagination: {
        has_more_after: true,
        has_more_before: false
      }
    } as any);

    let paginator = await documentService.listDocuments({
      owner: owner as any
    });
    let result = await paginator.run({
      limit: 10
    } as any);

    expect(cargo.document.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      limit: 10
    });
    expect(result).toEqual({
      items: [{ id: 'doc_1' }],
      pagination: {
        hasNextPage: true,
        hasPreviousPage: false
      }
    });
  });

  it('forwards get, update, delete, and clone calls to cargo with scoped ids', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_2'
    } as any);
    vi.mocked(cargo.document.get).mockResolvedValue({
      id: 'doc_2'
    } as any);
    vi.mocked(cargo.document.update).mockResolvedValue({
      id: 'doc_2',
      title: 'Updated'
    } as any);
    vi.mocked(cargo.document.delete).mockResolvedValue({
      id: 'doc_2',
      status: 'deleted'
    } as any);
    vi.mocked(cargo.document.clone).mockResolvedValue({
      id: 'doc_3'
    } as any);

    await documentService.getDocumentById({
      owner: owner as any,
      documentId: 'doc_2',
      performedByMember: {
        organizationActorId: 'ora_2',
        name: 'Reader'
      }
    });
    await documentService.updateDocument({
      owner: owner as any,
      document: {
        id: 'doc_2'
      } as any,
      performedByMember: {
        organizationActorId: 'ora_2',
        name: 'Reader'
      },
      input: {
        title: 'Updated'
      }
    });
    await documentService.deleteDocument({
      owner: owner as any,
      document: {
        id: 'doc_2'
      } as any
    });
    await documentService.cloneDocument({
      owner: owner as any,
      document: {
        id: 'doc_2'
      } as any,
      input: {
        id: 'doc_3',
        title: 'Clone'
      }
    });

    expect(cargo.document.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: 'doc_2',
      actorId: 'act_2'
    });
    expect(cargo.document.update).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: 'doc_2',
      title: 'Updated',
      content: undefined,
      actorId: 'act_2'
    });
    expect(cargo.document.delete).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: 'doc_2'
    });
    expect(cargo.document.clone).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: 'doc_2',
      targetDocumentId: 'doc_3',
      title: 'Clone'
    });
  });

  it('enriches participants with native resources and keeps a cargo fallback name', async () => {
    let participantDate = new Date('2026-05-09T12:00:00.000Z');

    vi.mocked(db.organizationActor.findMany).mockResolvedValue([
      {
        id: 'ora_1',
        name: 'Organization Actor',
        organization: {
          id: 'org_1'
        },
        teams: []
      }
    ] as any);
    vi.mocked(consumerProfileService.findConsumerProfilesByIdForInstance).mockResolvedValue([
      {
        id: 'cpr_1',
        name: 'Consumer Profile',
        consumer: {
          id: 'con_1'
        },
        surface: {
          id: 'csf_1'
        },
        groups: [],
        instanceConsumer: null
      }
    ] as any);

    let participants = await documentParticipantService.enrichParticipants({
      owner: owner as any,
      participants: [
        {
          id: 'dpa_1',
          documentId: 'doc_1',
          role: 'editor',
          editCount: 3,
          lastEditedAt: participantDate,
          lastViewedAt: participantDate,
          createdAt: participantDate,
          actor: {
            name: 'Cargo Actor',
            organizationActorId: 'ora_1',
            consumerProfileId: 'cpr_1'
          }
        },
        {
          id: 'dpa_2',
          documentId: 'doc_1',
          role: 'viewer',
          editCount: 0,
          lastEditedAt: null,
          lastViewedAt: participantDate,
          createdAt: participantDate,
          actor: {
            name: 'Cargo Consumer',
            consumerProfileId: 'cpr_1'
          }
        },
        {
          id: 'dpa_3',
          documentId: 'doc_1',
          role: 'viewer',
          editCount: 0,
          lastEditedAt: null,
          lastViewedAt: participantDate,
          createdAt: participantDate,
          actor: {
            name: 'Fallback Cargo Name'
          }
        }
      ] as any
    });

    expect(participants[0]?.actor.name).toBe('Organization Actor');
    expect(participants[0]?.actor.organizationActor?.id).toBe('ora_1');
    expect(participants[0]?.actor.consumerProfile).toBeNull();
    expect(participants[1]?.actor.name).toBe('Consumer Profile');
    expect(participants[1]?.actor.organizationActor).toBeNull();
    expect(participants[1]?.actor.consumerProfile?.id).toBe('cpr_1');
    expect(participants[2]?.actor.name).toBe('Fallback Cargo Name');
    expect(participants[2]?.actor.organizationActor).toBeNull();
    expect(participants[2]?.actor.consumerProfile).toBeNull();
  });

  it('enriches version editors through the participant actor enricher', async () => {
    vi.spyOn(documentParticipantService, 'enrichActors').mockResolvedValue([
      {
        name: 'Editor Name',
        organizationActor: null,
        consumerProfile: null
      }
    ]);
    vi.mocked(cargo.documentVersion.get).mockResolvedValue({
      id: 'dvr_1',
      documentId: 'doc_1',
      versionNumber: 2,
      previousVersionId: 'dvr_0',
      listEditedAt: new Date('2026-05-09T13:00:00.000Z'),
      content: 'Updated',
      editors: [
        {
          name: 'Cargo Editor'
        }
      ],
      createdAt: new Date('2026-05-09T12:00:00.000Z')
    } as any);

    let version = await documentVersionService.getDocumentVersionById({
      owner: owner as any,
      documentVersionId: 'dvr_1'
    });

    expect(documentParticipantService.enrichActors).toHaveBeenCalledWith({
      owner,
      actors: [{ name: 'Cargo Editor' }]
    });
    expect(version.editors).toEqual([
      {
        name: 'Editor Name',
        organizationActor: null,
        consumerProfile: null
      }
    ]);
    expect(version.listEditedAt).toEqual(new Date('2026-05-09T13:00:00.000Z'));
  });

  it('maps nested participant and version lists through cargo pagination', async () => {
    vi.spyOn(documentParticipantService, 'enrichParticipants').mockResolvedValue([
      {
        id: 'dpa_1',
        actor: {
          name: 'Nested Participant',
          organizationActor: null,
          consumerProfile: null
        }
      }
    ] as any);
    vi.spyOn(documentParticipantService, 'enrichActors').mockResolvedValue([
      {
        name: 'Nested Editor',
        organizationActor: null,
        consumerProfile: null
      }
    ]);
    vi.mocked(cargo.documentParticipant.list).mockResolvedValue({
      items: [
        {
          id: 'dpa_1',
          actor: {
            name: 'Cargo Participant'
          }
        }
      ],
      pagination: {
        has_more_after: false,
        has_more_before: true
      }
    } as any);
    vi.mocked(cargo.documentVersion.list).mockResolvedValue({
      items: [
        {
          id: 'dvr_2',
          documentId: 'doc_1',
          versionNumber: 2,
          previousVersionId: 'dvr_1',
          listEditedAt: new Date('2026-05-09T13:00:00.000Z'),
          content: 'Version',
          editors: [
            {
              name: 'Cargo Editor'
            }
          ],
          createdAt: new Date('2026-05-09T12:00:00.000Z')
        }
      ],
      pagination: {
        has_more_after: true,
        has_more_before: false
      }
    } as any);

    let participantPaginator = await documentParticipantService.listDocumentParticipants({
      owner: owner as any,
      documentId: ['doc_1']
    });
    let versionPaginator = await documentVersionService.listDocumentVersions({
      owner: owner as any,
      documentId: ['doc_1']
    });

    let participantResult = await participantPaginator.run({
      limit: 5
    } as any);
    let versionResult = await versionPaginator.run({
      limit: 5
    } as any);

    expect(cargo.documentParticipant.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: ['doc_1'],
      limit: 5
    });
    expect(cargo.documentVersion.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      documentId: ['doc_1'],
      limit: 5
    });
    expect(participantResult.pagination).toEqual({
      hasNextPage: false,
      hasPreviousPage: true
    });
    expect(versionResult.pagination).toEqual({
      hasNextPage: true,
      hasPreviousPage: false
    });
    expect(versionResult.items[0]?.listEditedAt).toEqual(new Date('2026-05-09T13:00:00.000Z'));
  });
});
