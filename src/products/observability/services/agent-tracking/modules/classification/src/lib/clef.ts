import { v } from '@lowerdeck/validation';
import { env } from '../env';
import type { CandidateEntity, ClassifiableKind } from './candidates';
import { clefState, type ClassificationFeatures, type ClefState } from './features';
import { ticketPrefixOf } from './stages';

let clefApiBase = 'https://api.cloudflare.com/client/v4/accounts';
let clefModelPath = '@cf/cloudflare/clef';
let defaultTimeoutMs = 15_000;
let defaultRetryDelayMs = 1_000;
let maxAttempts = 2;
let maxCriterionLength = 600;
let minTokenLength = 3;

export let maxClefQuestions = 64;
export let maxClefCandidates = 50;
export let noneOption = 'none';
export let noneCriterion = 'None of these';

export type ClefModel = 'clef' | 'clef-flash';

export type ClefQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};

export type ClefRequest = {
  model: ClefModel;
  state: ClefState;
  questions: Record<string, ClefQuestion>;
};

export type ClefAnswer = {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

export type ClefResponse = {
  answers: Record<string, ClefAnswer>;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type ClefClient = { run: (request: ClefRequest) => Promise<ClefResponse> };

export type ClefFetch = (url: string, init: RequestInit) => Promise<Response>;

export class ClefError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ClefError';
    this.status = opts.status;
    this.retryable = !!opts.retryable;
  }
}

export let questionIdForKind = (kind: string) => kind.replace(/:/g, '.');

export let kindForQuestionId = (questionId: string) => questionId.replace(/\./g, ':');

let tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= minTokenLength);

let normalizeRepo = (repo: string) =>
  repo
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');

let repoMatches = (a: string, b: string) => {
  let left = normalizeRepo(a);
  let right = normalizeRepo(b);

  return left == right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
};

export let criterionText = (candidate: CandidateEntity) => {
  let head = candidate.description
    ? `${candidate.name} — ${candidate.description}`
    : candidate.name;

  let parts = [
    head,
    candidate.keywords.length ? `keywords: ${candidate.keywords.join(', ')}` : undefined,
    candidate.repos.length ? `repos: ${candidate.repos.join(', ')}` : undefined,
    candidate.ticketPrefixes.length
      ? `ticket prefixes: ${candidate.ticketPrefixes.join(', ')}`
      : undefined
  ].filter((part): part is string => !!part);

  return parts.join('; ').slice(0, maxCriterionLength);
};

export let shortlistCandidates = (
  candidates: CandidateEntity[],
  features: ClassificationFeatures
) => {
  if (candidates.length <= maxClefCandidates) return candidates;

  let sessionRepos = [...features.repos, ...features.repoIds];
  let prefixes = new Set(
    features.ticketRefs.map(ticketPrefixOf).filter((prefix): prefix is string => !!prefix)
  );
  let haystack = [
    ...features.repos,
    features.branch ?? '',
    features.workspaceLabel ?? '',
    ...Object.values(features.tags),
    ...features.teamNames,
    features.path ?? '',
    features.firstPrompt ?? ''
  ]
    .join(' ')
    .toLowerCase();
  let tokens = new Set(tokenize(haystack));

  let score = (candidate: CandidateEntity) => {
    let value = 0;

    if (candidate.repos.some(repo => sessionRepos.some(own => repoMatches(repo, own)))) {
      value += 5;
    }
    if (candidate.ticketPrefixes.some(prefix => prefixes.has(prefix))) value += 3;
    if (candidate.scoped) value += 1;

    for (let keyword of candidate.keywords) {
      let normalized = keyword.toLowerCase().trim();
      if (normalized && (tokens.has(normalized) || haystack.includes(normalized))) value += 1;
    }

    for (let token of tokenize(candidate.name)) {
      if (tokens.has(token)) value += 1;
    }

    return value;
  };

  return candidates
    .map(candidate => ({ candidate, score: score(candidate) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, maxClefCandidates)
    .map(item => item.candidate);
};

export let buildClefRequest = (d: {
  model: ClefModel;
  features: ClassificationFeatures;
  kinds: ClassifiableKind[];
}) => {
  let questions: Record<string, ClefQuestion> = {};
  let kindsByQuestionId = new Map<string, string>();
  let candidateIds = new Map<string, Set<string>>();

  for (let kind of d.kinds) {
    if (kindsByQuestionId.size >= maxClefQuestions) break;
    if (!kind.candidates.length) continue;

    let shortlisted = shortlistCandidates(kind.candidates, d.features);
    let criteria: Record<string, string> = {};
    for (let candidate of shortlisted) criteria[candidate.id] = criterionText(candidate);
    criteria[noneOption] = noneCriterion;

    let questionId = questionIdForKind(kind.key);
    questions[questionId] = {
      type: 'choice',
      instructions: `Which ${kind.name.toLowerCase()} does this coding session belong to?`,
      criteria
    };
    kindsByQuestionId.set(questionId, kind.key);
    candidateIds.set(kind.key, new Set(shortlisted.map(candidate => candidate.id)));
  }

  let request: ClefRequest = {
    model: d.model,
    state: clefState(d.features),
    questions
  };

  return { request, kindsByQuestionId, candidateIds };
};

let envelopeSchema = v.object({
  success: v.optional(v.boolean()),
  errors: v.optional(v.array(v.any())),
  result: v.optional(v.any())
});

let bodySchema = v.object({
  answers: v.record(v.any()),
  usage: v.optional(
    v.object({
      input_tokens: v.optional(v.number()),
      output_tokens: v.optional(v.number())
    })
  )
});

let answerSchema = v.object({
  choice: v.optional(v.string()),
  confidence: v.optional(v.number()),
  probabilities: v.optional(v.record(v.any()))
});

let probability = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;

let parseAnswer = (raw: unknown): ClefAnswer | undefined => {
  let validated = answerSchema.validate(raw);
  if (!validated.success) return undefined;

  let probabilities: Record<string, number> = {};
  for (let [option, value] of Object.entries(validated.value.probabilities ?? {})) {
    let parsed = probability(value);
    if (parsed !== undefined) probabilities[option] = parsed;
  }

  let choice =
    validated.value.choice ??
    Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!choice) return undefined;

  let confidence = probability(validated.value.confidence) ?? probabilities[choice] ?? 0;

  return { choice, confidence, probabilities };
};

let errorMessage = (errors: unknown[] | undefined) =>
  (errors ?? [])
    .map(error =>
      error && typeof error == 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error)
    )
    .join('; ') || 'unknown error';

