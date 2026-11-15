import { describe, expect, it } from 'vitest';
import {
  agent,
  catalog,
  endpoint,
  model,
  modelTarget,
  name,
  offering,
  organization,
  vendor
} from '../fixtures';
import { createCatalogIndex, type ModelRequest } from '@mtsrc/agent-tracking-model-resolver';
import {
  catalogVendorDirectory,
  createVendorDirectory,
  hostOf
} from '@mtsrc/agent-tracking-model-resolver';

let at = new Date('2025-06-01T00:00:00.000Z');

let claude = modelTarget('claude');

let fixture = catalog({
  organizations: [organization('anthropic'), organization('openai')],
  models: [model('claude', { labId: 'anthropic' }), model('gpt', { labId: 'openai' })],
  vendors: [
    vendor('anthropic', { organizationId: 'anthropic' }),
    vendor('openai', { organizationId: 'openai' }),
    vendor('aws-bedrock', { organizationId: 'amazon', kind: 'cloud' }),
    vendor('github-copilot', { organizationId: 'github', kind: 'subscription' }),
    vendor('acme-router', { organizationId: 'acme', kind: 'aggregator' }),
    vendor('idle', { organizationId: 'idle', kind: 'inference' })
  ],
  endpoints: [
    endpoint('aws-bedrock/default', {
      vendorId: 'aws-bedrock',
      baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
      upstreamIds: ['amazon-bedrock']
    })
  ],
  offerings: [
    offering('anthropic:claude-x', {
      vendorId: 'anthropic',
      vendorModelId: 'claude-x',
      modelId: 'claude'
    }),
    offering('acme-router:claude-x', {
      vendorId: 'acme-router',
      vendorModelId: 'claude-x',
      modelId: 'claude'
    }),
    offering('aws-bedrock:claude-x', {
      vendorId: 'aws-bedrock',
      vendorModelId: 'anthropic.claude-x-v1:0',
      modelId: 'claude'
    }),
    offering('github-copilot:claude-x', {
      vendorId: 'github-copilot',
      vendorModelId: 'claude-x-copilot',
      modelId: 'claude'
    }),
    offering('openai:gpt', { vendorId: 'openai', vendorModelId: 'gpt', modelId: 'gpt' })
  ],
  names: [
    name('display:Claude X', { raw: 'Claude X', key: 'claude x', target: claude }),
    name('vendor:anthropic:claude-x', {
      namespace: 'vendor:anthropic',
      raw: 'claude-x',
      key: 'claude-x',
      target: claude
    }),
    name('vendor:aws-bedrock:anthropic.claude-x-v1:0', {
      namespace: 'vendor:aws-bedrock',
      raw: 'anthropic.claude-x-v1:0',
      key: 'anthropic.claude-x-v1:0',
      target: claude
    })
  ],
  agents: [
    agent('claude-code', {
      aliases: ['claude_code'],
      vendors: [
        { vendorId: 'anthropic', role: 'default' },
        { vendorId: 'aws-bedrock', role: 'supported' }
      ]
    }),
    agent('copilot-like', {
      vendors: [
        { vendorId: 'aws-bedrock', role: 'default' },
        { vendorId: 'github-copilot', role: 'subscription' }
      ]
    }),
    agent('codex', { vendors: [{ vendorId: 'openai', role: 'default' }] })
  ]
});

let index = createCatalogIndex(fixture);

let resolve = (request: ModelRequest) => {
  let result = index.resolveModel({ ...request, at });

  return {
    vendorId: result.vendorId,
    vendorSource: result.vendorSource,
    offeringId: result.offering?.id
  };
};

describe('createVendorDirectory', () => {
  let directory = catalogVendorDirectory(fixture);

  it.each([
    ['anthropic', 'anthropic'],
    ['Anthropic', 'anthropic'],
    ['bedrock', 'aws-bedrock'],
    ['vertex', 'google-vertex'],
    ['other:acme_router', 'acme-router'],
    ['other:acme-router', 'acme-router'],
    ['aws-bedrock/default', 'aws-bedrock'],
    ['amazon-bedrock', 'aws-bedrock'],
    ['openai', 'openai'],
    ['github', 'github-copilot']
  ])('matches the reported provider %s', (provider, expected) => {
    expect(directory.reportedVendor(provider)).toBe(expected);
  });

  it.each(['gateway', 'other:unknown', '', 'constructor', 'toString'])(
    'leaves %s unmatched',
    provider => {
      expect(directory.reportedVendor(provider)).toBeUndefined();
    }
  );

  it('maps an organization only to its first-party or its single vendor', () => {
    let shared = createVendorDirectory({
      vendors: [
        { id: 'cloud-a', organizationId: 'mega', kind: 'cloud' },
        { id: 'cloud-b', organizationId: 'mega', kind: 'cloud' },
        { id: 'lab-api', organizationId: 'lab', kind: 'first-party' },
        { id: 'lab-cloud', organizationId: 'lab', kind: 'cloud' }
      ],
      endpoints: [],
      agents: []
    });

    expect(shared.reportedVendor('mega')).toBeUndefined();
    expect(shared.reportedVendor('lab')).toBe('lab-api');
  });

  it('matches base URLs by host', () => {
    expect(
      directory.endpointVendor('https://bedrock-runtime.us-east-1.amazonaws.com/v1')
    ).toBe('aws-bedrock');
    expect(directory.endpointVendor('BEDROCK-RUNTIME.us-east-1.amazonaws.com')).toBe(
      'aws-bedrock'
    );
    expect(directory.endpointVendor('https://api.example.com')).toBeUndefined();
  });

  it('finds agents by any normalized alias', () => {
    expect(directory.agent('claude_code')).toMatchObject({
      id: 'claude-code',
      makerId: 'lab',
      defaultVendorId: 'anthropic',
      subscriptionVendorIds: []
    });
    expect(directory.agent('Claude Code')?.id).toBe('claude-code');
    expect(directory.agent('copilot-like')).toMatchObject({
      defaultVendorId: 'aws-bedrock',
      subscriptionVendorIds: ['github-copilot']
    });
    expect(directory.agent('cursor')).toBeUndefined();
  });

  it('knows first-party vendors and vendor details', () => {
    expect(directory.firstPartyVendor('anthropic')).toBe('anthropic');
    expect(directory.firstPartyVendor('amazon')).toBeUndefined();
    expect(directory.vendor('aws-bedrock')).toMatchObject({ kind: 'cloud' });
  });
});

