import { describe, expect, it } from 'vitest';
import { mapDashboardInstanceWebhookRegistrationsCreateBody } from './gen/src/mt_2025_01_01_dashboard/resources/dashboard/instance/webhook-registrations/create';
import { mapDashboardInstanceWebhookRegistrationsListQuery } from './gen/src/mt_2025_01_01_dashboard/resources/dashboard/instance/webhook-registrations/list';
import { mapManagementInstanceWebhookRegistrationsCreateBody } from './gen/src/mt_2025_01_01_dashboard/resources/management/instance/webhook-registrations/create';
import { mapManagementInstanceWebhookRegistrationsListQuery } from './gen/src/mt_2025_01_01_dashboard/resources/management/instance/webhook-registrations/list';
import { mapWebhookRegistrationsCreateBody } from './gen/src/mt_2025_01_01_dashboard/resources/webhook-registrations/create';
import { mapWebhookRegistrationsListQuery } from './gen/src/mt_2025_01_01_dashboard/resources/webhook-registrations/list';

describe('webhook registration credential mapping', () => {
  it.each([
    mapDashboardInstanceWebhookRegistrationsCreateBody,
    mapManagementInstanceWebhookRegistrationsCreateBody,
    mapWebhookRegistrationsCreateBody
  ])('sends the credential ID in the create body', mapper => {
    expect(
      mapper.transformTo({
        providerId: 'slack',
        providerAuthCredentialsId: 'app_2',
        name: 'App 2 Receiver'
      })
    ).toEqual({
      provider_id: 'slack',
      provider_auth_credentials_id: 'app_2',
      name: 'App 2 Receiver'
    });
  });

  it.each([
    mapDashboardInstanceWebhookRegistrationsListQuery,
    mapManagementInstanceWebhookRegistrationsListQuery,
    mapWebhookRegistrationsListQuery
  ])('sends credential filters in the list query', mapper => {
    expect(
      mapper.transformTo({
        providerId: 'slack',
        providerAuthCredentialsId: ['app_1', 'app_2']
      })
    ).toEqual({
      provider_id: 'slack',
      provider_auth_credentials_id: ['app_1', 'app_2']
    });
  });
});
