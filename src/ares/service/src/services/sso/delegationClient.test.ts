import { describe, expect, it } from 'vitest';
import { assertDelegationSnapshot } from './delegationClient';

let identitySnapshot = {
  active: true,
  type: 'identity',
  delegation: { id: 'sed_1', clientId: 'client_1' },
  instance: {
    id: 'ari_1',
    authorizationUrl: 'https://regional.example/authorize',
    tokenUrl: 'https://regional.example/token'
  },
  tenant: {
    id: 'stn_1',
    name: 'Tenant',
    status: 'completed',
    externalId: null,
    metadata: null,
    hideInUI: false
  },
  connections: [],
  connection: {
    id: 'scn_1',
    status: 'active',
    providerType: 'oidc',
    providerName: null,
    name: 'Connection',
    metadata: null
  },
  userProfile: {
    email: 'user@example.com',
    uid: 'user',
    uidHash: 'hash',
    sub: null,
    firstName: 'User',
    lastName: 'Example',
    roles: [],
    groups: [],
    raw: {}
  }
};

describe('delegation client snapshot validation', () => {
  it('requires an identity connection ID', () => {
    let snapshot = structuredClone(identitySnapshot);
    delete (snapshot.connection as { id?: string }).id;

    expect(() => assertDelegationSnapshot(snapshot)).toThrow(
      'Delegation returned an invalid identity'
    );
  });
});
