import type {
  SecurityFileKind,
  SecurityFindingCategoryKey,
  SecurityFindingSeverityLevel,
  SecurityLedgerRef,
  SecurityReportBehavior,
  SecurityReportFinding,
  SecurityReviewObservation,
  SecuritySkillCapabilityTag
} from '@metorial-subspace/db';
import type { LedgerFact } from '@metorial/review-engine';
import { scanSecrets } from './detectors';
import { groupByKind } from './groupByKind';

let EVIDENCE_PREFIX = '/evidence/skill/';
let MAX_REFS_PER_FINDING = 5;
let PADDING_RUN_LENGTH = 5000;
let PADDING_RATIO = 0.9;
let PADDING_MIN_BYTES = 50_000;
let ENCODED_BLOB_LENGTH = 400;
let ZERO_WIDTH_THRESHOLD = 3;
let HIDDEN_COMMENT_LENGTH = 40;
let observationTitles: Record<string, string> = {
  'known-exfiltration-sink': 'Outbound endpoint reference',
  'sensitive-file-access': 'Credential path reference',
  'reviewer-targeting': 'Review-related instructions',
  'path-traversal': 'Parent-directory path',
  persistence: 'Persistent configuration reference'
};

export let scriptExtensions = new Set([
  'py',
  'sh',
  'bash',
  'zsh',
  'js',
  'mjs',
  'cjs',
  'ts',
  'rb',
  'ps1',
  'bat',
  'cmd',
  'pl'
]);
let skipBlobExtensions = new Set(['svg', 'json', 'lock', 'csv', 'map']);

export type SkillTextFile = {
  path: string;
  content: string;
  inAgentView: boolean;
  ships: boolean;
};

export type SkillInventoryEntry = {
  path: string;
  size: number;
  kind: SecurityFileKind;
  detectedMime: string | null;
  isDisguised: boolean;
  ships: boolean;
  notRead?: 'too_large' | 'unreadable' | 'not_shown';
};

export type InstructionHit = { familyName: string; matchedText: string };

export type SkillScanInput = {
  texts: SkillTextFile[];
  inventory: SkillInventoryEntry[];
  instructionHits: Record<string, InstructionHit[]>;
};

export type SkillScanResult = {
  observations: SecurityReviewObservation[];
  findings: SecurityReportFinding[];
  behaviors: SecurityReportBehavior[];
  facts: LedgerFact[];
};

type Hit = { path: string; line: number; inAgentView: boolean; text: string };

type LineRule = {
  id: string;
  category: SecurityFindingCategoryKey;
  severity: SecurityFindingSeverityLevel;
  title: string;
  body: string;
  recommendation: string;
  patterns: RegExp[];
  codeOnly?: boolean;
  behavior?: SecuritySkillCapabilityTag;
};

let normalizePath = (path: string) => path.replace(/^\/+/, '');

let extensionOf = (path: string) => {
  let base = path.split('/').pop() ?? path;
  let index = base.lastIndexOf('.');
  return index > 0 ? base.slice(index + 1).toLowerCase() : '';
};

let isScript = (path: string) => scriptExtensions.has(extensionOf(path));

let isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path);

let isSkillRoot = (path: string) => normalizePath(path).toLowerCase() == 'skill.md';

export let TAG_CODE_POINT_START = 0xe0000;
export let TAG_CODE_POINT_END = 0xe007f;

let tagPattern = /[\u{E0000}-\u{E007F}]+/gu;
let zeroWidthPattern = /[​‌‎‏⁠-⁤]/g;
let bidiPattern = /[‪-‮⁦-⁩]/g;

export let sanitizeForReview = (content: string) =>
  content
    .replace(tagPattern, run => {
      let decoded = [...run]
        .map(char => {
          let code = char.codePointAt(0)! - TAG_CODE_POINT_START;
          return code >= 0x20 && code < 0x7f
            ? String.fromCharCode(code)
            : `U+${code.toString(16)}`;
        })
        .join('');
      return `⟦hidden tag characters: ${decoded}⟧`;
    })
    .replace(bidiPattern, char => `⟦U+${char.codePointAt(0)!.toString(16).toUpperCase()}⟧`)
    .replace(
      zeroWidthPattern,
      char => `⟦U+${char.codePointAt(0)!.toString(16).toUpperCase()}⟧`
    )
    .replace(/(?<!^)﻿/g, '⟦U+FEFF⟧');

