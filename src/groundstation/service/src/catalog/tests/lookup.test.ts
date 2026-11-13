import type { NameTarget, Offering, Pointer } from '@metorial/model-catalog/src/types';
import { describe, expect, it } from 'vitest';
import {
  catalog,
  model,
  modelTarget,
  offering,
  period,
  pointer,
  pointerTarget,
  vendor
} from '../../knowledge/tests/fixtures';
import {
  createCatalogIndex,
  firstPartyVendors,
  reachableModels,
  targetAt,
  vendorFor
} from '../lookup';
import { fixtureCatalog, pointerSwitch } from './fixture';

let index = createCatalogIndex(fixtureCatalog);

let before = new Date('2025-07-01T00:00:00.000Z');
let after = new Date('2025-10-15T00:00:00.000Z');

describe('createCatalogIndex', () => {
  it('matches a vendor model id exactly', () => {
    let result = index.resolveModel({
      raw: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      at: after
    });

    expect(result.modelId).toBe('claude-sonnet-4-5');
    expect(result.offering?.id).toBe('anthropic:claude-sonnet-4-5');
  });

  it('uses the provider vendor for the offering', () => {
    let exact = index.resolveModel({
      raw: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      provider: 'bedrock',
      at: after
    });
    expect(exact.offering?.id).toBe('aws-bedrock:claude-sonnet-4-5');

    let byName = index.resolveModel({
      raw: 'claude-sonnet-4-5-20250929',
      provider: 'bedrock',
      at: after
    });
    expect(byName.modelId).toBe('claude-sonnet-4-5');
    expect(byName.offering?.id).toBe('aws-bedrock:claude-sonnet-4-5');
  });

  it('falls back to the client family vendor and then to the first-party vendor', () => {
    expect(
      index.resolveModel({
        raw: 'claude-sonnet-4-5-20250929',
        family: 'claude-code',
        at: after
      }).offering?.id
    ).toBe('anthropic:claude-sonnet-4-5');

    expect(
      index.resolveModel({ raw: 'claude-sonnet-4-5-20250929', provider: 'gateway', at: after })
        .offering?.id
    ).toBe('anthropic:claude-sonnet-4-5');

    expect(index.resolveModel({ raw: 'gpt-5', family: 'codex', at: after }).offering?.id).toBe(
      'openai:gpt-5'
    );
  });

  it('evaluates pointers at the request time', () => {
    expect(index.resolveModel({ raw: 'claude-sonnet-latest', at: before }).modelId).toBe(
      'claude-sonnet-4'
    );
    expect(index.resolveModel({ raw: 'claude-sonnet-latest', at: after }).modelId).toBe(
      'claude-sonnet-4-5'
    );
  });

  it('prefers the default serving variant', () => {
    let result = index.resolveModel({
      raw: 'Claude Sonnet Latest',
      provider: 'anthropic',
      at: after
    });

    expect(result.offering?.id).toBe('anthropic:claude-sonnet-4-5');
  });

  it('leaves ambiguous and unknown names unresolved', () => {
    expect(index.resolveModel({ raw: 'sonnet', at: after })).toEqual({});
    expect(
      index.resolveModel({ raw: 'mystery-model', provider: 'openai', at: after })
    ).toEqual({});
  });
});

describe('modelInfo', () => {
  it('reports the family, lifecycle and whether the model is its family latest', () => {
    expect(index.modelInfo('claude-sonnet-4-5')).toEqual({
      familyId: 'claude-sonnet',
      status: 'active',
      isLatest: true
    });
    expect(index.modelInfo('claude-sonnet-4')).toEqual({
      familyId: 'claude-sonnet',
      status: 'deprecated',
      isLatest: false
    });
    expect(index.modelInfo('gpt-5')).toEqual({ status: 'active', isLatest: false });
    expect(index.modelInfo('unknown')).toBeUndefined();
  });
});

describe('targetAt', () => {
  let entry = fixtureCatalog.pointers[0]!;

  it('picks the period that contains the time', () => {
    expect(targetAt(entry, new Date(pointerSwitch))).toEqual({
      kind: 'model',
      modelId: 'claude-sonnet-4-5'
    });
    expect(targetAt(entry, before)).toEqual({ kind: 'model', modelId: 'claude-sonnet-4' });
  });

  it('uses the earliest period before history starts', () => {
    expect(targetAt(entry, new Date('2020-01-01T00:00:00.000Z'))).toEqual({
      kind: 'model',
      modelId: 'claude-sonnet-4'
    });
  });
});

describe('vendorFor', () => {
  it('maps providers and families to catalog vendors', () => {
    expect(vendorFor({ provider: 'vertex' })).toBe('google-vertex');
    expect(vendorFor({ provider: 'other:mistral' })).toBe('mistral');
    expect(vendorFor({ family: 'gemini-cli' })).toBe('google-ai-studio');
    expect(vendorFor({ family: 'cursor' })).toBeUndefined();
  });
});

