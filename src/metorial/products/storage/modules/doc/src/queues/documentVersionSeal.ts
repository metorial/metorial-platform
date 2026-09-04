import { createAuditScope, type AuditActor, type AuditScope } from '@metorial/audit-scope';
import type { Context } from '@metorial/context';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

export let documentVersionSealQueue = createQueue<{ documentVersionId: string }>({
  name: 'cargo/doc/version-seal',
  workerOpts: {
    concurrency: 5
  }
});

export let enqueueDocumentVersionSeal = async (d: { documentVersionId: string }) => {
  await documentVersionSealQueue.add(d, { id: `doc-version-seal-${d.documentVersionId}` });
};

let toEditorAuditActor = (resourceActor: {
  id: string;
  organizationActor: { id: string } | null;
  consumerProfile: { id: string } | null;
}): AuditActor => {
  if (resourceActor.organizationActor) {
    return { type: 'org_actor', id: resourceActor.organizationActor.id };
  }

  if (resourceActor.consumerProfile) {
    return { type: 'consumer_profile', id: resourceActor.consumerProfile.id };
  }

  return { type: 'resource_actor', id: resourceActor.id };
};

let getEditorContext = (editor: { ip: string | null; ua: string | null }): Context => ({
  ip: editor.ip ?? '',
  ua: editor.ua
});

export let sealDocumentVersion = async (d: { documentVersionId: string }) => {
  let version = await db.documentVersion.findUnique({
    where: { id: d.documentVersionId },
    select: {
      id: true,
      versionNumber: true,
      listEditedAt: true,
      createdAt: true,
      instanceOid: true,
      previousVersion: { select: { id: true } },
      content: { select: { content: true } },
      document: {
        select: {
          id: true,
          title: true,
          instance: { select: { oid: true, organizationOid: true } }
        }
      },
      documentVersionEditors: {
        select: {
          ip: true,
          ua: true,
          resourceActor: {
            select: {
              id: true,
              organizationActorOid: true,
              organizationActor: { select: { id: true } },
              consumerProfile: { select: { id: true } }
            }
          }
        }
      }
    }
  });
  if (!version) return null;
  if (version.documentVersionEditors.length == 0) return null;

  let instance = version.document.instance;
  let editedAt = version.listEditedAt ?? version.createdAt;

  let editors = version.documentVersionEditors.map(editor => ({
    auditScope: createAuditScope({
      organization: { oid: instance.organizationOid },
      instance: { oid: instance.oid },
      organizationActor: editor.resourceActor.organizationActorOid
        ? { oid: editor.resourceActor.organizationActorOid }
        : null,
      actor: toEditorAuditActor(editor.resourceActor),
      context: getEditorContext(editor)
    }) satisfies AuditScope
  }));

  await Fabric.fire('document.version.sealed:after', {
    document: {
      id: version.document.id,
      title: version.document.title
    },
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      byteSize: new TextEncoder().encode(version.content.content).length,
      editedAt
    },
    previousVersionId: version.previousVersion?.id ?? null,
    editors
  });

  return { editorCount: editors.length };
};

export let documentVersionSealProcessor = documentVersionSealQueue.process(
  async data => void (await sealDocumentVersion(data))
);

export let documentVersionSealProcessors = combineQueueProcessors([
  documentVersionSealProcessor
]);