let lineRules: LineRule[] = [
  {
    id: 'remote-code-execution',
    category: 'remote_code',
    severity: 'high',
    title: 'Downloads and runs remote code',
    body: 'The skill pipes downloaded content into a shell or interpreter, or downloads a file and runs it. Whatever the remote server serves at that moment runs on the user machine.',
    recommendation: 'Ship the code in the skill or pin it by checksum so it can be reviewed.',
    patterns: [
      /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i,
      /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(python3?|node|perl|ruby)\b/i,
      /\b(ba|z)?sh\s+<\(\s*(curl|wget)\b/i,
      /\beval\s+["'`]?\$\(\s*(curl|wget)\b/i,
      /\b(iex|invoke-expression)\b[^\n]*\b(irm|iwr|invoke-webrequest|invoke-restmethod|downloadstring)\b/i,
      /\b(curl|wget)\b[^\n]*(-o|-O|--output)\s*\S+[^\n]*(&&|;)\s*(chmod\s+\+x|\.\/|(ba)?sh\b)/i,
      /base64\s+(-d|--decode)\b[^\n]*\|\s*(ba)?sh\b/i,
      /powershell[^\n]*\s-(enc|encodedcommand)\b/i
    ],
    behavior: 'code_execution'
  },
  {
    id: 'password-protected-archive',
    category: 'remote_code',
    severity: 'medium',
    title: 'Asks to unpack a password-protected archive',
    body: 'Password-protected archives cannot be scanned and are a common way to deliver payloads.',
    recommendation: 'Ship the files unpacked.',
    patterns: [
      /password[- ]protected\s+(zip|archive|file)/i,
      /\bunzip\s+-P\b/i,
      /\b7z\s+x\b[^\n]*\s-p\S+/i
    ]
  },
  {
    id: 'remote-instructions',
    category: 'remote_instructions',
    severity: 'medium',
    title: 'Tells the agent to follow instructions from a URL',
    body: 'The skill points the agent at remote content as a source of instructions. That content can change after this review and is not covered by it.',
    recommendation:
      'Copy the instructions into the skill so changes are versioned and reviewed.',
    patterns: [
      /\b(fetch|download|load|follow|obey|apply|visit|open|read)\b[^\n]{0,80}https?:\/\/\S+[^\n]{0,120}\b(instructions?|prompts?|rules|guidelines|directives?|playbook)\b/i,
      /\b(instructions?|prompts?|rules|guidelines|directives?|playbook)\b[^\n]{0,80}\b(from|at|in)\b[^\n]{0,20}https?:\/\/\S+[^\n]{0,60}\b(fetch|download|load|follow|obey|apply)\b/i
    ]
  },
  {
    id: 'sensitive-file-access',
    category: 'exfiltration',
    severity: 'medium',
    title: 'Reads credentials or private files outside the skill',
    body: 'The skill reads locations that hold credentials, keys or browser data. Skills rarely need these.',
    recommendation: 'Remove the access or document exactly why it is required.',
    patterns: [
      /(~\/|\$HOME\/|\$\{HOME\}\/|%USERPROFILE%\\)\.(ssh|aws|gnupg|kube|azure|netrc|npmrc|pypirc|git-credentials|docker\/config\.json|config\/gcloud)\b/i,
      /\bid_(rsa|ed25519|ecdsa)\b/,
      /\/etc\/(passwd|shadow)\b/,
      /(Library\/Keychains|login\.keychain|Login Data|Cookies\.sqlite|Local State)\b/i,
      /\bsecurity\s+find-(generic|internet)-password\b/i
    ],
    behavior: 'credential_access'
  },
  {
    id: 'known-exfiltration-sink',
    category: 'exfiltration',
    severity: 'high',
    title: 'Sends data to a known exfiltration or paste endpoint',
    body: 'The skill references a hosted request-capture, paste or tunnelling service that is commonly used to receive stolen data.',
    recommendation: 'Remove the endpoint.',
    patterns: [
      /discord(app)?\.com\/api\/webhooks/i,
      /hooks\.slack\.com\/services/i,
      /\b(webhook\.site|requestbin|pipedream\.net|pastebin\.com|transfer\.sh|ngrok(-free)?\.(io|app|dev)|interact\.sh|oast\.\w+|burpcollaborator\.net)\b/i
    ],
    behavior: 'network_egress'
  },
  {
    id: 'persistence',
    category: 'persistence',
    severity: 'high',
    title: 'Modifies shell startup, schedulers, hooks or agent configuration',
    body: 'The skill writes to places that run again later or change how the agent behaves: shell startup files, cron, launchd, systemd, git hooks, or agent settings and memory files.',
    recommendation: 'Remove the modification. A skill should not outlive its own use.',
    patterns: [
      /(~\/|\$HOME\/)\.(bashrc|zshrc|zprofile|profile|bash_profile|zshenv)\b/,
      /\bcrontab\b/i,
      /\blaunchctl\b|LaunchAgents|LaunchDaemons/,
      /\bsystemctl\s+(--user\s+)?enable\b|\/etc\/systemd\//,
      /\.git\/hooks\//,
      /\bauthorized_keys\b/,
      /(~\/|\$HOME\/)\.(claude|cursor|codex)\/(settings|CLAUDE|config)/i,
      /\b(append|add|write|echo)\b[^\n]*\b(CLAUDE\.md|AGENTS\.md|MEMORY\.md|\.cursorrules)\b/i
    ],
    behavior: 'persistence'
  },
  {
    id: 'destructive-command',
    category: 'over_privilege',
    severity: 'high',
    title: 'Contains a destructive or permission-widening command',
    body: 'The skill runs commands that delete broad paths or open permissions wide.',
    recommendation: 'Scope the command to a specific path inside the skill workspace.',
    patterns: [
      /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$|\/\*)/i,
      /\bchmod\s+(-R\s+)?(777|a\+rwx)\b/,
      /--dangerously-skip-permissions|bypassPermissions/
    ],
    codeOnly: true
  },
  {
    id: 'path-traversal',
    category: 'over_privilege',
    severity: 'medium',
    title: 'Reaches outside the skill directory',
    body: 'The skill navigates to parent directories, which gives it access to files that are not part of the skill.',
    recommendation: 'Keep file access inside the skill directory.',
    patterns: [/(\.\.\/){2,}/],
    behavior: 'filesystem_outside_skill'
  },
  {
    id: 'registry-redirect',
    category: 'supply_chain',
    severity: 'high',
    title: 'Redirects package installs to a non-default registry',
    body: 'The skill changes the package registry or index. Packages installed afterwards can come from an attacker-controlled source.',
    recommendation: 'Use the default registry and pin dependencies with hashes.',
    patterns: [
      /\bnpm\s+config\s+set\s+registry\b/i,
      /--registry[= ]https?:\/\/(?!registry\.npmjs\.org)\S+/i,
      /(--index-url|--extra-index-url)[= ]https?:\/\/(?!pypi\.org)\S+/i,
      /\bpip3?\s+config\s+set\s+global\.index-url\b/i
    ]
  },
  {
    id: 'install-from-url',
    category: 'supply_chain',
    severity: 'medium',
    title: 'Installs a package directly from a URL or repository',
    body: 'Packages installed from an arbitrary URL or git ref bypass registry scanning and can change at any time.',
    recommendation: 'Install a pinned version from the registry.',
    patterns: [
      /\bpip3?\s+install\s+[^\n]*(git\+|https?:\/\/)/i,
      /\b(npm|pnpm|yarn|bun)\s+(i|install|add)\s+[^\n]*(git\+|https?:\/\/|github:)/i
    ],
    behavior: 'package_install'
  },
  {
    id: 'package-install',
    category: 'supply_chain',
    severity: 'info',
    title: 'Installs packages',
    body: 'The skill installs software on the machine it runs on.',
    recommendation: 'Pin versions.',
    patterns: [
      /\b(pip3?|pipx|npm|pnpm|yarn|bun|brew|apt(-get)?|cargo|gem|go)\s+(install|add|i)\b/i
    ],
    codeOnly: true,
    behavior: 'package_install'
  },
  {
    id: 'hidden-from-user',
    category: 'instruction_manipulation',
    severity: 'high',
    title: 'Tells the agent to hide actions from the user',
    body: 'The skill instructs the agent to conceal what it does from the user, or to ignore earlier instructions and safeguards.',
    recommendation:
      'Remove the instruction. Skills should not ask the agent to conceal actions.',
    patterns: [
      /\b(do not|don'?t|never)\s+(tell|inform|mention|reveal|show|notify)\s+(this\s+)?(to\s+)?(the\s+)?user\b/i,
      /\bwithout\s+(telling|informing|notifying|asking)\s+(the\s+)?user\b/i,
      /\bignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts)\b/i,
      /\b(disable|turn off|bypass)\s+(the\s+)?(safety|security|permission|confirmation)\b/i,
      /<\/?(system|developer)>|\[(system|developer)\]/i
    ]
  },
  {
    id: 'reviewer-targeting',
    category: 'reviewer_targeting',
    severity: 'high',
    title: 'Contains text aimed at a security reviewer',
    body: 'The skill contains text that addresses an AI reviewer or scanner, or tries to influence its rating. Legitimate skills never talk to the review process.',
    recommendation: 'Remove the text.',
    patterns: [
      /\b(security|safety|code)\s+(review(er)?|audit(or)?|scanner)s?\b[^\n]{0,80}\b(should|must|ignore|skip|approve|pass|rate|mark|classify)\b/i,
      /\b(rate|score|mark|classify|label|report|treat)\s+(this|it|the skill)\s+(as\s+)?(safe|secure|trusted|benign|harmless|low[- ]risk|clean)\b/i,
      /\b(ai|llm|automated|model)[- ]?(reviewer|scanner|analy[sz]er|auditor)\b/i,
      /\bif you are\s+(an?\s+)?(ai|llm|language model|reviewer|scanner|auditor)\b/i
    ]
  },
  {
    id: 'financial-action',
    category: 'agentic_abuse',
    severity: 'info',
    title: 'Involves moving money or handling wallet secrets',
    body: 'The skill mentions transferring funds, wallets, seed phrases or private keys.',
    recommendation: 'Make sure the user confirms every transaction.',
    patterns: [
      /\b(wire transfer|send (money|funds|crypto|bitcoin)|seed phrase|mnemonic phrase|wallet\.(send|transfer))\b/i
    ],
    behavior: 'financial'
  },
  {
    id: 'mcp-dependency',
    category: 'over_privilege',
    severity: 'info',
    title: 'Depends on MCP tools',
    body: 'The skill references MCP tools or servers.',
    recommendation: 'Check that the referenced servers are trusted.',
    patterns: [/\bmcp__\w+/],
    behavior: 'mcp_dependency'
  }
];

let networkSendPatterns = [
  /\b(curl|wget)\b[^\n]*(\s-d\b|--data|\s-F\b|--form|--upload-file|\s-T\b|-X\s*(POST|PUT))/i,
  /\b(requests|httpx)\.(post|put|patch)\(/,
  /\bfetch\(\s*[^)]*method:\s*['"](POST|PUT)/i,
  /\burllib\.request\.urlopen\(/,
  /\bnc\s+\S+\s+\d+/
];

let networkEgressPatterns = [
  ...networkSendPatterns,
  /\b(requests|httpx)\.(get|head)\(/,
  /\bfetch\(\s*['"`]https?:/,
  /\baxios\b/,
  /\b(curl|wget)\s+\S/,
  /\bhttp\.client\b|\bimport\s+socket\b/
];

let unpackVerbs = /\b(unzip|tar\s+-?[a-z]*x|extract|unpack|decompress|7z\s+x|gunzip)\b/i;
let runVerbs = /\b(run|execute|exec|chmod\s+\+x|start|launch|\.\/)\b/i;

let slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

let evidenceRef = (hit: Hit): SecurityLedgerRef =>
  hit.inAgentView
    ? {
        type: 'file',
        path: `${EVIDENCE_PREFIX}${normalizePath(hit.path)}`,
        lines: [hit.line, hit.line]
      }
    : { type: 'fact', id: 'inventory' };

let fileRef = (path: string): SecurityLedgerRef => ({
  type: 'file',
  path: `${EVIDENCE_PREFIX}${normalizePath(path)}`
});

let uniqueRefs = (refs: SecurityLedgerRef[]) => {
  let seen = new Set<string>();
  return refs
    .filter(ref => {
      let key = JSON.stringify(ref);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_REFS_PER_FINDING);
};

let pathsOf = (hits: Hit[]) => [...new Set(hits.map(hit => normalizePath(hit.path)))];

let scanLines = (texts: SkillTextFile[], rule: LineRule) => {
  let hits: Hit[] = [];

  for (let file of texts) {
    let script = isScript(file.path);
    let inFence = false;

    file.content.split('\n').forEach((text, index) => {
      if (isMarkdown(file.path) && /^\s*(```|~~~)/.test(text)) {
        inFence = !inFence;
        return;
      }

      if (rule.codeOnly && !script && !inFence && !/^\s*\$\s/.test(text)) return;
      if (!rule.patterns.some(pattern => pattern.test(text))) return;

      hits.push({ path: file.path, line: index + 1, inAgentView: file.inAgentView, text });
    });
  }

  return hits;
};

let describeHits = (hits: Hit[]) =>
  hits
    .slice(0, 10)
    .map(hit => `${normalizePath(hit.path)}:${hit.line}  ${hit.text.trim().slice(0, 160)}`)
    .join('\n');

let referencesBinary = (texts: SkillTextFile[], path: string, verbs: RegExp) => {
  let base = normalizePath(path).split('/').pop()!;

  return texts.some(file =>
    file.content.split('\n').some(line => line.includes(base) && verbs.test(line))
  );
};

let frontmatterOf = (content: string) => {
  let match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1]! : '';
};

export let scanSkill = (d: SkillScanInput): SkillScanResult => {
  let findings: SecurityReportFinding[] = [];
  let observations: SecurityReviewObservation[] = [];
  let facts: LedgerFact[] = [];
  let behaviorMap = new Map<SecuritySkillCapabilityTag, SecurityReportBehavior>();

  let addBehavior = (
    tag: SecuritySkillCapabilityTag,
    body: string,
    refs: SecurityLedgerRef[],
    observationKey?: string
  ) => {
    let existing = behaviorMap.get(tag);
    behaviorMap.set(tag, {
      tag,
      unclassified: tag != 'subagents',
      observationKeys: [
        ...new Set([
          ...(existing?.observationKeys ?? []),
          ...(observationKey ? [observationKey] : [])
        ])
      ],
      body: existing?.body ?? body,
      evidence: uniqueRefs([...(existing?.evidence ?? []), ...refs])
    });
  };

  let addFinding = (
    finding: Omit<SecurityReportFinding, 'kind' | 'tools'>,
    factDetail: string
  ) => {
    let factId = `finding-${finding.key}`.slice(0, 60);
    let title = finding.key.startsWith('disguised-file-')
      ? finding.title
      : (observationTitles[finding.key] ?? `Pattern match: ${finding.title}`);
    facts.push({ id: factId, title, detail: factDetail });

    if (!finding.key.startsWith('disguised-file-')) {
      observations.push({
        key: finding.key,
        title,
        detail: `${finding.body}\nMatched evidence: ${factDetail}\nThis is an unconfirmed observation; examine the source context before judging its security impact.`,
        evidence: uniqueRefs([...finding.evidence, { type: 'fact', id: factId }])
      });
      return;
    }

    findings.push({
      ...finding,
      kind: 'security',
      tools: [],
      evidence: uniqueRefs([...finding.evidence, { type: 'fact', id: factId }])
    });
  };

  let sendHitsByFile = new Map<string, boolean>();
  for (let file of d.texts) {
    sendHitsByFile.set(
      normalizePath(file.path),
      file.content
        .split('\n')
        .some(line => networkSendPatterns.some(pattern => pattern.test(line)))
    );
  }

  for (let rule of lineRules) {
    let hits = scanLines(d.texts, rule);
    if (!hits.length) continue;

    let refs = hits.map(evidenceRef);

    if (rule.behavior) {
      addBehavior(rule.behavior, rule.title, refs, rule.id);
    }
    if (rule.severity == 'info') continue;

    let severity = rule.severity;
    if (
      rule.id == 'sensitive-file-access' &&
      hits.some(hit => sendHitsByFile.get(normalizePath(hit.path)))
    ) {
      severity = 'high';
      addBehavior('network_egress', 'Sends data over the network', refs, rule.id);
    }

    addFinding(
      {
        key: rule.id,
        category: rule.category,
        severity,
        title: rule.title,
        body: `${rule.body} Found in ${pathsOf(hits).slice(0, 3).join(', ')}.`,
        recommendation: rule.recommendation,
        evidence: refs
      },
      describeHits(hits)
    );
  }

  let networkHits: Hit[] = [];
  for (let file of d.texts) {
    if (!isScript(file.path)) continue;
    file.content.split('\n').forEach((text, index) => {
      if (networkEgressPatterns.some(pattern => pattern.test(text))) {
        networkHits.push({
          path: file.path,
          line: index + 1,
          inAgentView: file.inAgentView,
          text
        });
      }
    });
  }
  if (networkHits.length) {
    addBehavior(
      'network_egress',
      'Scripts make network requests',
      networkHits.map(evidenceRef)
    );
  }

  let shippedScripts = d.texts.filter(file => isScript(file.path));
  if (shippedScripts.length) {
    addBehavior(
      'code_execution',
      `Ships ${shippedScripts.length} script${shippedScripts.length == 1 ? '' : 's'} that run on the user machine`,
      shippedScripts.map(file => fileRef(file.path))
    );
  }

  let agentFiles = d.inventory.filter(entry => /^agents\//i.test(normalizePath(entry.path)));
  if (agentFiles.length) {
    addBehavior(
      'subagents',
      'Defines subagents that run with their own instructions',
      agentFiles.map(entry => fileRef(entry.path))
    );
  }
  if (d.inventory.some(entry => normalizePath(entry.path).toLowerCase() == '.mcp.json')) {
    addBehavior('mcp_dependency', 'Ships an MCP server configuration', [fileRef('.mcp.json')]);
  }

  for (let file of d.texts) {
    if (!isSkillRoot(file.path)) continue;

    let frontmatter = frontmatterOf(file.content);
    let allowed = frontmatter.match(/^allowed-tools:\s*(.*(?:\n\s+-.*)*)/im)?.[1] ?? '';

    if (/(^|[\s,\-\[])Bash(?!\()|Bash\(\*\)|(^|[\s,\-\[])\*(\s|,|\]|$)/.test(allowed)) {
      addFinding(
        {
          key: 'unrestricted-shell',
          category: 'over_privilege',
          severity: 'medium',
          title: 'Grants unrestricted shell access',
          body: 'The skill declares allowed-tools that include an unrestricted shell, so the agent can run any command without asking.',
          recommendation:
            'Restrict allowed-tools to specific command patterns, for example Bash(git status:*).',
          evidence: [fileRef(file.path)]
        },
        `allowed-tools: ${allowed.trim()}`
      );
      addBehavior(
        'code_execution',
        'Declares unrestricted shell access',
        [fileRef(file.path)],
        'unrestricted-shell'
      );
    }

    let description = frontmatter.match(/^description:\s*(.*)$/im)?.[1] ?? '';
    if (
      /\b(always|every (task|request|conversation|message)|any (task|request)|for everything)\b/i.test(
        description
      )
    ) {
      addFinding(
        {
          key: 'over-broad-trigger',
          category: 'trigger_abuse',
          severity: 'low',
          title: 'Description activates the skill on almost everything',
          body: 'The description tells the agent to use this skill for every task, which makes it run in situations the author never reviewed.',
          recommendation: 'Describe the specific situations that should activate the skill.',
          evidence: [fileRef(file.path)]
        },
        `description: ${description.slice(0, 300)}`
      );
    }
  }

  let secrets = scanSecrets(
    Object.fromEntries(d.texts.map(file => [file.path, file.content]))
  );
  for (let [kind, hits] of groupByKind(secrets)) {
    let hitList: Hit[] = hits.map(hit => ({
      path: hit.path,
      line: hit.line,
      inAgentView: d.texts.find(file => file.path == hit.path)?.inAgentView ?? false,
      text: kind
    }));

    addFinding(
      {
        key: `hardcoded-secret-${slug(kind)}`,
        category: 'credentials',
        severity: kind == 'hardcoded_credential' ? 'high' : 'critical',
        title: `Contains a hard-coded ${kind.replace(/_/g, ' ')}`,
        body: `A value that looks like a ${kind.replace(/_/g, ' ')} is written into ${pathsOf(hitList).slice(0, 3).join(', ')}. Anyone with the skill can read and reuse it.`,
        recommendation: 'Rotate the credential and remove it from the skill.',
        evidence: hitList.map(evidenceRef)
      },
      hitList.map(hit => `${normalizePath(hit.path)}:${hit.line}`).join('\n')
    );
  }

  for (let file of d.texts) {
    let hits = d.instructionHits[file.path] ?? [];
    if (!hits.length) continue;

    addFinding(
      {
        key: `injection-pattern-${slug(normalizePath(file.path))}`,
        category: 'instruction_manipulation',
        severity: 'medium',
        title: `${normalizePath(file.path)} matches prompt-injection patterns`,
        body: `ProtoGuard matched ${[...new Set(hits.map(hit => hit.familyName.toLowerCase()))].slice(0, 4).join(', ')}. This may be legitimate documentation about injection, or an attempt to steer the agent.`,
        recommendation: 'Check whether the text is meant to instruct the agent.',
        evidence: [fileRef(file.path)]
      },
      hits
        .slice(0, 10)
        .map(hit => `${hit.familyName}: "${hit.matchedText.slice(0, 120)}"`)
        .join('\n')
    );
  }

  let hiddenHits: Record<
    string,
    { hits: Hit[]; severity: SecurityFindingSeverityLevel; title: string }
  > = {};
  let addHidden = (
    id: string,
    severity: SecurityFindingSeverityLevel,
    title: string,
    hit: Hit
  ) => {
    hiddenHits[id] ??= { hits: [], severity, title };
    hiddenHits[id]!.hits.push(hit);
  };

  for (let file of d.texts) {
    let lines = file.content.split('\n');

    lines.forEach((text, index) => {
      let hit: Hit = {
        path: file.path,
        line: index + 1,
        inAgentView: file.inAgentView,
        text: ''
      };

      if (new RegExp(tagPattern.source, 'u').test(text)) {
        addHidden(
          'hidden-tag-characters',
          'high',
          'Contains invisible Unicode tag characters',
          hit
        );
      }
      if (new RegExp(bidiPattern.source).test(text)) {
        addHidden(
          'bidirectional-controls',
          isScript(file.path) ? 'high' : 'medium',
          'Contains bidirectional text controls that can disguise content',
          hit
        );
      }
      if ((text.match(zeroWidthPattern)?.length ?? 0) >= ZERO_WIDTH_THRESHOLD) {
        addHidden(
          'zero-width-characters',
          'medium',
          'Contains runs of zero-width characters',
          hit
        );
      }
      if (
        !skipBlobExtensions.has(extensionOf(file.path)) &&
        new RegExp(`[A-Za-z0-9+/]{${ENCODED_BLOB_LENGTH},}={0,2}`).test(text)
      ) {
        addHidden('encoded-blob', 'low', 'Contains a long encoded blob', hit);
      }
    });

    if (isMarkdown(file.path)) {
      for (let comment of file.content.matchAll(/<!--([\s\S]*?)-->/g)) {
        if (comment[1]!.trim().length < HIDDEN_COMMENT_LENGTH) continue;

        addHidden(
          'hidden-comment',
          'medium',
          'Contains long HTML comments the agent can read but the user cannot see',
          {
            path: file.path,
            line: file.content.slice(0, comment.index).split('\n').length,
            inAgentView: file.inAgentView,
            text: ''
          }
        );
      }
    }

    if (new RegExp(`\\s{${PADDING_RUN_LENGTH},}`).test(file.content)) {
      addHidden(
        'whitespace-padding',
        'medium',
        'Pads the file with whitespace, which can push content out of view',
        {
          path: file.path,
          line: 1,
          inAgentView: file.inAgentView,
          text: ''
        }
      );
    } else if (file.content.length > PADDING_MIN_BYTES) {
      let whitespace = file.content.length - file.content.replace(/\s/g, '').length;
      if (whitespace / file.content.length > PADDING_RATIO) {
        addHidden(
          'whitespace-padding',
          'medium',
          'Pads the file with whitespace, which can push content out of view',
          {
            path: file.path,
            line: 1,
            inAgentView: file.inAgentView,
            text: ''
          }
        );
      }
    }
  }

  for (let [id, entry] of Object.entries(hiddenHits)) {
    addFinding(
      {
        key: id,
        category: 'hidden_content',
        severity: entry.severity,
        title: entry.title,
        body: `${entry.title} in ${pathsOf(entry.hits).slice(0, 3).join(', ')}. Hidden content can carry instructions that a human reviewer does not see.`,
        recommendation: 'Remove the hidden content.',
        evidence: entry.hits.map(evidenceRef)
      },
      pathsOf(entry.hits)
        .map(
          path =>
            `${path} (${entry.hits.filter(hit => normalizePath(hit.path) == path).length} lines)`
        )
        .join('\n')
    );
  }

  for (let entry of d.inventory) {
    let path = normalizePath(entry.path);
    let evidence = [
      fileRef(entry.path),
      { type: 'fact', id: 'inventory' } as SecurityLedgerRef
    ];
    let label = entry.detectedMime ? `${entry.kind} (${entry.detectedMime})` : entry.kind;

    if (entry.isDisguised) {
      addFinding(
        {
          key: `disguised-file-${slug(path)}`,
          category: 'opaque_content',
          severity: 'high',
          title: `${path} is not the file type its name claims`,
          body: `The extension of ${path} suggests a different type than its contents, which are ${label}. Disguising executables or archives as documents or images is a known way to hide payloads.`,
          recommendation: 'Remove the file or rename it to match its real type.',
          evidence
        },
        `${path}: contents are ${label}, extension is .${extensionOf(path)}`
      );
    } else if (entry.kind == 'executable') {
      let executed = referencesBinary(d.texts, path, runVerbs);
      addFinding(
        {
          key: `executable-${slug(path)}`,
          category: 'opaque_content',
          severity: executed ? 'high' : 'medium',
          title: `${path} is a compiled executable that cannot be reviewed`,
          body: `${path} is ${label}. Compiled code cannot be inspected by this review${executed ? ', and the skill instructs the agent to run it' : ''}.`,
          recommendation: 'Ship source code instead of a compiled binary.',
          evidence
        },
        `${path}: ${label}, ${entry.size} bytes`
      );
      addBehavior('binary_payload', 'Ships compiled code that cannot be reviewed', [
        fileRef(entry.path)
      ]);
    } else if (entry.kind == 'archive') {
      let unpacked = referencesBinary(d.texts, path, unpackVerbs);
      addFinding(
        {
          key: `archive-${slug(path)}`,
          category: 'opaque_content',
          severity: unpacked ? 'medium' : 'low',
          title: `${path} is an archive whose contents cannot be reviewed`,
          body: `${path} is ${label}. Archives are never opened by this review${unpacked ? ', and the skill instructs the agent to unpack it' : ''}, so what they contain is not covered.`,
          recommendation: 'Ship the files unpacked.',
          evidence
        },
        `${path}: ${label}, ${entry.size} bytes`
      );
    } else if (entry.kind == 'unknown_binary' && !entry.notRead) {
      addFinding(
        {
          key: `unknown-binary-${slug(path)}`,
          category: 'opaque_content',
          severity: 'low',
          title: `${path} is a binary file of unknown type`,
          body: `${path} is not text and matches no known format, so it was not analysed.`,
          recommendation: 'Remove the file if it is not needed.',
          evidence
        },
        `${path}: ${entry.size} bytes`
      );
    } else if (entry.notRead == 'too_large') {
      addFinding(
        {
          key: `unread-large-text-${slug(path)}`,
          category: 'opaque_content',
          severity: 'low',
          title: `${path} is too large to review`,
          body: `${path} is a text file of ${entry.size} bytes, above the size this review reads.`,
          recommendation: 'Split or remove the file.',
          evidence
        },
        `${path}: ${entry.size} bytes, not read`
      );
    }
  }

  for (let file of d.texts.filter(file => /\.(sh|bash|zsh)$/i.test(file.path))) {
    let lines = file.content.split('\n');
    let line = lines.findIndex(line =>
      /^\s*cat\s+[^|]*(?:\.aws\/credentials|\.ssh\/id_(?:rsa|ed25519))[^|]*\|\s*curl\b[^\n]*(?:--data(?:-binary)?|\s-d)\s+@-/i.test(
        line
      )
    );
    if (line < 0) continue;

    let refs = [
      evidenceRef({
        path: file.path,
        line: line + 1,
        inAgentView: file.inAgentView,
        text: lines[line]!
      })
    ];
    findings.push({
      key: 'credential-exfiltration',
      kind: 'security',
      category: 'exfiltration',
      severity: 'critical',
      title: 'Uploads credential files',
      body: 'A shell pipeline sends a credential file directly in an outbound request.',
      recommendation: 'Remove the upload and rotate affected credentials.',
      tools: [],
      evidence: refs
    });
  }

  let kinds = [...groupByKind(d.inventory)]
    .map(([kind, entries]) => `${kind}: ${entries.length}`)
    .join(', ');
  facts.push({
    id: 'inventory',
    title: `${d.inventory.length} files in this skill`,
    detail: `${kinds}\n\n${d.inventory
      .slice(0, 300)
      .map(
        entry =>
          `${normalizePath(entry.path)}  ${entry.kind}  ${entry.size} bytes${entry.ships ? '' : '  (not shipped under the default configuration)'}`
      )
      .join('\n')}`
  });

  return { findings, observations, behaviors: [...behaviorMap.values()], facts };
};