describe('reachableModels', () => {
  let from = '2025-01-01T00:00:00.000Z';

  let entry = (target: NameTarget, history: NameTarget[] = []) => ({
    target,
    history: history.map(item => period(item, from))
  });

  let lookup = (pointers: Pointer[]) => {
    let byId = new Map(pointers.map(item => [item.id, item]));
    return (pointerId: string) => byId.get(pointerId);
  };

  let link = (id: string, target: NameTarget, history: NameTarget[] = []) =>
    pointer(id, { target, history: history.map(item => period(item, from)) });

  it('collects models from current targets and history', () => {
    let names = [
      entry(modelTarget('a'), [
        modelTarget('b'),
        { kind: 'release', releaseId: 'c@1', modelId: 'c' }
      ]),
      entry({ kind: 'router' }),
      entry({ kind: 'unresolved' })
    ];

    expect(reachableModels(names, lookup([]))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('follows pointers through their target and history', () => {
    let pointers = [
      link('p1', modelTarget('m1'), [modelTarget('m0'), pointerTarget('p2')]),
      link('p2', modelTarget('m2'))
    ];

    expect(reachableModels([entry(pointerTarget('p1'))], lookup(pointers))).toEqual(
      new Set(['m0', 'm1', 'm2'])
    );
  });

  it('follows at most four pointers', () => {
    let pointers = [
      link('p1', pointerTarget('p2')),
      link('p2', pointerTarget('p3')),
      link('p3', pointerTarget('p4')),
      link('p4', modelTarget('m4'), [pointerTarget('p5')]),
      link('p5', modelTarget('m5'))
    ];

    expect(reachableModels([entry(pointerTarget('p1'))], lookup(pointers))).toEqual(
      new Set(['m4'])
    );
  });

  it('terminates on pointer cycles', () => {
    let pointers = [
      link('p1', pointerTarget('p2')),
      link('p2', pointerTarget('p1'), [modelTarget('m')])
    ];

    expect(reachableModels([entry(pointerTarget('p1'))], lookup(pointers))).toEqual(
      new Set(['m'])
    );
  });

  it('ignores unknown pointers', () => {
    expect(reachableModels([entry(pointerTarget('missing'))], lookup([]))).toEqual(new Set());
  });

  it.fails('finds models behind a pointer first reached through a longer chain', () => {
    let pointers = [
      link('p1', pointerTarget('p2')),
      link('p2', pointerTarget('p3')),
      link('p3', pointerTarget('shared')),
      link('shared', pointerTarget('inner')),
      link('inner', modelTarget('m'))
    ];
    let names = [entry(pointerTarget('shared')), entry(pointerTarget('p1'))];

    expect(reachableModels(names, lookup(pointers))).toContain('m');
  });
});

describe('firstPartyVendors', () => {
  let vendors = [
    { id: 'zeta', organizationId: 'acme', kind: 'first-party' },
    { id: 'alpha', organizationId: 'acme', kind: 'first-party' },
    { id: 'aaa-cloud', organizationId: 'acme', kind: 'cloud' },
    { id: 'beta-cloud', organizationId: 'beta', kind: 'cloud' }
  ];

  it('picks the lowest first-party vendor id per organization regardless of order', () => {
    let expected = new Map([['acme', 'alpha']]);

    expect(firstPartyVendors(vendors)).toEqual(expected);
    expect(firstPartyVendors([...vendors].reverse())).toEqual(expected);
    expect(vendors[0]!.id).toBe('zeta');
  });
});

describe('resolveModel with several offerings for one vendor model id', () => {
  let variant = (extra: Partial<Offering['variant']>) => ({
    serving: null,
    reasoning: null,
    quantization: null,
    free: false,
    region: null,
    ...extra
  });

  let shared = { vendorId: 'acme', vendorModelId: 'acme-m' };

  let variants = [
    offering('acme:m:free', { ...shared, variant: variant({ free: true }) }),
    offering('acme:m:eu', { ...shared, variant: variant({ region: 'eu' }) }),
    offering('acme:m:standard', shared)
  ];

  let resolve = (offerings: Offering[]) =>
    createCatalogIndex(
      catalog({ vendors: [vendor('acme')], models: [model('model')], offerings })
    ).resolveModel({ raw: 'acme-m', provider: 'acme', at: after });

  it.each([
    ['listed order', variants],
    ['reversed order', [...variants].reverse()]
  ])('prefers the default variant in %s', (_, offerings) => {
    let result = resolve(offerings);

    expect(result.modelId).toBe('model');
    expect(result.offering?.id).toBe('acme:m:standard');
  });

  it('only considers priced offerings', () => {
    let offerings = variants.map(item =>
      item.id == 'acme:m:standard' ? { ...item, pricing: null } : item
    );

    expect(resolve(offerings).offering?.id).toBe('acme:m:eu');
    expect(resolve([...offerings].reverse()).offering?.id).toBe('acme:m:eu');
  });
});
