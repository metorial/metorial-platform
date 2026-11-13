import type { EntityStatus } from '../../prisma/generated/client';
import type { GraphLink } from '../entities/graph';
import type { EntityCardinality } from '../entities/kinds';
import type {
  AttributionEntry,
  ManualAssignment,
  SessionClassification,
  SessionDocument
} from '../store/derivedModels';
import type { AttributionRuleMatch, TagOrigin } from '../types';

export type AttributionEntity = {
  id: string;
  kind: string;
  status: EntityStatus;
  slug: string | null;
  source: string | null;
  scopeProjectId: string | null;
  scopeInstanceId: string | null;
  identifiers: { type: string; value: string }[];
};

export type AttributionKind = {
  key: string;
  cardinality: EntityCardinality;
  tagOrigins: TagOrigin[];
};

export type AttributionRuleDefinition = {
  id: string;
  effect: 'assign' | 'exclude';
  priority: number;
  targetId: string;
  scopeProjectId: string | null;
  scopeInstanceId: string | null;
  validFrom: Date;
  match: AttributionRuleMatch;
};

export type AttributionSession = Pick<
  SessionDocument,
  'projectId' | 'instanceId' | 'startedAt' | 'client' | 'observed' | 'context'
> & {
  manual?: ManualAssignment[];
  classification?: SessionClassification;
  models?: string[];
  mcpServers?: string[];
};

export type ResolveAttributionInput = {
  session: AttributionSession;
  kinds: Map<string, AttributionKind>;
  entities: Map<string, AttributionEntity>;
  slugs: Map<string, string>;
  emails: Map<string, string>;
  rules: AttributionRuleDefinition[];
  links: GraphLink[];
  managedKinds: string[];
  credentialAgent?: boolean;
  staffingPropagates?: boolean;
  sessionless?: boolean;
};

export type ResolvedAttribution = {
  entries: AttributionEntry[];
  dimIds: string[];
  inputsHash: string;
  fullyAttributed: boolean;
  matchedRuleIds: string[];
};
