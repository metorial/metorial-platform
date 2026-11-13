import { describe, expect, it, vi } from 'vitest';
import {
  buildClefRequest,
  ClefError,
  createClefClient,
  criterionText,
  kindForQuestionId,
  maxClefCandidates,
  maxClefQuestions,
  noneCriterion,
  parseClefResponse,
  questionIdForKind,
  shortlistCandidates,
  type ClefFetch,
  type ClefRequest
} from '../clef';
import { buildFeatures, type ClassificationFeatures } from '../features';
import { candidate, sessionDocument } from './fixtures';

let features = (overrides: Partial<ClassificationFeatures> = {}): ClassificationFeatures => ({
  ...buildFeatures({ session: sessionDocument(), repos: [], workspaces: [], teamNames: [] }),
  ...overrides
});

let answers = {
  project: {
    type: 'choice',
    choice: 'gen_billing',
    confidence: 0.91,
    probabilities: { gen_billing: 0.91, gen_web: 0.06, none: 0.03 }
  }
};

let request: ClefRequest = {
  model: 'clef',
  state: {
    ticketRefs: [],
    tags: {},
    clientFamily: 'cursor',
    mcpServers: [],
    toolClasses: {},
    fileExts: {},
    teamNames: []
  },
  questions: {}
};

let jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

describe('question ids', () => {
  it('maps custom kinds to ids without colons and back', () => {
    expect(questionIdForKind('custom:department')).toBe('custom.department');
    expect(questionIdForKind('cost_center')).toBe('cost_center');
    expect(kindForQuestionId('custom.department')).toBe('custom:department');
    expect(kindForQuestionId(questionIdForKind('custom:a-b_c'))).toBe('custom:a-b_c');
  });
});

describe('criterionText', () => {
  it('describes a candidate by name, description, keywords, repos and prefixes', () => {
    expect(
      criterionText(
        candidate({
          id: 'gen_billing',
          name: 'Billing',
          description: 'Billing revamp',
          keywords: ['invoice', 'stripe'],
          repos: ['acme/billing-api'],
          ticketPrefixes: ['BILL']
        })
      )
    ).toBe(
      'Billing — Billing revamp; keywords: invoice, stripe; repos: acme/billing-api; ticket prefixes: BILL'
    );
    expect(criterionText(candidate({ id: 'gen_x', name: 'Plain' }))).toBe('Plain');
    expect(
      criterionText(candidate({ id: 'gen_x', description: 'y'.repeat(2000) })).length
    ).toBe(600);
  });
});

describe('buildClefRequest', () => {
  it('builds one choice question per kind with a none option', () => {
    let built = buildClefRequest({
      model: 'clef-flash',
      features: features({ repos: ['acme/billing-api'], branch: 'main' }),
      kinds: [
        {
          key: 'project',
          name: 'Project',
          candidates: [candidate({ id: 'gen_billing', name: 'Billing' })]
        },
        {
          key: 'custom:department',
          name: 'Department',
          candidates: [candidate({ id: 'gen_rnd', kind: 'custom:department', name: 'R&D' })]
        },
        { key: 'cost_center', name: 'Cost center', candidates: [] }
      ]
    });

    expect(built.request.model).toBe('clef-flash');
    expect(built.request.state).toMatchObject({ repo: 'acme/billing-api', branch: 'main' });
    expect(built.request.questions).toEqual({
      project: {
        type: 'choice',
        instructions: 'Which project does this coding session belong to?',
        criteria: { gen_billing: 'Billing', none: noneCriterion }
      },
      'custom.department': {
        type: 'choice',
        instructions: 'Which department does this coding session belong to?',
        criteria: { gen_rnd: 'R&D', none: noneCriterion }
      }
    });
    expect(built.kindsByQuestionId.get('custom.department')).toBe('custom:department');
    expect([...built.candidateIds.get('project')!]).toEqual(['gen_billing']);
  });

  it('never sends more than 64 questions', () => {
    let kinds = Array.from({ length: 70 }, (_, index) => ({
      key: `custom:k${index}`,
      name: `K${index}`,
      candidates: [candidate({ id: `gen_${index}`, kind: `custom:k${index}` })]
    }));

    let built = buildClefRequest({ model: 'clef', features: features(), kinds });

    expect(Object.keys(built.request.questions)).toHaveLength(maxClefQuestions);
    expect(built.request.questions['custom.k63']).toBeDefined();
    expect(built.request.questions['custom.k64']).toBeUndefined();
  });

  it('shortlists large kinds down to the most relevant candidates', () => {
    let many = Array.from({ length: 80 }, (_, index) =>
      candidate({ id: `gen_${String(index).padStart(3, '0')}` })
    );
    many.push(
      candidate({ id: 'gen_zrepo', repos: ['github.com/acme/billing-api'] }),
      candidate({ id: 'gen_zticket', ticketPrefixes: ['BILL'] }),
      candidate({ id: 'gen_zkeyword', keywords: ['invoices'] })
    );

    let shortlisted = shortlistCandidates(
      many,
      features({ repos: ['acme/billing-api'], ticketRefs: ['BILL-1'], branch: 'fix-invoices' })
    );

    expect(shortlisted).toHaveLength(maxClefCandidates);
    expect(shortlisted.slice(0, 3).map(item => item.id)).toEqual([
      'gen_zrepo',
      'gen_zticket',
      'gen_zkeyword'
    ]);

    let built = buildClefRequest({
      model: 'clef',
      features: features(),
      kinds: [{ key: 'project', name: 'Project', candidates: many }]
    });
    expect(Object.keys(built.request.questions.project!.criteria)).toHaveLength(
      maxClefCandidates + 1
    );
  });

  it('keeps small kinds whole', () => {
    let few = [candidate({ id: 'gen_a' }), candidate({ id: 'gen_b' })];
    expect(shortlistCandidates(few, features())).toBe(few);
  });
});

