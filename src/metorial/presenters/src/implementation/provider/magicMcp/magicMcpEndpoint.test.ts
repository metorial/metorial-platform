import { describe, expect, it, vi } from 'vitest';
import { hydrateResourceOwners } from '@metorial/module-resource-actor';

vi.mock('@metorial/config', () => ({
  getConfig: () => ({ urls: { apiUrl: 'https://api.metorial.test' } })
}));

vi.mock('@metorial/db', () => ({ db: {}, getImageUrl: vi.fn() }));

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

  it.each([
    [false, false, 'public', 'anyone'],
    [true, false, 'owner_locked', 'anyone'],
    [false, true, 'public', 'owner'],
    [true, true, 'owner_locked', 'owner']
  ] as const)(
    'presents access for lock=%s and owner visibility=%s',
    async (locked, ownerVisible, type, visibility) => {
      let input = await hydrateResourceOwners({
        magicMcpEndpoint: {
          ...magicMcpEndpoint(false),
          isOwnerLocked: locked,
          isOwnerOnlyVisible: ownerVisible,
          ownerActor: { id: 'iac_1', type: 'person' as const, name: 'Owner' }
        }
      });
      let presented = await v1MagicMcpEndpointPresenter.present(input).run();

      expect(presented.access).toEqual({
        type,
        visibility,
        owner: { type: 'person', name: 'Owner', image_url: null, email: null }
      });
      expect(presented).not.toHaveProperty('owner_actor');
      expect(presented).not.toHaveProperty('is_owner_locked');
      expect(presented).not.toHaveProperty('is_owner_only_visible');
    }
  );

  it('documents enable_skill_editing in the schema', () => {
    expect(v1MagicMcpEndpointPresenter.schema.properties).toHaveProperty(
      'enable_skill_editing'
    );
  });
});
