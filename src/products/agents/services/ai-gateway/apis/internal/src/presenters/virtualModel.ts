import type { Instance, VirtualModel, VirtualModelVersion } from '@mtsrc/ai-gateway-db';
import type {
  GatewayRoute,
  VirtualModelTemplate
} from '@mtsrc/ai-gateway-module-virtual-models';
import type { RequestSummary } from '@mtsrc/ai-gateway-request-features';
import { previewCandidate } from './route';

export let virtualModelVersionPresenter = (version: VirtualModelVersion) => ({
  object: 'ai_gateway#virtual_model_version',

  id: version.id,
  number: version.number,
  definition: version.definition,
  targetModelSlugs: version.targetModelSlugs,
  createdAt: version.createdAt
});

export let virtualModelPresenter = (
  virtualModel: VirtualModel & {
    currentVersion: VirtualModelVersion | null;
    instance: Instance;
  },
  warnings: string[] = []
) => ({
  object: 'ai_gateway#virtual_model',

  id: virtualModel.id,
  slug: virtualModel.slug,
  name: virtualModel.name,
  description: virtualModel.description,
  instanceId: virtualModel.instance.id,

  currentVersion: virtualModel.currentVersion
    ? virtualModelVersionPresenter(virtualModel.currentVersion)
    : null,
  warnings,

  archivedAt: virtualModel.archivedAt,
  createdAt: virtualModel.createdAt,
  updatedAt: virtualModel.updatedAt
});

export let virtualModelTemplatePresenter = (template: VirtualModelTemplate) => ({
  object: 'ai_gateway#virtual_model_template',

  slug: template.slug,
  name: template.name,
  description: template.description,
  parameters: template.parameters,
  usesDecisionModel: template.usesDecisionModel
});

export let virtualModelTestPresenter = (d: {
  summary: RequestSummary;
  route: GatewayRoute;
}) => ({
  object: 'ai_gateway#virtual_model_test',

  request: {
    dialect: d.summary.dialect,
    estimatedInputTokens: d.summary.estimatedInputTokens,
    messageCount: d.summary.messageCount,
    userTurns: d.summary.userTurns,
    isContinuation: d.summary.isContinuation,
    hasImages: d.summary.hasImages,
    hasFiles: d.summary.hasFiles,
    hasAudio: d.summary.hasAudio,
    toolCount: d.summary.toolCount
  },
  virtualModel: d.route.virtualModel,
  overrides: d.route.overrides,
  candidates: d.route.candidates.map(candidate => ({
    model: candidate.model,
    requestedModel: candidate.requestedModel,
    ...previewCandidate(candidate)
  }))
});
