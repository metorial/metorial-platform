import { Service } from '@lowerdeck/service';
import { storeAccessService, storeParticipantService } from '@metorial/module-store';
import type { Context } from '@metorial/context';
import type { Document, ResourceActor } from '@metorial/db';
import { addAwaitedAfterTransactionHook, ID, withTransaction } from '@metorial/db';

class InternalDocumentParticipantServiceImpl {
  private async upsertParticipant(d: {
    document: { oid: bigint };
    actor: { oid: bigint };
    mode: 'view' | 'edit';
  }) {
    return await withTransaction(async db => {
      let now = new Date();

      return await db.documentParticipant.upsert({
        where: {
          documentOid_resourceActorOid: {
            documentOid: d.document.oid,
            resourceActorOid: d.actor.oid
          }
        },
        create: {
          id: await ID.generateId('documentParticipant'),
          role: d.mode === 'edit' ? 'editor' : 'viewer',
          documentOid: d.document.oid,
          resourceActorOid: d.actor.oid,
          lastViewedAt: now,
          lastEditedAt: d.mode === 'edit' ? now : undefined
        },
        update: {
          role: d.mode === 'edit' ? 'editor' : undefined,
          lastViewedAt: now,
          lastEditedAt: d.mode === 'edit' ? now : undefined
        }
      });
    });
  }

  private async recordStoreParticipation(d: {
    document: { oid: bigint; fileOid: bigint };
    actor: { oid: bigint };
    documentParticipant: { oid: bigint };
    mode: 'view' | 'edit';
    activeAt?: Date;
    createdAt?: Date;
  }) {
    let storeOids = await storeAccessService.listRelevantStoreOidsForDocument({
      document: d.document
    });

    let linkedParticipantOid: bigint | undefined;
    for (let storeOid of storeOids) {
      let participant = await storeParticipantService.recordParticipation({
        store: { oid: storeOid },
        actor: d.actor,
        roles: [d.mode === 'edit' ? 'editor' : 'viewer'],
        activeAt: d.activeAt,
        createdAt: d.createdAt
      });
      linkedParticipantOid ??= participant?.oid;
    }

    if (!linkedParticipantOid) return;

    await withTransaction(
      async db =>
        await db.documentParticipant.update({
          where: { oid: d.documentParticipant.oid },
          data: { storeParticipantOid: linkedParticipantOid }
        })
    );
  }

  private async linkStoreParticipant(d: {
    document: { oid: bigint; fileOid: bigint };
    actor: { oid: bigint };
    documentParticipant: { oid: bigint; storeParticipantOid: bigint | null };
  }) {
    if (d.documentParticipant.storeParticipantOid) return;

    let storeOids = await storeAccessService.listRelevantStoreOidsForDocument({
      document: d.document
    });

    for (let storeOid of storeOids) {
      let storeParticipantOid = await storeParticipantService.findStoreParticipantForActor({
        store: { oid: storeOid },
        actor: d.actor
      });
      if (!storeParticipantOid) continue;

      await withTransaction(
        async db =>
          await db.documentParticipant.update({
            where: { oid: d.documentParticipant.oid },
            data: { storeParticipantOid }
          })
      );
      return;
    }
  }

  async syncStoreParticipant(d: { documentParticipantId: string }) {
    let participant = await withTransaction(
      async db =>
        await db.documentParticipant.findUnique({
          where: { id: d.documentParticipantId },
          include: { document: { select: { oid: true, fileOid: true } } }
        }),
      { ifExists: true }
    );
    if (!participant || participant.storeParticipantOid) return;

    await this.recordStoreParticipation({
      document: participant.document,
      actor: { oid: participant.resourceActorOid },
      documentParticipant: participant,
      mode: participant.role == 'editor' ? 'edit' : 'view',
      activeAt: participant.lastEditedAt ?? participant.lastViewedAt ?? participant.createdAt,
      createdAt: participant.createdAt
    });
  }

  async ensureDocumentParticipant(d: {
    document: { oid: bigint; fileOid: bigint };
    actor: { oid: bigint };
    mode: 'view' | 'edit';
  }) {
    let participant = await this.upsertParticipant(d);

    await addAwaitedAfterTransactionHook(async () => {
      try {
        await this.recordStoreParticipation({ ...d, documentParticipant: participant });
      } catch (error) {
        console.error('Failed to record document store participation', error);
      }
    });

    return participant;
  }

  async materializeDocumentParticipantsFromStores(d: { document: Document }) {
    return await withTransaction(async client => {
      let storeActors = await storeAccessService.listStoreParticipantActorsForDocument({
        document: d.document
      });

      if (d.document.createdByResourceActorOid) {
        let creator = await client.resourceActor.findFirst({
          where: {
            oid: d.document.createdByResourceActorOid
          }
        });

        if (creator) {
          storeActors.push({
            actor: creator,
            mode: 'edit'
          });
        }
      }

      let actorsById = new Map<
        bigint,
        {
          actor: ResourceActor;
          mode: 'view' | 'edit';
        }
      >();

      for (let item of storeActors) {
        let existing = actorsById.get(item.actor.oid);
        if (existing?.mode === 'edit') continue;

        actorsById.set(item.actor.oid, {
          actor: item.actor,
          mode: item.mode === 'edit' ? 'edit' : 'view'
        });
      }

      let materialized = [];
      for (let item of actorsById.values()) {
        let participant = await this.upsertParticipant({
          document: d.document,
          actor: item.actor,
          mode: item.mode
        });
        materialized.push({ actor: item.actor, participant });
      }

      await addAwaitedAfterTransactionHook(async () => {
        try {
          for (let item of materialized) {
            await this.linkStoreParticipant({
              document: d.document,
              actor: item.actor,
              documentParticipant: item.participant
            });
          }
        } catch (error) {
          console.error('Failed to link document store participants', error);
        }
      });
    });
  }

  async ensureVersionEditor(d: {
    version: { oid: bigint };
    document: { oid: bigint };
    actor: { oid: bigint };
    context?: Context;
  }) {
    return await withTransaction(async db => {
      let existing = await db.documentVersionEditors.findFirst({
        where: {
          documentVersionOid: d.version.oid,
          resourceActorOid: d.actor.oid
        }
      });

      if (existing) return existing;

      await db.documentParticipant.updateMany({
        where: {
          documentOid: d.document.oid,
          resourceActorOid: d.actor.oid
        },
        data: {
          editCount: {
            increment: 1
          }
        }
      });

      return await db.documentVersionEditors.create({
        data: {
          id: await ID.generateId('documentVersionEditor'),
          documentVersionOid: d.version.oid,
          resourceActorOid: d.actor.oid,
          ip: d.context?.ip ?? null,
          ua: d.context?.ua ?? null
        }
      });
    });
  }
}

export let internalDocumentParticipantService = Service.create(
  'cargoInternalDocumentParticipantService',
  () => new InternalDocumentParticipantServiceImpl()
).build();
