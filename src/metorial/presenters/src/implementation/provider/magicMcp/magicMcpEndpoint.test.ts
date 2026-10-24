import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/config', () => ({
  getConfig: () => ({ urls: { apiUrl: 'https://api.metorial.test' } })
}));

vi.mock('@metorial/module-portal', () => ({
  portalService: { getPrimaryPortalConnectUrl: vi.fn() }
}));

import {
  consumerMagicMcpEndpointPresenter,
  v1MagicMcpEndpointPresenter
} from './magicMcpEndpoint';

let context = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'user_auth_token'
} as const;

let magicMcpEndpoint = (enableSkillEditing: boolean) =>
  ({
    id: 'mep_1',
    status: 'active',
    slug: 'endpoint-1',
    servers: [],
    consumerIntegrationEndpoints: [],
    name: 'Endpoint',
    description: null,
    metadata: {},
    enableSkillEditing,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
  }) as any;

describe('magic MCP endpoint presentation', () => {
  it.each([true, false])('exposes enable_skill_editing=%s', async enableSkillEditing => {
    for (let presenter of [v1MagicMcpEndpointPresenter, consumerMagicMcpEndpointPresenter]) {
      let presented = await presenter
        .present(
          { magicMcpEndpoint: magicMcpEndpoint(enableSkillEditing), portal: null },
          context
        )
        .run();

      expect(presented.enable_skill_editing).toBe(enableSkillEditing);
    }
  });

  it('documents enable_skill_editing in the schema', () => {
    expect(v1MagicMcpEndpointPresenter.schema.properties).toHaveProperty(
      'enable_skill_editing'
    );
  });
});
