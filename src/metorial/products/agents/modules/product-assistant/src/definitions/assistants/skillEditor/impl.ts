import { implementation, restoreAssistantAccess } from '../../../lib/definitions';
import { Agent } from '../../../lib/open-harness';
import { attachAgentRunExtension } from '../../../lib/run/extension';
import { createSkillWorkspace } from '../../../lib/skillWorkspace';
import { claudeHaiku45, claudeSonnet46 } from '../../models/anthropic';
import { webSearchTools } from '../../tools/webSearch';
import {
  buildSkillEditorRequest,
  loadSkillForAssistant,
  findSkillDocument,
  skillEditorConversationInput,
  skillEditorRequestInput,
  type SkillEditorConversationInput,
  type SkillEditorMode,
  type SkillEditorRequest
} from './context';
import { skillEditorSystemPrompt } from './prompts';
import { createSkillEditorTools } from './tools';

let modeSettings: Record<
  SkillEditorMode,
  { maxSteps: number; workspace: boolean; web: boolean; writableWorkspace: boolean }
> = {
  block: { maxSteps: 24, workspace: true, web: true, writableWorkspace: false },
  rewrite: { maxSteps: 4, workspace: false, web: true, writableWorkspace: false },
  summarize: { maxSteps: 8, workspace: false, web: false, writableWorkspace: false },
  document: { maxSteps: 256, workspace: true, web: true, writableWorkspace: true },
  skill: { maxSteps: 256, workspace: true, web: true, writableWorkspace: true },
  ask: { maxSteps: 64, workspace: true, web: true, writableWorkspace: false }
};

let readOnlyReason = (request: SkillEditorRequest) =>
  request.canWrite
    ? `the skill is read-only in ${request.mode} mode`
    : 'you only have read access to this skill';

export let skillEditorAssistantImplementation = implementation({
  defaultModel: claudeSonnet46,
  availableModels: [claudeSonnet46, claudeHaiku45],
  slug: 'skills',
  name: 'Skills Assistant',

  input: skillEditorConversationInput,

  async handleInput(d): Promise<SkillEditorConversationInput> {
    let { skill, store, access } = await loadSkillForAssistant({
      project: d.project,
      instance: d.instance,
      access: d.access,
      skillId: d.input.skillId
    });

    if (d.input.documentId) {
      await findSkillDocument({
        project: d.project,
        instance: d.instance,
        access,
        storeId: store.id,
        documentId: d.input.documentId
      });
    }

    return {
      skillId: skill.id,
      storeId: store.id,
      skillName: skill.name,
      documentId: d.input.documentId
    };
  },

  requestInput: skillEditorRequestInput,

  async handleRequestInput(d) {
    return await buildSkillEditorRequest({
      project: d.project,
      instance: d.instance,
      actor: d.actor,
      access: d.access,
      conversationInput: d.conversationInput,
      requestInput: d.requestInput,
      fastModelId: (await claudeHaiku45).slug
    });
  },

  async getAgent(d) {
    let request = d.requestInput;
    if (!request) throw new Error('Skills assistant requests require a request context');

    let settings = modeSettings[request.mode];
    let access = await restoreAssistantAccess({
      project: d.project,
      instance: d.instance,
      claims: request.access
    });

    let workspace = await createSkillWorkspace({
      project: d.project,
      instance: d.instance,
      access,
      auditScope: access.auditScope,
      storeId: request.storeId,
      readOnly: !settings.writableWorkspace,
      readOnlyReason: readOnlyReason(request),
      activeDocument: request.document
        ? {
            documentId: request.document.id,
            path: request.document.path,
            writable: request.mode == 'document'
          }
        : undefined
    });
    await workspace.view?.ensureLoaded();

    let editorTools = createSkillEditorTools({ request, workspace });
    let web = settings.web ? webSearchTools : {};

    let agent = new Agent({
      name: 'Skills Assistant',
      model: d.model.model,
      systemPrompt: skillEditorSystemPrompt({
        request,
        blockAlias: request.blockRef
          ? workspace.view?.aliasForRef(request.blockRef)
          : undefined,
        writable: settings.writableWorkspace,
        hasWeb: Object.keys(web).length > 0
      }),
      filesystem: workspace.sandbox.fs,
      instructions: false,
      tools: {
        ...(settings.workspace ? workspace.tools : {}),
        ...editorTools.tools,
        ...web
      },
      maxSteps: settings.maxSteps
    });

    return attachAgentRunExtension(agent, editorTools.extension);
  }
});
