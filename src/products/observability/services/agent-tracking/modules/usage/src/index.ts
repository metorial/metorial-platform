export {
  type BaseSlice,
  isSessionlessKey,
  parseSessionlessKey,
  sessionlessKey
} from './lib/slices';
export { sourceKindOf, usageRank } from './lib/sources';
export { instanceIdsOfScope, type QueryScope, resolveQueryScope } from './lib/scope';
export { coverageService } from './services/coverage';
export { usageErasureService } from './services/usageErasure';
export { usageSliceService } from './services/usageSlice';
