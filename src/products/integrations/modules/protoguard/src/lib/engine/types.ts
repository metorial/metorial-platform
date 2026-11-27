export type ScanDirection = 'input' | 'output' | 'tool_definition';

export type ScanView = 'raw' | 'canonical' | 'decoded';

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RuleStage = 'shadow' | 'active' | 'deprecated';

export type RuleCost = 'cheap' | 'expensive';

export type ScanCoverage = 'full' | 'sampled' | 'partial' | 'skipped';

export type SizeTier = 'S' | 'M' | 'L' | 'XL';

export type PathPart = { type: 'key'; key: string } | { type: 'index'; index: number };

export interface Segment {
  direction: ScanDirection;
  path: PathPart[];
  value: string;
  kind: 'text' | 'binary';
  globalOffset: number;
}

export interface RawMatch {
  start: number;
  end: number;
  description?: string;
  precision?: number;
  hardRule?: boolean;
  decodedSample?: string;
}

export interface DetectInput {
  text: string;
  view: ScanView;
  direction: ScanDirection;
  context: ScanContext;
}

export type RuleMatcher =
  | { type: 'phrases'; phrases: string[] }
  | { type: 'regex'; pattern: RegExp }
  | { type: 'custom'; detect: (input: DetectInput) => RawMatch[] };

export interface RuleDefinition {
  key: string;
  family: string;
  description: string;
  appliesTo: Partial<Record<ScanDirection, number>>;
  views: ScanView[];
  cost: RuleCost;
  stage: RuleStage;
  hardRule?: boolean;
  redactMatch?: boolean;
  matcher: RuleMatcher;
}

export interface FamilyDefinition {
  key: string;
  name: string;
  description: string;
  issueType: string;
  severity: RuleSeverity;
  scoreWeight: number;
  defaultEnabled: boolean;
  alertConfidenceThreshold: number;
  stage: RuleStage;
}

export interface Ruleset {
  version: string;
  families: FamilyDefinition[];
  rules: RuleDefinition[];
}

export interface ScanContext {
  sessionToolNames?: string[];
  currentToolName?: string | null;
}

export interface ScanPayload {
  input?: unknown;
  output?: unknown;
  toolDefinition?: unknown;
}

export interface ScanBudget {
  maxDurationMs: number | null;
  now: () => number;
}

export interface EngineFinding {
  ruleKey: string;
  family: string;
  direction: ScanDirection;
  view: ScanView;
  stage: RuleStage;
  precision: number;
  hardRule: boolean;
  redactMatch: boolean;
  description: string;
  ruleDescription: string;
  path: PathPart[];
  startOffset: number;
  endOffset: number;
  matchedText: string;
  canonicalText: string;
  contextBefore: string;
  contextAfter: string;
  decodedSample: string | null;
}

export interface ScanResult {
  rulesetVersion: string;
  tier: SizeTier;
  coverage: ScanCoverage;
  totalChars: number;
  scannedChars: number;
  binaryChars: number;
  segmentCount: number;
  isBudgetExceeded: boolean;
  isFindingsTruncated: boolean;
  findings: EngineFinding[];
}