describe('parseClefResponse', () => {
  it('reads unwrapped responses', () => {
    let parsed = parseClefResponse({
      answers,
      usage: { input_tokens: 812, output_tokens: 0 }
    });

    expect(parsed.answers.project).toEqual({
      choice: 'gen_billing',
      confidence: 0.91,
      probabilities: { gen_billing: 0.91, gen_web: 0.06, none: 0.03 }
    });
    expect(parsed.usage).toEqual({ inputTokens: 812, outputTokens: 0 });
  });

  it('reads Workers AI envelopes', () => {
    let parsed = parseClefResponse({ result: { answers }, success: true, errors: [] });
    expect(parsed.answers.project?.choice).toBe('gen_billing');
  });

  it('throws on failed envelopes and malformed bodies', () => {
    expect(() =>
      parseClefResponse({ success: false, errors: [{ code: 5006, message: 'bad input' }] })
    ).toThrow(/bad input/);
    expect(() => parseClefResponse({ result: { nope: true }, success: true })).toThrow(
      ClefError
    );
    expect(() => parseClefResponse('hello')).toThrow(ClefError);
    expect(() => parseClefResponse(null)).toThrow(ClefError);
  });

  it('skips malformed answers and fills in missing choice and confidence', () => {
    let parsed = parseClefResponse({
      answers: {
        project: { type: 'choice', probabilities: { gen_a: 0.2, gen_b: 0.7, none: 'x' } },
        team: 'nonsense',
        cost_center: { type: 'choice', choice: 42 },
        custom: { type: 'choice', choice: 'gen_c', probabilities: { gen_c: 1.4 } }
      }
    });

    expect(parsed.answers.project).toEqual({
      choice: 'gen_b',
      confidence: 0.7,
      probabilities: { gen_a: 0.2, gen_b: 0.7 }
    });
    expect(parsed.answers.team).toBeUndefined();
    expect(parsed.answers.cost_center).toBeUndefined();
    expect(parsed.answers.custom).toEqual({
      choice: 'gen_c',
      confidence: 1,
      probabilities: { gen_c: 1 }
    });
  });
});

describe('createClefClient', () => {
  it('posts the request to the Workers AI endpoint with a bearer token', async () => {
    let fetch = vi.fn<ClefFetch>(async () =>
      jsonResponse({ result: { answers }, success: true })
    );
    let client = createClefClient({ accountId: 'acct-1', apiToken: 'token-1', fetch });

    let response = await client.run(request);

    expect(response.answers.project?.choice).toBe('gen_billing');
    expect(fetch).toHaveBeenCalledTimes(1);

    let [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/@cf/cloudflare/clef'
    );
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries once on 5xx and 429', async () => {
    let fetch = vi
      .fn<ClefFetch>()
      .mockResolvedValueOnce(jsonResponse({ success: false, errors: [] }, 503))
      .mockResolvedValueOnce(jsonResponse({ answers }));
    let client = createClefClient({ accountId: 'a', apiToken: 't', fetch, retryDelayMs: 1 });

    await expect(client.run(request)).resolves.toMatchObject({ answers: { project: {} } });
    expect(fetch).toHaveBeenCalledTimes(2);

    let limited = vi.fn<ClefFetch>(async () => jsonResponse({}, 429));
    let limitedClient = createClefClient({
      accountId: 'a',
      apiToken: 't',
      fetch: limited,
      retryDelayMs: 1
    });

    await expect(limitedClient.run(request)).rejects.toMatchObject({
      status: 429,
      retryable: true
    });
    expect(limited).toHaveBeenCalledTimes(2);
  });

  it('retries network errors once', async () => {
    let fetch = vi
      .fn<ClefFetch>()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(jsonResponse({ answers }));
    let client = createClefClient({ accountId: 'a', apiToken: 't', fetch, retryDelayMs: 1 });

    await expect(client.run(request)).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors or malformed bodies', async () => {
    let badRequest = vi.fn<ClefFetch>(async () =>
      jsonResponse({ success: false, errors: [{ message: 'invalid question id' }] }, 400)
    );
    let client = createClefClient({ accountId: 'a', apiToken: 't', fetch: badRequest });

    await expect(client.run(request)).rejects.toThrow(/400: invalid question id/);
    expect(badRequest).toHaveBeenCalledTimes(1);

    let malformed = vi.fn<ClefFetch>(async () => new Response('<html>', { status: 200 }));
    let malformedClient = createClefClient({
      accountId: 'a',
      apiToken: 't',
      fetch: malformed
    });

    await expect(malformedClient.run(request)).rejects.toThrow(/invalid JSON/);
    expect(malformed).toHaveBeenCalledTimes(1);
  });
});
