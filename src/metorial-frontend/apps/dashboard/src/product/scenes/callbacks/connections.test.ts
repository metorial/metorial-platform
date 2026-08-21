import { describe, expect, it } from 'vitest';
import {
  buildCallbackConnectionDisplayItems,
  buildCallbackConnectionOptions,
  buildCallbackConnectionUsageByConfigId,
  type CallbackConnectionIntegrationInstance
} from './connections';

let makeInstance = (
  overrides: Partial<CallbackConnectionIntegrationInstance> & {
    providers: CallbackConnectionIntegrationInstance['providers'];
  }
): CallbackConnectionIntegrationInstance => ({
  id: 'iti_production',
  name: 'Production',
  integrationId: 'int_triggers',
  ...overrides
});

let makeProvider = (
  overrides?: Partial<CallbackConnectionIntegrationInstance['providers'][number]>
): CallbackConnectionIntegrationInstance['providers'][number] => ({
  id: 'iip_calculator',
  status: 'active',
  provider: { id: 'pro_calculator' },
  integrationProvider: { deploymentId: 'pde_calculator', name: 'Calculator' },
  config: {
    id: 'pcf_calculator',
    name: null,
    updatedAt: new Date('2026-08-15T08:00:00.000Z')
  },
  authConfig: null,
  ...overrides
});

describe('buildCallbackConnectionOptions', () => {
  it('flattens only active, configured connections of the requested provider', () => {
    let options = buildCallbackConnectionOptions({
      providerId: 'pro_calculator',
      integrations: [{ id: 'int_triggers', name: 'Triggers 2026' }],
      integrationInstances: [
        makeInstance({
          providers: [
            makeProvider(),
            makeProvider({ id: 'iip_other_provider', provider: { id: 'pro_other' } }),
            makeProvider({ id: 'iip_archived', status: 'archived' }),
            makeProvider({ id: 'iip_no_config', config: null })
          ]
        })
      ]
    });

    expect(options).toEqual([
      {
        id: 'iip_calculator',
        integrationId: 'int_triggers',
        integrationName: 'Triggers 2026',
        integrationInstanceId: 'iti_production',
        integrationInstanceName: 'Production',
        connectionName: 'Calculator',
        deploymentId: 'pde_calculator',
        configId: 'pcf_calculator',
        authConfigId: null,
        configUpdatedAt: new Date('2026-08-15T08:00:00.000Z').getTime()
      }
    ]);
  });

  it('prefers the config name over the integration provider name and sorts recent first', () => {
    let options = buildCallbackConnectionOptions({
      providerId: 'pro_calculator',
      integrations: [],
      integrationInstances: [
        makeInstance({
          providers: [
            makeProvider({
              id: 'iip_older',
              config: {
                id: 'pcf_older',
                name: '  Team workspace  ',
                updatedAt: new Date('2026-08-10T08:00:00.000Z')
              }
            }),
            makeProvider({
              id: 'iip_newer',
              config: {
                id: 'pcf_newer',
                name: null,
                updatedAt: new Date('2026-08-16T08:00:00.000Z')
              }
            })
          ]
        })
      ]
    });

    expect(options.map(option => option.id)).toEqual(['iip_newer', 'iip_older']);
    expect(options[1]!.connectionName).toBe('Team workspace');
    expect(options[0]!.integrationName).toBeNull();
  });

  it('collects connections across multiple integration instances', () => {
    let options = buildCallbackConnectionOptions({
      providerId: 'pro_calculator',
      integrations: [{ id: 'int_triggers', name: 'Triggers 2026' }],
      integrationInstances: [
        makeInstance({ providers: [makeProvider()] }),
        makeInstance({
          id: 'iti_staging',
          name: 'Staging',
          providers: [
            makeProvider({
              id: 'iip_staging_calculator',
              config: {
                id: 'pcf_staging',
                name: null,
                updatedAt: new Date('2026-08-16T08:00:00.000Z')
              }
            })
          ]
        })
      ]
    });

    expect(options.map(option => option.integrationInstanceName)).toEqual([
      'Staging',
      'Production'
    ]);
  });
});

describe('buildCallbackConnectionDisplayItems', () => {
  it('builds a breadcrumb path label and a default connection label', () => {
    let [item] = buildCallbackConnectionDisplayItems(
      buildCallbackConnectionOptions({
        providerId: 'pro_calculator',
        integrations: [{ id: 'int_triggers', name: 'Triggers 2026' }],
        integrationInstances: [
          makeInstance({
            providers: [
              makeProvider({
                integrationProvider: { deploymentId: 'pde_calculator', name: '' }
              })
            ]
          })
        ]
      })
    );

    expect(item!.pathLabel).toBe('Triggers 2026 › Production');
    expect(item!.connectionLabel).toBe('Default connection');
  });

  it('disambiguates same-named connections within one instance using an id suffix', () => {
    let items = buildCallbackConnectionDisplayItems(
      buildCallbackConnectionOptions({
        providerId: 'pro_calculator',
        integrations: [],
        integrationInstances: [
          makeInstance({
            providers: [
              makeProvider({ id: 'iip_first_abc123' }),
              makeProvider({
                id: 'iip_second_def456',
                config: {
                  id: 'pcf_second',
                  name: null,
                  updatedAt: new Date('2026-08-16T08:00:00.000Z')
                }
              })
            ]
          })
        ]
      })
    );

    expect(items.map(item => item.connectionLabel)).toEqual([
      'Calculator · def456',
      'Calculator · abc123'
    ]);
  });
});

describe('buildCallbackConnectionUsageByConfigId', () => {
  it('maps provider configs of the callback deployment to integration instance labels', () => {
    let usage = buildCallbackConnectionUsageByConfigId({
      deploymentId: 'pde_calculator',
      integrations: [{ id: 'int_triggers', name: 'Triggers 2026' }],
      integrationInstances: [
        makeInstance({ providers: [makeProvider()] }),
        makeInstance({
          id: 'iti_staging',
          name: 'Staging',
          providers: [
            makeProvider({ id: 'iip_staging_shared' }),
            makeProvider({
              id: 'iip_other_deployment',
              integrationProvider: { deploymentId: 'pde_other', name: 'Other' },
              config: {
                id: 'pcf_other',
                name: null,
                updatedAt: new Date('2026-08-16T08:00:00.000Z')
              }
            })
          ]
        })
      ]
    });

    expect(usage.get('pcf_calculator')).toEqual([
      'Triggers 2026 › Production',
      'Triggers 2026 › Staging'
    ]);
    expect(usage.has('pcf_other')).toBe(false);
  });
});
