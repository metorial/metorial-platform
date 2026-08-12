import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  db: {
    sessionProvider: {
      updateMany: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

import { db } from '@metorial-subspace/db';
import { sessionProviderNameTemplateService } from './sessionProviderNameTemplate';

let updateMany = vi.mocked(db.sessionProvider.updateMany);
let findFirst = vi.mocked(db.sessionProvider.findFirst);

let tenant = (useIntegrationNamesForSessionProviderNameTemplates: boolean) =>
  ({
    useIntegrationNamesForSessionProviderNameTemplates
  }) as any;

let provider = (input?: {
  providerName?: string;
  integrationName?: string;
  integrationOverride?: boolean | null;
  nameTemplate?: string | null;
  fromTemplateProviderOid?: bigint | null;
}) =>
  ({
    oid: 1n,
    id: 'sp_1',
    tag: 'abcd',
    nameTemplate: input?.nameTemplate ?? null,
    fromTemplateProviderOid:
      input?.fromTemplateProviderOid ?? (input?.integrationName ? 2n : null),
    provider: {
      name: input?.providerName ?? 'GitHub'
    },
    fromTemplateProvider: input?.integrationName
      ? {
          integrationInstanceProvider: {
            integration: {
              name: input.integrationName,
              useIntegrationNameForSessionProviderNameTemplatesOverride:
                input.integrationOverride ?? null
            }
          },
          integrationInstanceGroupProvider: null
        }
      : null
  }) as any;

describe('sessionProviderNameTemplateService', () => {
  beforeEach(() => {
    updateMany.mockReset();
    findFirst.mockReset();
    updateMany.mockResolvedValue({ count: 1 } as any);
  });

  it('uses provider names when tenant integration-name flag is disabled', async () => {
    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(false),
      provider: provider({ providerName: 'Slack', integrationName: 'Customer CRM' })
    });

    expect(res.nameTemplate).toBe('slack_$');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nameTemplate: 'slack_$' } })
    );
  });

  it('uses integration names when tenant integration-name flag is enabled', async () => {
    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(true),
      provider: provider({ providerName: 'Slack', integrationName: 'Customer CRM' })
    });

    expect(res.nameTemplate).toBe('customer_crm_$');
  });

  it('lets integration override false beat tenant true', async () => {
    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(true),
      provider: provider({
        providerName: 'Slack',
        integrationName: 'Customer CRM',
        integrationOverride: false
      })
    });

    expect(res.nameTemplate).toBe('slack_$');
  });

  it('lets integration override true beat tenant false', async () => {
    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(false),
      provider: provider({
        providerName: 'Slack',
        integrationName: 'Customer CRM',
        integrationOverride: true
      })
    });

    expect(res.nameTemplate).toBe('customer_crm_$');
  });

  it('keeps initialized templates stable', async () => {
    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(true),
      provider: provider({
        providerName: 'Slack',
        integrationName: 'Customer CRM',
        nameTemplate: 'existing_$'
      })
    });

    expect(res.nameTemplate).toBe('existing_$');
    expect(updateMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('falls back with the selected source name after uniqueness collisions', async () => {
    updateMany
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce({ count: 1 } as any);

    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(true),
      provider: provider({ providerName: 'Slack', integrationName: 'Customer CRM' })
    });

    expect(res.nameTemplate).toBe('customer_crm_$_abcd');
  });

  it('fetches linked integration source only when needed for null templates', async () => {
    findFirst.mockResolvedValueOnce({
      fromTemplateProvider: {
        integrationInstanceProvider: {
          integration: {
            name: 'Customer CRM',
            useIntegrationNameForSessionProviderNameTemplatesOverride: null
          }
        },
        integrationInstanceGroupProvider: null
      }
    } as any);

    let res = await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: tenant(true),
      provider: {
        ...provider({
          providerName: 'Slack',
          fromTemplateProviderOid: 2n
        }),
        fromTemplateProvider: undefined
      }
    });

    expect(findFirst).toHaveBeenCalledOnce();
    expect(res.nameTemplate).toBe('customer_crm_$');
  });
});
