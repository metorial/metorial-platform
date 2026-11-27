import type { Organization } from '@mtsrc/agent-tracking-db';
import { describe, expect, it } from 'vitest';
import { organizationPresenter } from '../src/presenters/organization';

let organization = (settings: Organization['settings']) =>
  ({
    id: 'org_1',
    ref: 'org_1',
    name: 'Acme',
    hashKeyVersion: 1,
    contentKeyVersion: 1,
    settings,
    archivedAt: null,
    createdAt: new Date('2026-11-25T00:00:00Z'),
    updatedAt: new Date('2026-11-25T00:00:00Z')
  }) as Organization;

describe('organizationPresenter', () => {
  it('fills in the Desktop defaults while Metorial has sent none', () => {
    expect(organizationPresenter(organization({})).settings.desktop).toEqual({
      toolDetails: false,
      sessionContext: true,
      sessionTitles: false,
      historyImport: false,
      historyImportDays: 90
    });
  });

  it('returns the Desktop settings Metorial sent', () => {
    expect(
      organizationPresenter(
        organization({
          desktop: { sessionContext: false, sessionTitles: true, historyImportDays: 180 }
        })
      ).settings.desktop
    ).toEqual({
      toolDetails: false,
      sessionContext: false,
      sessionTitles: true,
      historyImport: false,
      historyImportDays: 180
    });
  });
});
