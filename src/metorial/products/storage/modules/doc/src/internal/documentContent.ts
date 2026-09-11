import { Service } from '@lowerdeck/service';
import type { Context } from '@metorial/context';
import type { Instance, Prisma, Project, ResourceActor } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import { documentInclude } from '../services/document';
import { type DocumentDraft } from './documentDraft';
import { internalDocumentParticipantService } from './documentParticipant';
import { internalDocumentVersioningService } from './documentVersioning';

type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;

let getTextByteSize = (content: string) => new TextEncoder().encode(content).length;

class InternalDocumentContentServiceImpl {
  private async getParentLiveContent(
    document: Pick<DocumentRecord, 'isContentOwner' | 'parentDocumentOid'>
  ) {
    return await withTransaction(
      async db => {
        if (!document.parentDocumentOid) {
          return null;
        }

        return await db.document.findFirst({
          where: {
            oid: document.parentDocumentOid,
            file: {
              status: 'active'
            }
          },
          select: {
            contentOid: true,
            content: {
              select: {
                content: true
              }
            }
          }
        });
      },
      { ifExists: true }
    );
  }

  async getParentSyncState(d: {
    document: Pick<DocumentRecord, 'isContentOwner' | 'parentDocumentOid'>;
    nextContent: string;
  }) {
    let parentLiveContent = await this.getParentLiveContent(d.document);
    let shouldKeepParentSync =
      !d.document.isContentOwner &&
      !!parentLiveContent &&
      parentLiveContent.content.content === d.nextContent;

    return {
      parentLiveContent,
      shouldKeepParentSync
    };
  }

  private async writeDocumentContent(d: {
    project: Project;
    instance: Instance;
    document: DocumentRecord;
    nextContent: string;
    listEditedAt?: Date;
  }) {
    return await withTransaction(async db => {
      let now = new Date();
      let shouldCreateNewVersion =
        await internalDocumentVersioningService.shouldCreateNewVersionForWrite(
          d.document,
          now
        );

      let liveContentOid = d.document.contentOid;
      let activeVersion = d.document.currentVersion;
      let didCreateVersion = false;
      let { parentLiveContent, shouldKeepParentSync } = await this.getParentSyncState({
        document: d.document,
        nextContent: d.nextContent
      });
      let hasLinkedChildContentConsumers = d.document.isContentOwner
        ? (await db.document.count({
            where: {
              parentDocumentOid: d.document.oid,
              isContentOwner: false,
              contentOid: d.document.contentOid,
              file: {
                status: 'active'
              }
            }
          })) > 0
        : false;
      let shouldDetachOwnedContent =
        d.document.isContentOwner &&
        ((!!parentLiveContent && parentLiveContent.contentOid === d.document.contentOid) ||
          hasLinkedChildContentConsumers);

      if (shouldCreateNewVersion && shouldKeepParentSync && d.document.currentVersion) {
        liveContentOid = parentLiveContent!.contentOid;
        activeVersion = await db.documentVersion.update({
          where: {
            id: d.document.currentVersion.id
          },
          data: {
            contentOid: liveContentOid,
            listEditedAt: d.listEditedAt
          },
          include: {
            content: true
          }
        });
      } else if (shouldCreateNewVersion) {
        if (d.document.currentVersion) {
          let retiredContent = await db.documentContent.create({
            data: {
              content: d.document.content.content
            }
          });

          await db.documentVersion.update({
            where: {
              id: d.document.currentVersion.id
            },
            data: {
              contentOid: retiredContent.oid
            }
          });
        }

        if (d.document.isContentOwner) {
          if (shouldDetachOwnedContent) {
            let liveContent = await db.documentContent.create({
              data: {
                content: d.nextContent
              }
            });

            liveContentOid = liveContent.oid;
          } else {
            await db.documentContent.update({
              where: {
                oid: d.document.contentOid
              },
              data: {
                content: d.nextContent
              }
            });
          }
        } else if (shouldKeepParentSync) {
          liveContentOid = parentLiveContent!.contentOid;
        } else {
          let liveContent = await db.documentContent.create({
            data: {
              content: d.nextContent
            }
          });

          liveContentOid = liveContent.oid;
        }

        activeVersion = await internalDocumentVersioningService.createVersion({
          project: d.project,
          instance: d.instance,
          document: d.document,
          contentOid: liveContentOid,
          previousVersion: d.document.currentVersion,
          listEditedAt: d.listEditedAt
        });
        didCreateVersion = true;
      } else if (d.document.isContentOwner) {
        if (shouldDetachOwnedContent) {
          let liveContent = await db.documentContent.create({
            data: {
              content: d.nextContent
            }
          });

          liveContentOid = liveContent.oid;

          if (!d.document.currentVersion) {
            activeVersion = await internalDocumentVersioningService.createVersion({
              project: d.project,
              instance: d.instance,
              document: d.document,
              contentOid: liveContentOid,
              listEditedAt: d.listEditedAt
            });

            didCreateVersion = true;
          } else {
            activeVersion = await db.documentVersion.update({
              where: {
                id: d.document.currentVersion.id
              },
              data: {
                contentOid: liveContentOid,
                listEditedAt: d.listEditedAt
              },
              include: {
                content: true
              }
            });
          }
        } else {
          await db.documentContent.update({
            where: {
              oid: d.document.contentOid
            },
            data: {
              content: d.nextContent
            }
          });
        }
      } else if (shouldKeepParentSync) {
        liveContentOid = parentLiveContent!.contentOid;

        if (!d.document.currentVersion) {
          activeVersion = await internalDocumentVersioningService.createVersion({
            project: d.project,
            instance: d.instance,
            document: d.document,
            contentOid: liveContentOid,
            listEditedAt: d.listEditedAt
          });

          didCreateVersion = true;
        } else {
          activeVersion = await db.documentVersion.update({
            where: {
              id: d.document.currentVersion.id
            },
            data: {
              contentOid: liveContentOid,
              listEditedAt: d.listEditedAt
            },
            include: {
              content: true
            }
          });
        }
      } else {
        let liveContent = await db.documentContent.create({
          data: {
            content: d.nextContent
          }
        });

        liveContentOid = liveContent.oid;

        if (!d.document.currentVersion) {
          activeVersion = await internalDocumentVersioningService.createVersion({
            project: d.project,
            instance: d.instance,
            document: d.document,
            contentOid: liveContentOid,
            listEditedAt: d.listEditedAt
          });

          didCreateVersion = true;
        } else {
          activeVersion = await db.documentVersion.update({
            where: {
              id: d.document.currentVersion.id
            },
            data: {
              contentOid: liveContentOid,
              listEditedAt: d.listEditedAt
            },
            include: {
              content: true
            }
          });
        }
      }

      return {
        activeVersion,
        liveContentOid,
        isContentOwner: d.document.isContentOwner || !shouldKeepParentSync,
        didCreateVersion,
        draftVersionExpiresAt:
          await internalDocumentVersioningService.getNextDraftVersionExpiresAt(now)
      };
    });
  }

