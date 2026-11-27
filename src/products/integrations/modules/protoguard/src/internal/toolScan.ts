import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type ProtoGuardToolFinding,
  type ProtoGuardToolFindingField
} from '@metorial-subspace/db';
import { activeRuleset, getFamilyDefinition } from '../definitions/rulesets';
import {
  hashToolDefinition,
  projectFinding,
  scanToolDefinition,
  type EngineFinding,
  type ToolDefinitionInput
} from '../lib/engine';

let FIELD_BY_PATH_KEY: Record<string, ProtoGuardToolFindingField> = {
  name: 'name',
  title: 'name',
  description: 'description',
  inputSchema: 'input_schema',
  outputSchema: 'output_schema'
};

let providerToolSelect = {
  oid: true,
  key: true,
  name: true,
  description: true,
  value: true,
  providerOid: true
} as const;

let toDefinition = (tool: {
  name: string;
  description: string | null;
  value: PrismaJson.ProviderToolValue;
}): ToolDefinitionInput => {
  let mcpTool = tool.value.mcpToolType?.type == 'mcp.tool' ? tool.value.mcpToolType : null;

  return {
    name: tool.name,
    title: tool.value.title ?? mcpTool?.title ?? null,
    description: tool.description ?? tool.value.description ?? null,
    inputSchema: tool.value.inputJsonSchema,
    outputSchema: tool.value.outputJsonSchema,
    annotations: mcpTool?.annotations
  };
};

// Tool definitions are provider metadata rather than message content, so findings keep their
// (secret-masked) snippet regardless of any session's retention level.
let toToolFinding = (finding: EngineFinding): ProtoGuardToolFinding => {
  let family = getFamilyDefinition(finding.family);
  let projected = projectFinding(finding, 'full', { hmacKey: null });
  let fieldPart = finding.path.find(
    part => part.type == 'key' && part.key in FIELD_BY_PATH_KEY
  );

  return {
    ruleKey: finding.ruleKey,
    family: finding.family,
    issueType: family?.issueType ?? finding.family,
    severity: family?.severity ?? 'medium',
    confidence: finding.precision,
    field: fieldPart?.type == 'key' ? FIELD_BY_PATH_KEY[fieldPart.key]! : 'description',
    path: projected.path,
    startOffset: finding.startOffset,
    endOffset: finding.endOffset,
    snippet: projected.matchedText ?? '',
    description: projected.description
  };
};

class ProtoGuardToolScanServiceImpl {
  async scanProviderTool(d: { providerToolOid: bigint }) {
    let tool = await db.providerTool.findUnique({
      where: { oid: d.providerToolOid },
      select: providerToolSelect
    });
    if (!tool) return null;

    let scanKey = {
      providerToolOid_rulesetVersion: {
        providerToolOid: tool.oid,
        rulesetVersion: activeRuleset.version
      }
    };

    let existing = await db.protoGuardToolScan.findUnique({ where: scanKey });
    if (existing) return existing;

    // Rows are immutable per definition; a changed tool becomes a new row under the same key, so
    // the previous version is whichever sibling row was scanned most recently.
    let previous = await db.protoGuardToolScan.findFirst({
      where: {
        providerOid: tool.providerOid,
        providerToolOid: { not: tool.oid },
        providerTool: { key: tool.key }
      },
      orderBy: { createdAt: 'desc' },
      include: { providerTool: { select: providerToolSelect } }
    });
    let previousHash = previous
      ? hashToolDefinition(toDefinition(previous.providerTool))
      : null;

    let scan = scanToolDefinition({
      ruleset: activeRuleset,
      tool: toDefinition(tool),
      previous: previous ? { hash: previousHash!, isFlagged: previous.isFlagged } : null
    });

    return await db.protoGuardToolScan.upsert({
      where: scanKey,
      update: {},
      create: {
        ...getId('protoGuardToolScan'),
        rulesetVersion: activeRuleset.version,
        status: 'completed',

        probability: scan.score.probability,
        isFlagged: scan.isFlagged,
        findings: scan.findings.map(toToolFinding),
        previousToolHash: previousHash,

        providerToolOid: tool.oid,
        providerOid: tool.providerOid
      }
    });
  }
}

export let protoGuardToolScanService = Service.create(
  'protoGuardToolScanService',
  () => new ProtoGuardToolScanServiceImpl()
).build();
