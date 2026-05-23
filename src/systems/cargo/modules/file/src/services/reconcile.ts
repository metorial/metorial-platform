import { Service } from '@mtsrc/service';
import { db } from '@metorial-cargo/db';
import { fileService } from './file';
import { fileLinkService } from './fileLink';
import type { CargoTenantEnvironment } from './filePurpose';
import { filePurposeService } from './filePurpose';
import { fileReferenceService } from './fileReference';

class ReconcileServiceImpl {
  private async reconcileReferencesForLink(
    d: CargoTenantEnvironment & {
      link: { oid: bigint };
      inputs: Array<{
        id?: string;
        entityType: string;
        entityId: string;
      }>;
    }
  ) {
    let references = [];

    for (let referenceInput of d.inputs) {
      references.push(
        await fileReferenceService.upsertFileReference({
          tenant: d.tenant,
          environment: d.environment,
          fileLink: d.link as any,
          input: {
            id: referenceInput.id,
            entityType: referenceInput.entityType,
            entityId: referenceInput.entityId
          }
        })
      );
    }

    await db.fileReference.deleteMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        fileLinkOid: d.link.oid,
        id: {
          notIn: references.map(reference => reference.id)
        }
      }
    });

    return references;
  }

  async reconcilePurposes(d: {
    inputs: Array<{
      id?: string;
      slug: string;
      name: string;
      ownerType: 'user' | 'organization' | 'instance';
      canHaveLinks: boolean;
    }>;
  }) {
    let items = [];

    for (let input of d.inputs) {
      items.push(
        await filePurposeService.upsertFilePurpose({
          input
        })
      );
    }

    return items;
  }

  async reconcileFiles(
    d: CargoTenantEnvironment & {
      inputs: Array<{
        id: string;
        storeId: string;
        purpose: string;
        name: string;
        mimeType: string;
        size: number;
        title?: string;
        status?: 'active' | 'deleted';
        links?: Array<{
          id?: string;
          key: string;
          expiresAt?: Date;
          references?: Array<{
            id?: string;
            entityType: string;
            entityId: string;
          }>;
        }>;
      }>;
    }
  ) {
    let items = [];

    for (let input of d.inputs) {
      let file = await fileService.createFile({
        tenant: d.tenant,
        environment: d.environment,
        purpose: input.purpose,
        storeId: input.storeId,
        input: {
          id: input.id,
          name: input.name,
          mimeType: input.mimeType,
          size: input.size,
          title: input.title
        }
      });

      if (input.status === 'deleted' && file.status !== 'deleted') {
        file = await db.file.update({
          where: {
            id: file.id
          },
          data: {
            status: 'deleted'
          },
          include: {
            document: {
              select: {
                id: true
              }
            },
            createdByTenantActor: true,
            purpose: true,
            tenant: true,
            environment: true
          }
        });
      }

      let links = [];

      for (let linkInput of input.links ?? []) {
        let link = await fileLinkService.createFileLink({
          tenant: d.tenant,
          environment: d.environment,
          file,
          input: {
            id: linkInput.id,
            key: linkInput.key,
            expiresAt: linkInput.expiresAt
          }
        });

        let references = await this.reconcileReferencesForLink({
          tenant: d.tenant,
          environment: d.environment,
          link,
          inputs: linkInput.references ?? []
        });

        links.push({
          link,
          references
        });
      }

      await db.fileLink.deleteMany({
        where: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          fileOid: file.oid,
          id: {
            notIn: links.map(linkItem => linkItem.link.id)
          }
        }
      });

      items.push({
        file,
        links
      });
    }

    return items;
  }
}

export let reconcileService = Service.create(
  'cargoReconcileService',
  () => new ReconcileServiceImpl()
).build();
