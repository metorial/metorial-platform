import { Service } from '@lowerdeck/service';
import { type CargoOwnerScope, cargoFileScope } from '@metorial/cargo-list-utils';
import { db } from '@metorial/db';
import { fileService } from './file';
import { fileLinkService } from './fileLink';
import { resourceActorPresentationInclude } from '@metorial/module-resource-tenant';
import { filePurposeService } from './filePurpose';
import { fileReferenceService } from './fileReference';

class ReconcileServiceImpl {
  private async reconcileReferencesForLink(
    d: CargoOwnerScope & {
      link: { oid: bigint };
      inputs: Array<{
        id?: string;
        entityType: string;
        entityId: string;
      }>;
    }
  ) {
    let { link, inputs, ...scope } = d;
    let references = [];

    for (let referenceInput of inputs) {
      references.push(
        await fileReferenceService.upsertFileReference({
          ...scope,
          fileLink: link as any,
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
        fileLink: { file: cargoFileScope(d) },
        fileLinkOid: link.oid,
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
    d: CargoOwnerScope & {
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
    let { inputs, ...scope } = d;
    let items = [];

    for (let input of inputs) {
      let file = await fileService.createFile({
        ...scope,
        purpose: input.purpose,
        storeId: input.storeId,
        input: {
          id: input.id,
          name: input.name,
          mimeType: input.mimeType,
          size: input.size,
          title: input.title,
          authorization: { type: 'privileged' }
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
            createdByResourceActor: {
              include: resourceActorPresentationInclude
            },
            purpose: true
          }
        });
      }

      let links = [];

      for (let linkInput of input.links ?? []) {
        let link = await fileLinkService.createFileLink({
          ...scope,
          file,
          input: {
            id: linkInput.id,
            key: linkInput.key,
            expiresAt: linkInput.expiresAt
          }
        });

        let references = await this.reconcileReferencesForLink({
          ...scope,
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
          file: cargoFileScope(d),
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
