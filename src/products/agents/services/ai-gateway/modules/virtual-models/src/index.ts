export { allVirtualModelTemplates, virtualModelTemplates } from './definitions/templates';
export type { RuleTrace } from './lib/cel';
export {
  virtualModelTemplate,
  type TemplateParameter,
  type VirtualModelTemplate
} from './lib/definitions/template';
export {
  decisionFailedError,
  invalidVirtualModelError,
  noCompatibleTargetError,
  virtualModelSlugTakenError
} from './lib/errors';
export {
  findActiveVirtualModel,
  getInstanceVirtualModels,
  type ActiveVirtualModel
} from './lib/lookup';
export type { SkippedTarget } from './lib/targets';
export * from './services';
