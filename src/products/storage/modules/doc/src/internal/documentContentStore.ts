import { Service } from '@lowerdeck/service';
import type { Prisma } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import type { DocumentBody } from '@metorial/docs-editor-schema';

type StoredDocumentContent = {
  content: string;
  annotations: PrismaJson.DocumentAnnotations | null;
};

type DocumentStoreSource = {
  id: string;
  oid: bigint;
  isContentOwner: boolean;
  parentDocumentOid: bigint | null;
  file: {
    id: string;
    storeId: string;
  };
};

let effectiveDocumentStoreSelect = {
  id: true,
  oid: true,
  isContentOwner: true,
  parentDocumentOid: true,
  file: {
    select: {
      id: true,
      storeId: true
    }
  }
} satisfies Prisma.DocumentSelect;

class InternalDocumentContentStoreServiceImpl {
  async createContent(body: DocumentBody) {
    return await withTransaction(
      async db =>
        await db.documentContent.create({
          data: {
            content: body.content,
            annotations: body.annotations
          }
        })
    );
  }

  async updateContent(d: { oid: bigint; body: DocumentBody }) {
    return await withTransaction(
      async db =>
        await db.documentContent.update({
          where: {
            oid: d.oid
          },
          data: {
            content: d.body.content,
            annotations: d.body.annotations
          }
        })
    );
  }

  async copyContent(source: StoredDocumentContent) {
    return await withTransaction(
      async db =>
        await db.documentContent.create({
          data: {
            content: source.content,
            annotations: source.annotations ?? undefined
          }
        })
    );
  }

  async replaceAnnotationsIfContentUnchanged(d: { oid: bigint; body: DocumentBody }) {
    let result = await withTransaction(
      async db =>
        await db.documentContent.updateMany({
          where: {
            oid: d.oid,
            content: d.body.content
          },
          data: {
            annotations: d.body.annotations
          }
        })
    );

    return result.count > 0;
  }

  async getEffectiveDocumentStoreSource(
    document: DocumentStoreSource
  ): Promise<DocumentStoreSource> {
    return await withTransaction(
      async db => {
        let resolved = document;

        while (!resolved.isContentOwner && resolved.parentDocumentOid) {
          let parent = await db.document.findFirst({
            where: {
              oid: resolved.parentDocumentOid,
              file: {
                status: 'active'
              }
            },
            select: effectiveDocumentStoreSelect
          });

          if (!parent) {
            return resolved;
          }

          resolved = parent;
        }

        return resolved;
      },
      { ifExists: true }
    );
  }

  async getEffectiveDocumentStoreSourceByDocumentId(
    documentId: string
  ): Promise<DocumentStoreSource | null> {
    return await withTransaction(
      async db => {
        let document = await db.document.findFirst({
          where: {
            id: documentId,
            file: {
              status: 'active'
            }
          },
          select: effectiveDocumentStoreSelect
        });

        if (!document) return null;

        return await this.getEffectiveDocumentStoreSource(document);
      },
      { ifExists: true }
    );
  }
}

export let internalDocumentContentStoreService = Service.create(
  'cargoInternalDocumentContentStoreService',
  () => new InternalDocumentContentStoreServiceImpl()
).build();
