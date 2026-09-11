import { Service } from '@lowerdeck/service';
import { storeAccessService } from '@metorial/module-store';
import type { Context } from '@metorial/context';
import type { Document, ResourceActor } from '@metorial/db';
import { ID, withTransaction } from '@metorial/db';

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

  async ensureDocumentParticipant(d: {
    document: { oid: bigint };
    actor: { oid: bigint };
    mode: 'view' | 'edit';
  }) {
    return await this.upsertParticipant(d);
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

      for (let item of actorsById.values()) {
        await this.upsertParticipant({
          document: d.document,
          actor: item.actor,
          mode: item.mode
        });
      }
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
