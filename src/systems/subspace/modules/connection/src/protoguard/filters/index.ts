import { DEFAULT_ALERT_CONFIDENCE_THRESHOLD } from '../config';
import type {
  ProtoGuardCheckContext,
  ProtoGuardFilterDefinition,
  ProtoGuardMatch,
  ProtoGuardScanTarget
} from '../types';

type Pattern = {
  regex: RegExp;
  confidence: number;
  description: string;
};

let collectRegexMatches = (target: ProtoGuardScanTarget, patterns: Pattern[]) => {
  let matches: ProtoGuardMatch[] = [];

  for (let pattern of patterns) {
    let regex = new RegExp(
      pattern.regex.source,
      pattern.regex.flags.includes('g') ? pattern.regex.flags : `${pattern.regex.flags}g`
    );

    for (let match = regex.exec(target.content); match; match = regex.exec(target.content)) {
      let matchedText = match[0] ?? '';
      if (!matchedText) {
        regex.lastIndex++;
        continue;
      }

      matches.push({
        path: target.path,
        startOffset: match.index,
        endOffset: match.index + matchedText.length,
        matchedText,
        confidence: pattern.confidence,
        description: pattern.description
      });
    }
  }

  return matches;
};

let checkPatterns = (patterns: Pattern[]) => (ctx: ProtoGuardCheckContext) => ({
  matches: ctx.targets.flatMap(target => collectRegexMatches(target, patterns))
});

let hasDangerousInstruction = (value: string) =>
  [
    /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|context)\b/i,
    /\b(disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|context)\b/i,
    /\bsystem\s+override\b/i,
    /\breveal\s+(your\s+)?(system\s+)?prompt\b/i,
    /\bdeveloper\s+mode\b/i,
    /\btool_calls?\b/i
  ].some(regex => regex.test(value));

let decodeHex = (value: string) => {
  if (value.length % 2 !== 0) return null;

  let output = '';
  for (let i = 0; i < value.length; i += 2) {
    let code = Number.parseInt(value.slice(i, i + 2), 16);
    if (Number.isNaN(code)) return null;
    output += String.fromCharCode(code);
  }

  return output;
};

let decodeBase64 = (value: string) => {
  try {
    return atob(value);
  } catch {
    return null;
  }
};

let encodedPayloadCheck = (ctx: ProtoGuardCheckContext) => {
  let matches: ProtoGuardMatch[] = [];
  let encodedPattern = /\b(?:[A-Za-z0-9+/]{24,}={0,2}|(?:[a-fA-F0-9]{2}){12,})\b/g;

  for (let target of ctx.targets) {
    for (
      let match = encodedPattern.exec(target.content);
      match;
      match = encodedPattern.exec(target.content)
    ) {
      let matchedText = match[0] ?? '';
      let decoded =
        /^[a-fA-F0-9]+$/.test(matchedText) && matchedText.length % 2 === 0
          ? decodeHex(matchedText)
          : decodeBase64(matchedText);

      if (!decoded || !hasDangerousInstruction(decoded)) continue;

      matches.push({
        path: target.path,
        startOffset: match.index,
        endOffset: match.index + matchedText.length,
        matchedText,
        confidence: 0.85,
        description: 'Encoded payload decodes to prompt-injection instructions.',
        metadata: { decodedSample: decoded.slice(0, 200) }
      });
    }
  }

  return { matches };
};

let isTypoglycemiaVariant = (word: string, target: string) => {
  if (word === target) return false;
  if (word.length !== target.length || word.length < 4) return false;
  if (word[0] !== target[0] || word[word.length - 1] !== target[target.length - 1]) {
    return false;
  }

  return (
    word.slice(1, -1).split('').sort().join('') ===
    target.slice(1, -1).split('').sort().join('')
  );
};

