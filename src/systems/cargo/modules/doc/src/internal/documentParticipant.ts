import { Service } from '@mtsrc/service';
import type { Document, TenantActor } from '@metorial-cargo/db';
import { getId, withTransaction } from '@metorial-cargo/db';
import { storeAccessService } from '@metorial-cargo/module-store';

class InternalDocumentParticipantServiceImpl {
  private async upsertParticipant(d: {
    document: { oid: bigint };
    actor: { oid: bigint };
    mode: 'view' | 'edit';
  }) {
    return await withTransaction(async db => {
      let now = new Date();

      let id = getId('documentParticipant');

      return await db.documentParticipant.upsert({
        where: {
          documentOid_tenantActorOid: {
            documentOid: d.document.oid,
            tenantActorOid: d.actor.oid
          }
        },
        create: {
          ...id,
          role: d.mode === 'edit' ? 'editor' : 'viewer',
          documentOid: d.document.oid,
          tenantActorOid: d.actor.oid,
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

      if (d.document.createdByTenantActorOid) {
        let creator = await client.tenantActor.findFirst({
          where: {
            oid: d.document.createdByTenantActorOid
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
          actor: TenantActor;
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
  }) {
    return await withTransaction(async db => {
      let existing = await db.documentVersionEditors.findFirst({
        where: {
          documentVersionOid: d.version.oid,
          tenantActorOid: d.actor.oid
        }
      });

      if (existing) return existing;

      let generated = getId('documentVersionEditor');

      await db.documentParticipant.updateMany({
        where: {
          documentOid: d.document.oid,
          tenantActorOid: d.actor.oid
        },
        data: {
          editCount: {
            increment: 1
          }
        }
      });

      return await db.documentVersionEditors.create({
        data: {
          ...generated,
          documentVersionOid: d.version.oid,
          tenantActorOid: d.actor.oid
        }
      });
    });
  }
}

export let internalDocumentParticipantService = Service.create(
  'cargoInternalDocumentParticipantService',
  () => new InternalDocumentParticipantServiceImpl()
).build();
