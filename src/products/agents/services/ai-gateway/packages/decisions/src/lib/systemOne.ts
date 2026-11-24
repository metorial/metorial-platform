import { DecisionError } from './errors';

let maxErrorLength = 300;

export type SystemOneQuestion =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type SystemOneRequest = {
  model: string;
  state: unknown;
  questions: Record<string, SystemOneQuestion>;
};

export type SystemOneAnswer =
  | { type: 'noul'; noul: number }
  | {
      type: 'choice';
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
    }
  | {
      type: 'score';
      score: number;
      confidence: number;
      probabilities: Record<string, number>;
    };

export type SystemOneResponse = {
  model: string;
  answers: Record<string, SystemOneAnswer>;
  usage: { inputTokens: number; outputTokens: number };
};

let asRecord = (value: unknown) =>
  value && typeof value == 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

let errorText = async (response: Response) => {
  let text = await response.text().catch(() => '');

  try {
    let body = JSON.parse(text);
    let detail = body?.detail ?? body?.errors?.[0]?.message ?? body?.error?.message;
    if (typeof detail == 'string') return detail.slice(0, maxErrorLength);
  } catch {}

  return text.slice(0, maxErrorLength) || response.statusText;
};

// Workers AI wraps every model's output in `{ result, success, errors }`; TypeSafe answers bare.
let unwrap = (body: unknown) => {
  let record = asRecord(body);
  let result = asRecord(record?.result);

  return result && 'answers' in result ? result : record;
};

export let parseSystemOneResponse = (body: unknown, requestedModel: string) => {
  let record = unwrap(body);
  let answers = asRecord(record?.answers);
  if (!answers) {
    throw new DecisionError('invalid_response', 'The decision model returned no answers.');
  }

  let usage = asRecord(record?.usage);

  return {
    model: typeof record?.model == 'string' ? record.model : requestedModel,
    answers: answers as Record<string, SystemOneAnswer>,
    usage: {
      inputTokens: typeof usage?.input_tokens == 'number' ? usage.input_tokens : 0,
      outputTokens: typeof usage?.output_tokens == 'number' ? usage.output_tokens : 0
    }
  } satisfies SystemOneResponse;
};

export let callSystemOne = async (d: {
  url: string;
  headers: Record<string, string>;
  request: SystemOneRequest;
  timeoutMs: number;
  fetch: typeof fetch;
}): Promise<SystemOneResponse> => {
  let response: Response;

  try {
    response = await d.fetch(d.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...d.headers
      },
      body: JSON.stringify(d.request),
      signal: AbortSignal.timeout(d.timeoutMs)
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name == 'TimeoutError' || error.name == 'AbortError')
    ) {
      throw new DecisionError(
        'timeout',
        `The decision model did not answer within ${d.timeoutMs}ms.`
      );
    }

    throw new DecisionError(
      'unreachable',
      error instanceof Error ? error.message : 'The decision model could not be reached.'
    );
  }

  if (!response.ok) {
    let message = await errorText(response);

    if (response.status == 429) throw new DecisionError('rate_limited', message, 429);
    if (response.status >= 500)
      throw new DecisionError('unreachable', message, response.status);

    throw new DecisionError('rejected', message, response.status);
  }

  let body = await response.json().catch(() => {
    throw new DecisionError('invalid_response', 'The decision model returned invalid JSON.');
  });

  return parseSystemOneResponse(body, d.request.model);
};