let typoglycemiaCheck = (ctx: ProtoGuardCheckContext) => {
  let dangerousWords = ['ignore', 'bypass', 'override', 'reveal', 'system'];
  let wordPattern = /\b[a-zA-Z]{4,}\b/g;
  let matches: ProtoGuardMatch[] = [];

  for (let target of ctx.targets) {
    for (
      let match = wordPattern.exec(target.content);
      match;
      match = wordPattern.exec(target.content)
    ) {
      let matchedText = match[0] ?? '';
      let normalized = matchedText.toLowerCase();
      let targetWord = dangerousWords.find(word => isTypoglycemiaVariant(normalized, word));
      if (!targetWord) continue;

      matches.push({
        path: target.path,
        startOffset: match.index,
        endOffset: match.index + matchedText.length,
        matchedText,
        confidence: 0.62,
        description: `Possible typoglycemia obfuscation of "${targetWord}".`,
        metadata: { targetWord }
      });
    }
  }

  return { matches };
};

let defineFilter = (
  d: Omit<ProtoGuardFilterDefinition, 'defaultEnabled' | 'alertConfidenceThreshold'>
): ProtoGuardFilterDefinition => ({
  ...d,
  defaultEnabled: true,
  alertConfidenceThreshold: DEFAULT_ALERT_CONFIDENCE_THRESHOLD
});

