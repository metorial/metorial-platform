import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import { db } from '@metorial/db';

export let documentFilePurposeSlug = 'document';
export let documentFilePurposeName = 'Document';
export let genericFilePurposeSlug = 'generic';
export let genericFilePurposeName = 'Generic';

class FilePurposeServiceImpl {
  async upsertFilePurpose(d: {
    input: {
      id?: string;
      slug: string;
      name: string;
      ownerType: 'user' | 'organization' | 'instance';
      canHaveLinks: boolean;
    };
  }) {
    if (!d.input.id) {
      let generated = getId('filePurpose');

      return await db.filePurpose.upsert({
        where: {
          slug: d.input.slug
        },
        create: {
          id: generated.id,
          slug: d.input.slug,
          name: d.input.name,
          ownerType: d.input.ownerType,
          canHaveLinks: d.input.canHaveLinks
        },
        update: {
          name: d.input.name,
          ownerType: d.input.ownerType,
          canHaveLinks: d.input.canHaveLinks
        }
      });
    }

    let existing = d.input.id
      ? await db.filePurpose.findFirst({
          where: {
            OR: [{ id: d.input.id }, { slug: d.input.slug }]
          }
        })
      : await db.filePurpose.findFirst({
          where: {
            slug: d.input.slug
          }
        });

    if (existing) {
      return await db.filePurpose.update({
        where: {
          id: existing.id
        },
        data: {
          slug: d.input.slug,
          name: d.input.name,
          ownerType: d.input.ownerType,
          canHaveLinks: d.input.canHaveLinks
        }
      });
    }

    let generated = getId('filePurpose');

    return await db.filePurpose.create({
      data: {
        id: d.input.id,
        slug: d.input.slug,
        name: d.input.name,
        ownerType: d.input.ownerType,
        canHaveLinks: d.input.canHaveLinks
      }
    });
  }

  async getFilePurposeById(d: { id: string }) {
    let purpose = await db.filePurpose.findFirst({
      where: {
        OR: [{ id: d.id }, { slug: d.id }]
      }
    });

    if (!purpose) throw new ServiceError(notFoundError('filePurpose', d.id));

    return purpose;
  }

  async listFilePurposes() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.filePurpose.findMany({
            ...opts
          })
      )
    );
  }

  async ensureDocumentFilePurpose() {
    return await this.upsertFilePurpose({
      input: {
        slug: documentFilePurposeSlug,
        name: documentFilePurposeName,
        ownerType: 'instance',
        canHaveLinks: true
      }
    });
  }

  async ensureGenericFilePurpose() {
    return await this.upsertFilePurpose({
      input: {
        slug: genericFilePurposeSlug,
        name: genericFilePurposeName,
        ownerType: 'instance',
        canHaveLinks: true
      }
    });
  }
}

export let filePurposeService = Service.create(
  'cargoFilePurposeService',
  () => new FilePurposeServiceImpl()
).build();
