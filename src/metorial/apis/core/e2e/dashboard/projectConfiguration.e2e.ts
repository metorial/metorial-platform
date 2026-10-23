import {
  authClients,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  metorialEndpoints,
  rest,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

type Body = Record<string, unknown>;

interface ConfigurationCase {
  path: string;
  object: string;
  update: Body;
  expected: Body;
  invalid: Body[];
  emptyBodyCode: 'bad_request' | 'invalid_data';
  nextUpdate?: (current: any) => Body;
}

let mib = 1024 * 1024;

let configurations: ConfigurationCase[] = [
  {
    path: 'retention',
    object: 'organization.project.retention_configuration',
    update: { log_retention_in_days: 14, enforce_session_expiry: true },
    expected: { log_retention_in_days: 14, enforce_session_expiry: true },
    invalid: [
      { log_retention_in_days: 0 },
      { log_retention_in_days: 366 },
      { log_retention_in_days: 1.5 },
      { enforce_session_expiry: 'sometimes' }
    ],
    emptyBodyCode: 'bad_request'
  },
  {
    path: 'auth-config',
    object: 'organization.project.auth_config_configuration',
    update: {
      allow_auth_config_export: true,
      only_allow_oauth_auth_methods: true,
      consumer_auth_client_registrations_per_hour_limit: 50,
      consumer_auth_client_registrations_per_minute_limit: 5
    },
    expected: {
      allow_auth_config_export: true,
      only_allow_oauth_auth_methods: true,
      consumer_auth_client_registrations_per_hour_limit: 50,
      consumer_auth_client_registrations_per_minute_limit: 5
    },
    invalid: [
      { consumer_auth_client_registrations_per_hour_limit: 0 },
      { consumer_auth_client_registrations_per_minute_limit: 2.5 },
      { allow_auth_config_import: 'maybe' }
    ],
    emptyBodyCode: 'bad_request',
    nextUpdate: current => ({ allow_auth_config_import: !current.allow_auth_config_import })
  },
  {
    path: 'data-retention',
    object: 'organization.project.data_retention_configuration',
    update: {
      data_retention_level: 'none',
      store_tool_call_attachments: true,
      collect_errors: false,
      disable_callbacks: true
    },
    expected: {
      data_retention_level: 'none',
      store_tool_call_attachments: false,
      collect_errors: false,
      disable_callbacks: true
    },
    invalid: [{ data_retention_level: 'everything' }, { collect_errors: 'nope' }],
    emptyBodyCode: 'bad_request',
    nextUpdate: current => ({
      data_retention_level:
        current.data_retention_level === 'intent_only' ? 'none' : 'intent_only'
    })
  },
  {
    path: 'integration-naming',
    object: 'organization.project.integration_naming_configuration',
    update: { use_integration_name_in_tool_names: true },
    expected: { use_integration_name_in_tool_names: true },
    invalid: [{ use_integration_name_in_tool_names: 'yes please' }],
    emptyBodyCode: 'bad_request',
    nextUpdate: current => ({
      use_integration_name_in_tool_names: !current.use_integration_name_in_tool_names
    })
  },
  {
    path: 'sessionless-mcp',
    object: 'organization.project.sessionless_mcp_configuration',
    update: { sessionless_mcp_enabled: true },
    expected: { sessionless_mcp_enabled: true },
    invalid: [{ sessionless_mcp_enabled: 'on' }, { sessionless_mcp_enabled: null }],
    emptyBodyCode: 'invalid_data'
  },
  {
    path: 'skill-sync',
    object: 'organization.project.skill_sync_configuration',
    update: { git_lfs_threshold_bytes: 2 * mib },
    expected: { git_lfs_threshold_bytes: 2 * mib },
    invalid: [
      { git_lfs_threshold_bytes: mib - 1 },
      { git_lfs_threshold_bytes: 100 * mib + 1 },
      { git_lfs_threshold_bytes: 1.5 * mib + 0.5 }
    ],
    emptyBodyCode: 'bad_request'
  },
  {
    path: 'tool-calling',
    object: 'organization.project.tool_calling_configuration',
    update: {
      collect_operation_description_for_tool_calls: false,
      message_processing_timeout_ms: 45_000
    },
    expected: {
      collect_operation_description_for_tool_calls: false,
      message_processing_timeout_ms: 45_000
    },
    invalid: [
      { message_processing_timeout_ms: 0 },
      { message_processing_timeout_ms: 10 * 60 * 1000 + 1 },
      { collect_operation_description_for_tool_calls: 'often' }
    ],
    emptyBodyCode: 'bad_request',
    nextUpdate: current => ({
      message_processing_timeout_ms:
        current.message_processing_timeout_ms === 20_000 ? 25_000 : 20_000
    })
  },
  {
    path: 'workforce',
    object: 'organization.project.workforce_configuration',
    update: { auto_add_organization_members_to_portals: true },
    expected: { auto_add_organization_members_to_portals: true },
    invalid: [{ auto_add_organization_members_to_portals: 'sure' }],
    emptyBodyCode: 'bad_request'
  }
];

describe('api-core dashboard: project configuration', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let configPath = (
    path: string,
    projectId = org.ids.projectId,
    organizationId = org.ids.organizationId
  ) => `/dashboard/organizations/${organizationId}/projects/${projectId}/configure/${path}`;

  let outsider = () => rest(metorialEndpoints().api, { session: otherOrg.session });

  it('authenticates every project configuration route per credential', async () => {
    let clients = authClients(org, { member: member.clients.rest, otherSession: outsider() });

    for (let configuration of configurations) {
      await expectAuthMatrix(clients, client => client.get(configPath(configuration.path)), {
        none: 401,
        session: 200,
        member: 200,
        management: 403,
        instance: 404,
        otherSession: 404
      });

      await expectAuthMatrix(
        clients,
        client => client.patch(configPath(configuration.path), configuration.update),
        { none: 401, member: 403, management: 403, instance: 404, otherSession: 404 }
      );
    }
  });

  for (let configuration of configurations) {
    let nextUpdate = configuration.nextUpdate;

    describe(configuration.path, () => {
      it('updates the configuration', async () => {
        let path = configPath(configuration.path);

        let current = expectOk(await org.clients.rest.get(path));
        expectPresented(current, configuration.object);
        expect(current.project_id).toBe(org.ids.projectId);

        let updated = expectOk(await org.clients.rest.patch(path, configuration.update));
        expectPresented(updated, configuration.object);
        expect(updated).toMatchObject({
          project_id: org.ids.projectId,
          ...configuration.expected
        });

        if (nextUpdate) return;

        let fetched = expectOk(await org.clients.rest.get(path));
        expect(fetched).toMatchObject(configuration.expected);

        let seenByMember = expectOk(await member.clients.rest.get(path));
        expect(seenByMember).toMatchObject(configuration.expected);
      });

      if (nextUpdate) {
        it('serves an update on the next read', async () => {
          let path = configPath(configuration.path);
          let current = expectOk(await org.clients.rest.get(path));
          let body = nextUpdate(current);

          expect(expectOk(await org.clients.rest.patch(path, body))).toMatchObject(body);
          expect(expectOk(await org.clients.rest.get(path))).toMatchObject(body);
        });
      }

      it('rejects invalid bodies and projects of other organizations', async () => {
        let path = configPath(configuration.path);

        for (let body of configuration.invalid) {
          expectError(await org.clients.rest.patch(path, body), 400, 'invalid_data');
        }
        expectError(await org.clients.rest.patch(path, {}), 400, configuration.emptyBodyCode);

        expectError(
          await org.clients.rest.get(configPath(configuration.path, otherOrg.ids.projectId)),
          404,
          'not_found'
        );
        expectError(
          await org.clients.rest.patch(
            configPath(configuration.path, otherOrg.ids.projectId),
            configuration.update
          ),
          404,
          'not_found'
        );
        expectError(
          await org.clients.rest.get(configPath(configuration.path, uniqueId('prj'))),
          404,
          'not_found'
        );

        let otherProject = expectOk(
          await otherOrg.clients.rest.get(
            configPath(configuration.path, otherOrg.ids.projectId, otherOrg.ids.organizationId)
          )
        );
        expect(otherProject.project_id).toBe(otherOrg.ids.projectId);
      });
    });
  }

  it('resets the skill sync LFS threshold with null', async () => {
    let path = configPath('skill-sync');

    expectOk(await org.clients.rest.patch(path, { git_lfs_threshold_bytes: 4 * mib }));

    let reset = expectOk(
      await org.clients.rest.patch(path, { git_lfs_threshold_bytes: null })
    );
    expect(reset.git_lfs_threshold_bytes).toBeNull();
    expect(expectOk(await org.clients.rest.get(path)).git_lfs_threshold_bytes).toBeNull();
  });

  it('forces error collection on for full data retention', async () => {
    let path = configPath('data-retention');

    let full = expectOk(
      await org.clients.rest.patch(path, {
        data_retention_level: 'full',
        collect_errors: false
      })
    );
    expect(full).toMatchObject({ data_retention_level: 'full', collect_errors: true });
  });
});