  async persistDraftToDocument(d: {
    project: Project;
    instance: Instance;
    document: DocumentRecord;
    draft: DocumentDraft;
    actors: { actor: ResourceActor; context?: Context }[];
  }) {
    return await withTransaction(async db => {
      let nextTitle = d.draft.title;
      let nextContent = d.draft.content;
      let hasContentChange = nextContent !== d.document.content.content;
      let hasTitleChange = nextTitle !== d.document.title;

      if (!hasContentChange && !hasTitleChange) {
        let { parentLiveContent, shouldKeepParentSync } = await this.getParentSyncState({
          document: d.document,
          nextContent
        });

        if (shouldKeepParentSync && d.document.currentVersion?.previousVersionOid) {
          let baseVersion = await db.documentVersion.findFirst({
            where: {
              documentOid: d.document.oid,
              previousVersionOid: null
            },
            orderBy: {
              versionNumber: 'asc'
            }
          });

          if (baseVersion && baseVersion.oid !== d.document.currentVersion.oid) {
            await db.documentVersion.update({
              where: {
                id: baseVersion.id
              },
              data: {
                contentOid: parentLiveContent!.contentOid,
                listEditedAt: d.document.currentVersion.listEditedAt
              }
            });

            let updatedDocument = await db.document.update({
              where: {
                id: d.document.id
              },
              data: {
                contentOid: parentLiveContent!.contentOid,
                currentVersionOid: baseVersion.oid,
                maxVersionNumber: baseVersion.versionNumber,
                isContentOwner: false
              },
              include: documentInclude
            });

            await db.documentVersion.deleteMany({
              where: {
                documentOid: d.document.oid,
                NOT: {
                  oid: baseVersion.oid
                }
              }
            });

            return {
              document: updatedDocument,
              createdVersionId: null,
              didPersistChange: false
            };
          }
        }

        return {
          document: d.document,
          createdVersionId: null,
          didPersistChange: false
        };
      }

      let activeVersion = d.document.currentVersion;
      let liveContentOid = d.document.contentOid;
      let isContentOwner = d.document.isContentOwner;
      let createdVersionId: string | null = null;
      let draftVersionExpiresAt = d.document.draftVersionExpiresAt;

      if (hasContentChange) {
        let listEditedAt = new Date();

        let writeResult = await this.writeDocumentContent({
          project: d.project,
          instance: d.instance,
          document: d.document,
          nextContent,
          listEditedAt
        });

        activeVersion = writeResult.activeVersion;
        liveContentOid = writeResult.liveContentOid;
        isContentOwner = writeResult.isContentOwner;
        createdVersionId = writeResult.didCreateVersion
          ? (writeResult.activeVersion?.id ?? null)
          : null;
        draftVersionExpiresAt = writeResult.draftVersionExpiresAt;
      }

      await db.file.update({
        where: {
          id: d.document.file.id
        },
        data: {
          fileName: nextTitle,
          title: nextTitle,
          fileSize: hasContentChange ? getTextByteSize(nextContent) : undefined
        }
      });

      let updatedDocument = await db.document.update({
        where: {
          id: d.document.id
        },
        data: {
          title: nextTitle,
          contentOid: hasContentChange ? liveContentOid : undefined,
          isContentOwner: hasContentChange ? isContentOwner : undefined,
          currentVersionOid: hasContentChange ? (activeVersion?.oid ?? null) : undefined,
          draftVersionExpiresAt: hasContentChange ? draftVersionExpiresAt : undefined
        },
        include: documentInclude
      });

      await db.skillAgent.updateMany({
        where: {
          documentOid: updatedDocument.oid,
          status: 'active'
        },
        data: {
          name: nextTitle
        }
      });

      for (let { actor, context } of d.actors) {
        if (hasContentChange && activeVersion) {
          await internalDocumentParticipantService.ensureVersionEditor({
            version: activeVersion,
            document: updatedDocument,
            actor,
            context
          });
        }
      }

      return {
        document: updatedDocument,
        createdVersionId,
        didPersistChange: true
      };
    });
  }
}

export let internalDocumentContentService = Service.create(
  'cargoInternalDocumentContentService',
  () => new InternalDocumentContentServiceImpl()
).build();
