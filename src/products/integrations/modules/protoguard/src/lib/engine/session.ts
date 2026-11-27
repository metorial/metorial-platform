export type CapabilityTag = 'reads_private' | 'external_comm' | 'state_change';

let SUSPICIOUS_OUTPUT_MIN_PRECISION = 0.5;
let MAX_TRACKED_OUTPUTS = 20;
let MAX_TRACKED_HMACS = 200;
let ESCALATION_OCCURRENCES = 3;
let ESCALATION_PRECISION_BOOST = 0.2;
let ESCALATION_PRECISION_MAX = 0.95;

export let SINK_RULE_KEY = 'injection_followed_by_sink.output_then_sink';
export let SINK_PRECISION = 0.85;

export interface SessionOutputRecord {
  messageId: string;
  providerId: string | null;
  ruleKeys: string[];
  isConsumed: boolean;
}

export interface SessionPlaneState {
  version: 1;
  outputs: SessionOutputRecord[];
  hmacCounts: Record<string, number>;
  escalatedHmacs: string[];
}

export interface SessionFindingInput {
  ruleKey: string;
  family: string;
  precision: number;
  stage: 'shadow' | 'active' | 'deprecated';
  contentHmac: string | null;
}

export interface SessionFinding {
  ruleKey: string;
  family: string;
  precision: number;
  hardRule: boolean;
  description: string;
  contentHmac: string | null;
}

export let createSessionPlaneState = (): SessionPlaneState => ({
  version: 1,
  outputs: [],
  hmacCounts: {},
  escalatedHmacs: []
});

interface ToolCapabilitySource {
  tags?: { destructive?: boolean; readOnly?: boolean } | null;
  mcpToolType?: { type: string; annotations?: Record<string, unknown> | undefined } | null;
}

// Only explicit hints count. The MCP spec defaults an unannotated tool to destructive and
// open-world, and treating every unannotated tool as a sink would turn the rule into noise.
export let deriveCapabilityTags = (value: ToolCapabilitySource | null | undefined) => {
  let annotations =
    value?.mcpToolType?.type == 'mcp.tool' ? (value.mcpToolType.annotations ?? {}) : {};

  let readOnly = value?.tags?.readOnly ?? annotations.readOnlyHint;
  let destructive = value?.tags?.destructive ?? annotations.destructiveHint;
  let openWorld = annotations.openWorldHint;

  let tags = new Set<CapabilityTag>();
  if (readOnly === true) tags.add('reads_private');
  if (destructive === true || readOnly === false) tags.add('state_change');
  if (openWorld === true && readOnly !== true) tags.add('external_comm');

  return [...tags].sort();
};

let isLive = (finding: SessionFindingInput) => finding.stage == 'active';

let trimHmacCounts = (counts: Record<string, number>) => {
  let entries = Object.entries(counts);
  if (entries.length <= MAX_TRACKED_HMACS) return counts;

  return Object.fromEntries(entries.slice(entries.length - MAX_TRACKED_HMACS));
};

// The same injected text showing up again and again in one session (a poisoned page re-fetched,
// a loop) is stronger evidence than any single occurrence, but it should only alert once.
let escalateRepeats = (state: SessionPlaneState, findings: SessionFindingInput[]) => {
  let escalations: SessionFinding[] = [];
  let hmacCounts = { ...state.hmacCounts };
  let escalated = new Set(state.escalatedHmacs);

  let byHmac = new Map<string, SessionFindingInput>();
  for (let finding of findings.filter(isLive)) {
    if (!finding.contentHmac) continue;

    let current = byHmac.get(finding.contentHmac);
    if (!current || finding.precision > current.precision) {
      byHmac.set(finding.contentHmac, finding);
    }
  }

  for (let [hmac, finding] of byHmac) {
    let count = (hmacCounts[hmac] ?? 0) + 1;
    delete hmacCounts[hmac];
    hmacCounts[hmac] = count;

    if (count < ESCALATION_OCCURRENCES || escalated.has(hmac)) continue;
    escalated.add(hmac);

    escalations.push({
      ruleKey: `${finding.family}.repeated_in_session`,
      family: finding.family,
      precision: Math.min(
        ESCALATION_PRECISION_MAX,
        finding.precision + ESCALATION_PRECISION_BOOST
      ),
      hardRule: false,
      description: `The same flagged content appeared ${count} times in this session.`,
      contentHmac: hmac
    });
  }

  return {
    escalations,
    hmacCounts: trimHmacCounts(hmacCounts),
    escalatedHmacs: [...escalated].slice(-MAX_TRACKED_HMACS)
  };
};

export let recordSessionOutput = (
  state: SessionPlaneState,
  d: { messageId: string; providerId: string | null; findings: SessionFindingInput[] }
) => {
  let suspicious = d.findings.filter(
    finding => isLive(finding) && finding.precision >= SUSPICIOUS_OUTPUT_MIN_PRECISION
  );
  let { escalations, hmacCounts, escalatedHmacs } = escalateRepeats(state, d.findings);

  let outputs = suspicious.length
    ? [
        ...state.outputs,
        {
          messageId: d.messageId,
          providerId: d.providerId,
          ruleKeys: [...new Set(suspicious.map(finding => finding.ruleKey))].sort(),
          isConsumed: false
        }
      ].slice(-MAX_TRACKED_OUTPUTS)
    : state.outputs;

  return {
    state: { ...state, outputs, hmacCounts, escalatedHmacs },
    findings: escalations
  };
};

// The classic exfiltration chain: a suspicious tool output from one provider, then the agent calls
// a state-changing or outbound tool on a different provider. Each source output fires at most once.
export let recordSessionToolCall = (
  state: SessionPlaneState,
  d: { providerId: string | null; capabilityTags: CapabilityTag[] }
) => {
  let isSink =
    d.capabilityTags.includes('external_comm') || d.capabilityTags.includes('state_change');
  if (!isSink) return { state, findings: [] as SessionFinding[] };

  let source = [...state.outputs]
    .reverse()
    .find(output => !output.isConsumed && output.providerId != d.providerId);
  if (!source) return { state, findings: [] as SessionFinding[] };

  let outputs = state.outputs.map(output =>
    output.messageId == source.messageId ? { ...output, isConsumed: true } : output
  );

  return {
    state: { ...state, outputs },
    findings: [
      {
        ruleKey: SINK_RULE_KEY,
        family: 'injection_followed_by_sink',
        precision: SINK_PRECISION,
        hardRule: false,
        description: `A suspicious tool output (${source.ruleKeys.join(', ')}) was followed by a call to a sensitive tool on another provider.`,
        contentHmac: null
      }
    ]
  };
};