describe('hostOf', () => {
  it('normalizes hosts', () => {
    expect(hostOf('https://API.Example.com:8443/v1')).toBe('api.example.com:8443');
    expect(hostOf('api.example.com')).toBe('api.example.com');
    expect(hostOf('  ')).toBeNull();
    expect(hostOf('http://')).toBeNull();
  });
});

describe('vendor resolution order', () => {
  it('prefers the reported provider', () => {
    expect(resolve({ raw: 'Claude X', provider: 'bedrock', family: 'claude-code' })).toEqual({
      vendorId: 'aws-bedrock',
      vendorSource: 'reported',
      offeringId: 'aws-bedrock:claude-x'
    });
  });

  it('prefers the reported provider over the base URL', () => {
    expect(
      resolve({
        raw: 'Claude X',
        provider: 'anthropic',
        baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com'
      })
    ).toMatchObject({ vendorId: 'anthropic', vendorSource: 'reported' });
  });

  it('uses the base URL host when the provider matches no vendor', () => {
    expect(
      resolve({
        raw: 'Claude X',
        provider: 'gateway',
        baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com/model'
      })
    ).toEqual({
      vendorId: 'aws-bedrock',
      vendorSource: 'endpoint',
      offeringId: 'aws-bedrock:claude-x'
    });
  });

  it('uses the vendor of an exact vendor model id before the agent', () => {
    expect(resolve({ raw: 'anthropic.claude-x-v1:0', family: 'claude-code' })).toEqual({
      vendorId: 'aws-bedrock',
      vendorSource: 'offering',
      offeringId: 'aws-bedrock:claude-x'
    });
  });

  it('skips an exact vendor model id that several vendors share', () => {
    expect(resolve({ raw: 'claude-x', family: 'copilot-like' })).toEqual({
      vendorId: 'aws-bedrock',
      vendorSource: 'agent',
      offeringId: 'aws-bedrock:claude-x'
    });
  });

  it('uses the agent default vendor, or its subscription vendor on a subscription', () => {
    expect(resolve({ raw: 'Claude X', family: 'claude_code' })).toEqual({
      vendorId: 'anthropic',
      vendorSource: 'agent',
      offeringId: 'anthropic:claude-x'
    });
    expect(resolve({ raw: 'Claude X', family: 'copilot-like' })).toMatchObject({
      vendorId: 'aws-bedrock',
      vendorSource: 'agent'
    });
    expect(resolve({ raw: 'Claude X', family: 'copilot-like', subscription: true })).toEqual({
      vendorId: 'github-copilot',
      vendorSource: 'agent',
      offeringId: 'github-copilot:claude-x'
    });
  });

  it('skips an agent vendor that does not sell the model', () => {
    expect(resolve({ raw: 'Claude X', family: 'codex' })).toEqual({
      vendorId: 'anthropic',
      vendorSource: 'first-party',
      offeringId: 'anthropic:claude-x'
    });
  });

  it('falls back to the lab first-party vendor', () => {
    expect(resolve({ raw: 'Claude X' })).toEqual({
      vendorId: 'anthropic',
      vendorSource: 'first-party',
      offeringId: 'anthropic:claude-x'
    });
    expect(resolve({ raw: 'Claude X', provider: 'gateway', family: 'cursor' })).toMatchObject({
      vendorSource: 'first-party'
    });
  });

  it('keeps a reported vendor that has no offering and prices with the first-party one', () => {
    expect(resolve({ raw: 'Claude X', provider: 'idle' })).toEqual({
      vendorId: 'idle',
      vendorSource: 'reported',
      offeringId: 'anthropic:claude-x'
    });
  });

  it('attributes unresolved models to the reported or agent vendor only', () => {
    expect(index.resolveModel({ raw: 'mystery', provider: 'openai', at })).toEqual({
      vendorId: 'openai',
      vendorSource: 'reported'
    });
    expect(index.resolveModel({ raw: 'mystery', family: 'claude-code', at })).toEqual({
      agentId: 'claude-code',
      vendorId: 'anthropic',
      vendorSource: 'agent'
    });
    expect(index.resolveModel({ raw: 'mystery', at })).toEqual({});
  });
});