export let parseClefResponse = (body: unknown): ClefResponse => {
  let inner = body;

  let isEnvelope =
    !!body &&
    typeof body == 'object' &&
    !Array.isArray(body) &&
    !('answers' in body) &&
    ('result' in body || 'success' in body);

  if (isEnvelope) {
    let envelope = envelopeSchema.validate(body);
    if (!envelope.success) throw new ClefError('clef returned a malformed envelope');
    if (envelope.value.success === false) {
      throw new ClefError(`clef failed: ${errorMessage(envelope.value.errors)}`);
    }

    inner = envelope.value.result;
  }

  let parsed = bodySchema.validate(inner);
  if (!parsed.success) throw new ClefError('clef returned a malformed response');

  let answers: Record<string, ClefAnswer> = {};
  for (let [questionId, raw] of Object.entries(parsed.value.answers)) {
    let answer = parseAnswer(raw);
    if (answer) answers[questionId] = answer;
  }

  return {
    answers,
    usage: parsed.value.usage
      ? {
          inputTokens: parsed.value.usage.input_tokens,
          outputTokens: parsed.value.usage.output_tokens
        }
      : undefined
  };
};

let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let createClefClient = (d: {
  accountId: string;
  apiToken: string;
  fetch?: ClefFetch;
  timeoutMs?: number;
  retryDelayMs?: number;
}): ClefClient => {
  let doFetch: ClefFetch = d.fetch ?? ((url, init) => fetch(url, init));
  let url = `${clefApiBase}/${encodeURIComponent(d.accountId)}/ai/run/${clefModelPath}`;
  let retryDelayMs = d.retryDelayMs ?? defaultRetryDelayMs;

  let attempt = async (request: ClefRequest) => {
    let response: Response;

    try {
      response = await doFetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${d.apiToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(d.timeoutMs ?? defaultTimeoutMs)
      });
    } catch (error) {
      throw new ClefError(
        `clef request failed: ${error instanceof Error ? error.message : String(error)}`,
        { retryable: true }
      );
    }

    if (response.status == 429 || response.status >= 500) {
      throw new ClefError(`clef returned ${response.status}`, {
        status: response.status,
        retryable: true
      });
    }

    let body: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      let errors =
        body && typeof body == 'object' && 'errors' in body && Array.isArray(body.errors)
          ? body.errors
          : undefined;
      throw new ClefError(`clef returned ${response.status}: ${errorMessage(errors)}`, {
        status: response.status
      });
    }
    if (body === undefined) throw new ClefError('clef returned invalid JSON');

    return parseClefResponse(body);
  };

  return {
    run: async request => {
      for (let attemptNumber = 1; ; attemptNumber++) {
        try {
          return await attempt(request);
        } catch (error) {
          let retryable = error instanceof ClefError && error.retryable;
          if (!retryable || attemptNumber >= maxAttempts) throw error;

          await sleep(retryDelayMs * attemptNumber);
        }
      }
    }
  };
};

export let getClefClient = (): ClefClient | null => {
  let accountId = env.classification.clefAccountId;
  let apiToken = env.classification.clefApiToken;
  if (!accountId || !apiToken) return null;

  return createClefClient({ accountId, apiToken });
};
