import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import type { Instance, Project, ResourceActor } from '@metorial/db';
import { skillService } from '@metorial/module-skill';
import { storeItemService, storeService } from '@metorial/module-store';
import {
  serializeAssistantAccess,
  type AssistantAccess,
  type AssistantAccessClaims
} from '../../../lib/definitions';

export type SkillEditorMode = 'block' | 'rewrite' | 'summarize' | 'document' | 'skill' | 'ask';
export type SkillEditorRequestedMode = Exclude<SkillEditorMode, 'ask'>;

let refSchema = v.string({ description: 'Encoded Yjs relative position' });

export let skillEditorConversationInput = v.object({
  skillId: v.string(),
  documentId: v.optional(v.string())
});

export let skillEditorRequestInput = v.object({
  mode: v.optional(v.enumOf(['block', 'rewrite', 'summarize', 'document', 'skill'])),
  documentId: v.optional(v.string()),
  selection: v.optional(
    v.object({
      from: refSchema,
      to: refSchema,
      text: v.string()
    })
  ),
  blockRef: v.optional(refSchema),
  target: v.optional(
    v.object({
      type: v.enumOf(['selection', 'section', 'document']),
      ref: v.optional(refSchema),
      text: v.optional(v.string())
    })
  ),
  placement: v.optional(v.enumOf(['inline', 'chat']))
});

export type SkillEditorRequestContext = {
  mode?: SkillEditorRequestedMode;
  documentId?: string;
  selection?: { from: string; to: string; text: string };
  blockRef?: string;
  target?: { type: 'selection' | 'section' | 'document'; ref?: string; text?: string };
  placement?: 'inline' | 'chat';
};

export type SkillEditorConversationInput = {
  skillId: string;
  storeId: string;
  skillName: string;
  documentId?: string;
};

export type SkillEditorRequest = {
  mode: SkillEditorMode;
  requestedMode: SkillEditorRequestedMode;
  canWrite: boolean;
  skillId: string;
  storeId: string;
  skillName: string;
  document?: { id: string; path: string; title: string };
  selection?: { from: string; to: string; text: string };
  blockRef?: string;
  target?: { type: 'selection' | 'section' | 'document'; ref?: string; text?: string };
  placement: 'inline' | 'chat';
  access: AssistantAccessClaims;
  defaultModelId?: string;
};

type Scope = {
  project: Project;
  instance: Instance;
  access?: AssistantAccess;
};

let requireAccess = (access?: AssistantAccess) => {
  if (!access) {
    throw new ServiceError(
      forbiddenError({ message: 'The skills assistant requires an authorized caller.' })
    );
  }
  return access;
};

let accessInput = (access: AssistantAccess) => ({
  authorization: access.authorization,
  defaultPermissions: access.defaultPermissions,
  overridePermissions: access.overridePermissions
});

export let loadSkillForAssistant = async (d: Scope & { skillId: string }) => {
  let access = requireAccess(d.access);
  let skill = await skillService.getSkillById({
    project: d.project,
    instance: d.instance,
    skillId: d.skillId,
    accessTags: access.authorization.type == 'restricted' ? access.accessTags : undefined
  });
  if (!skill.store) throw new ServiceError(notFoundError('skill.store', d.skillId));

  let permissions = await storeService.getStorePermissions({
    project: d.project,
    instance: d.instance,
    store: skill.store,
    ...accessInput(access)
  });

  let canRead = permissions.hasFullAccess || permissions.permissions.includes('content_read');
  if (!canRead) {
    throw new ServiceError(forbiddenError({ message: 'You cannot read this skill.' }));
  }

  let canWrite =
    !skill.store.isReadOnly &&
    (permissions.hasFullAccess || permissions.permissions.includes('content_write'));

  if (canWrite && access.authorization.type == 'restricted') {
    canWrite = await skillService
      .assertSkillWriteAccess({
        project: d.project,
        instance: d.instance,
        skill,
        ...accessInput(access)
      })
      .then(() => true)
      .catch(() => false);
  }

  return { skill, store: skill.store, access, canWrite };
};

export let findSkillDocument = async (
  d: Scope & { access: AssistantAccess; storeId: string; documentId: string }
) => {
  let paginator = await storeItemService.listStoreItems({
    project: d.project,
    instance: d.instance,
    storeId: d.storeId,
    documentIds: [d.documentId],
    types: ['document'],
    ...accessInput(d.access)
  });
  let item = (await paginator.run({ limit: 1 })).items[0];
  if (!item?.document) {
    throw new ServiceError(
      badRequestError({ message: `Document ${d.documentId} is not part of this skill.` })
    );
  }

  return { id: item.document.id, path: item.path, title: item.document.title };
};

let writeOnlyModes: SkillEditorRequestedMode[] = ['block', 'rewrite'];

export let resolveSkillEditorMode = (d: {
  requestedMode: SkillEditorRequestedMode;
  canWrite: boolean;
  placement: 'inline' | 'chat';
  hasDocument: boolean;
}): SkillEditorMode => {
  let needsDocument = d.requestedMode != 'skill';
  if (needsDocument && !d.hasDocument) {
    throw new ServiceError(
      badRequestError({ message: `The ${d.requestedMode} mode requires a documentId.` })
    );
  }

  let needsWrite =
    writeOnlyModes.includes(d.requestedMode) ||
    (d.requestedMode == 'summarize' && d.placement == 'inline');

  if (needsWrite && !d.canWrite) {
    throw new ServiceError(
      forbiddenError({ message: `You need write access to use ${d.requestedMode}.` })
    );
  }

  if (d.requestedMode == 'summarize') return d.placement == 'inline' ? 'summarize' : 'ask';
  if (!d.canWrite && (d.requestedMode == 'document' || d.requestedMode == 'skill'))
    return 'ask';

  return d.requestedMode;
};

export let buildSkillEditorRequest = async (
  d: Scope & {
    actor: ResourceActor;
    conversationInput: SkillEditorConversationInput;
    requestInput: SkillEditorRequestContext;
    fastModelId: string;
  }
): Promise<SkillEditorRequest> => {
  let { skill, store, access, canWrite } = await loadSkillForAssistant({
    project: d.project,
    instance: d.instance,
    access: d.access,
    skillId: d.conversationInput.skillId
  });

  let documentId = d.requestInput.documentId ?? d.conversationInput.documentId;
  let document = documentId
    ? await findSkillDocument({
        project: d.project,
        instance: d.instance,
        access,
        storeId: store.id,
        documentId
      })
    : undefined;

  let requestedMode = d.requestInput.mode ?? (document ? 'document' : 'skill');
  let placement = d.requestInput.placement ?? 'chat';

  if (requestedMode == 'rewrite' && !d.requestInput.selection) {
    throw new ServiceError(
      badRequestError({ message: 'The rewrite mode requires a selection.' })
    );
  }
  if (requestedMode == 'block' && !d.requestInput.blockRef) {
    throw new ServiceError(
      badRequestError({ message: 'The block mode requires a blockRef.' })
    );
  }

  let mode = resolveSkillEditorMode({
    requestedMode,
    canWrite,
    placement,
    hasDocument: !!document
  });

  return {
    mode,
    requestedMode,
    canWrite,
    skillId: skill.id,
    storeId: store.id,
    skillName: skill.name,
    document,
    selection: d.requestInput.selection,
    blockRef: d.requestInput.blockRef,
    target: d.requestInput.target,
    placement,
    access: serializeAssistantAccess({ actor: d.actor, access }),
    defaultModelId: mode == 'rewrite' ? d.fastModelId : undefined
  };
};