export let protoGuardFilterDefinitions: ProtoGuardFilterDefinition[] = [
  defineFilter({
    key: 'instruction_override',
    name: 'Instruction override',
    description: 'Detects attempts to ignore, forget, or replace existing instructions.',
    issueType: 'instruction_override',
    severity: 'high',
    scoreWeight: 0.9,
    check: checkPatterns([
      {
        regex:
          /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|context)\b/i,
        confidence: 0.92,
        description: 'Attempts to ignore previous instructions.'
      },
      {
        regex:
          /\b(disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|context)\b/i,
        confidence: 0.9,
        description: 'Attempts to discard existing instructions.'
      },
      {
        regex: /\b(new\s+directive|system\s+override|override\s+(the\s+)?system)\b/i,
        confidence: 0.86,
        description: 'Attempts to introduce a new overriding directive.'
      }
    ])
  }),
  defineFilter({
    key: 'role_hijack',
    name: 'Role hijack',
    description: 'Detects attempts to force the model into a different role.',
    issueType: 'role_hijack',
    severity: 'medium',
    scoreWeight: 0.65,
    check: checkPatterns([
      {
        regex:
          /\byou\s+are\s+now\s+(?:DAN|an?\s+unrestricted|jailbroken|in\s+developer\s+mode|[^.]{0,60})/i,
        confidence: 0.72,
        description: 'Attempts to assign a new role to the model.'
      },
      {
        regex:
          /\b(act|pretend)\s+as\s+(?:if\s+)?(?:you\s+are\s+)?(?:an?\s+)?(?:different|unrestricted|jailbroken|developer)/i,
        confidence: 0.72,
        description: 'Attempts to role-play around instruction boundaries.'
      }
    ])
  }),
  defineFilter({
    key: 'jailbreak_persona',
    name: 'Jailbreak persona',
    description: 'Detects known jailbreak persona and safety-bypass phrases.',
    issueType: 'jailbreak_persona',
    severity: 'high',
    scoreWeight: 0.85,
    check: checkPatterns([
      {
        regex: /\b(DAN|STAN|AIM)\s+(mode|prompt|jailbreak)\b/i,
        confidence: 0.9,
        description: 'Known jailbreak persona marker.'
      },
      {
        regex:
          /\b(developer\s+mode|no\s+restrictions|without\s+restrictions|bypass\s+(safety|guardrails|policy))\b/i,
        confidence: 0.86,
        description: 'Attempts to bypass model safety constraints.'
      }
    ])
  }),
  defineFilter({
    key: 'prompt_exfiltration',
    name: 'Prompt exfiltration',
    description: 'Detects attempts to reveal hidden prompts, tools, or credentials.',
    issueType: 'prompt_exfiltration',
    severity: 'critical',
    scoreWeight: 1,
    check: checkPatterns([
      {
        regex:
          /\b(show|reveal|print|dump|display)\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?)\b/i,
        confidence: 0.95,
        description: 'Attempts to extract the system prompt.'
      },
      {
        regex:
          /\brepeat\s+(everything\s+)?(above|before|prior)\s+(this|the)?\s*(line|message|instruction)?\b/i,
        confidence: 0.82,
        description: 'Attempts to repeat hidden context.'
      },
      {
        regex:
          /\b(list|show|reveal)\s+(all\s+)?(tools|functions|credentials|secrets|api\s+keys)\b/i,
        confidence: 0.78,
        description: 'Attempts to enumerate tools or secrets.'
      }
    ])
  }),
  defineFilter({
    key: 'tool_call_forgery',
    name: 'Tool-call forgery',
    description: 'Detects forged tool-call or JSON-RPC payloads embedded as text.',
    issueType: 'tool_call_forgery',
    severity: 'high',
    scoreWeight: 0.85,
    check: checkPatterns([
      {
        regex: /"tool_calls?"\s*:\s*\[/i,
        confidence: 0.82,
        description: 'Looks like a forged tool_calls payload.'
      },
      {
        regex: /"function_call"\s*:\s*\{/i,
        confidence: 0.82,
        description: 'Looks like a forged function_call payload.'
      },
      {
        regex: /"jsonrpc"\s*:\s*"2\.0"[\s\S]{0,200}"method"\s*:\s*"tools\/call"/i,
        confidence: 0.86,
        description: 'Looks like a forged MCP tools/call JSON-RPC payload.'
      }
    ])
  }),
  defineFilter({
    key: 'format_break',
    name: 'Format break',
    description: 'Detects chat-template control tokens and role boundary breaks.',
    issueType: 'format_break',
    severity: 'high',
    scoreWeight: 0.75,
    check: checkPatterns([
      {
        regex: /<\|(?:im_start|im_end|endoftext)\|>/i,
        confidence: 0.9,
        description: 'Chat template control token detected.'
      },
      {
        regex: /\[(?:INST|\/INST|SYSTEM|\/SYSTEM|OVERRIDE)\]/i,
        confidence: 0.82,
        description: 'Instruction-template control token detected.'
      },
      {
        regex: /<\/?(?:system|assistant|user)>/i,
        confidence: 0.78,
        description: 'Role tag boundary marker detected.'
      }
    ])
  }),
  defineFilter({
    key: 'instruction_block',
    name: 'Instruction block',
    description: 'Detects suspicious instruction-like markup in untrusted content.',
    issueType: 'instruction_block',
    severity: 'medium',
    scoreWeight: 0.55,
    check: checkPatterns([
      {
        regex: /<\s*(?:instructions?|system|developer)\s*>/i,
        confidence: 0.72,
        description: 'Instruction-like XML tag detected.'
      },
      {
        regex: /^#{1,4}\s*(system|developer|hidden)\s+instructions?\b/im,
        confidence: 0.72,
        description: 'Instruction-like markdown heading detected.'
      }
    ])
  }),
  defineFilter({
    key: 'unicode_smuggling',
    name: 'Unicode smuggling',
    description: 'Detects hidden Unicode controls used to obscure instructions.',
    issueType: 'unicode_smuggling',
    severity: 'high',
    scoreWeight: 0.75,
    check: checkPatterns([
      {
        regex: /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u,
        confidence: 0.86,
        description: 'Invisible or bidirectional Unicode control character detected.'
      }
    ])
  }),
  defineFilter({
    key: 'encoded_payload',
    name: 'Encoded payload',
    description: 'Detects encoded text that decodes to high-risk prompt-injection phrases.',
    issueType: 'encoded_payload',
    severity: 'high',
    scoreWeight: 0.85,
    check: encodedPayloadCheck
  }),
  defineFilter({
    key: 'typoglycemia',
    name: 'Typoglycemia',
    description: 'Detects simple scrambled-word variants of high-risk instruction words.',
    issueType: 'typoglycemia',
    severity: 'low',
    scoreWeight: 0.35,
    check: typoglycemiaCheck
  })
];
