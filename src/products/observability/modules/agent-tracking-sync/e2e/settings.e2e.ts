import { eventually, expectOk, uniqueEmail, uniqueId, useOrganization } from '@metorial/e2e';
import {
  agentTracking,
  agentTrackingPath,
  expectIngested,
  sendClaudeCodeLogs,
  trackedInstance,
  trackedOrganization
} from '@metorial/agent-tracking-e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { describe, expect, it } from 'vitest';
import { agentTrackingSettingsService } from '../src';

type Fixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

let defaults = {
  privacy: { hideIndividuals: false, minGroupUsers: 5 },
  desktop: {
    toolDetails: false,
    sessionContext: true,
    sessionTitles: false,
    historyImport: false,
    historyImportDays: 90
  },
  links: { ticketUrlTemplate: null },
  retention: { recordDays: null, contentDays: null, usageDays: null },
  content: { mode: 'basic' },
  classification: { deterministicEnabled: true, aiEnabled: false }
};

let captureUpdates = () => {
  let events: FabricEvents['agent_tracking.settings.updated:after'][] = [];
  let stop = Fabric.listen('agent_tracking.settings.updated:after', event => {
    events.push(event);
  });

  return { events, stop };
};

let updateOrganization = (fixture: Fixture, privacy: Record<string, unknown>) =>
  agentTrackingSettingsService.updateOrganizationSettings({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: { privacy }
  });

let updateProject = (fixture: Fixture, retention: Record<string, unknown>) =>
  agentTrackingSettingsService.updateProjectSettings({
    organization: fixture.organization,
    project: fixture.project,
    auditScope: fixture.auditScope,
    input: { retention }
  });

let updateInstance = (
  fixture: Fixture,
  input: {
    content?: { mode: 'basic' | 'shape' | 'full' };
    classification?: { aiEnabled: boolean };
  }
) =>
  agentTrackingSettingsService.updateInstanceSettings({
    organization: fixture.organization,
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input
  });

let storedRows = async (fixture: Fixture) => ({
  organization: await db.agentTrackingOrganizationSettings.findUnique({
    where: { organizationOid: fixture.organization.oid }
  }),
  project: await db.agentTrackingProjectSettings.findUnique({
    where: { projectOid: fixture.project.oid }
  }),
  instance: await db.agentTrackingInstanceSettings.findUnique({
    where: { instanceOid: fixture.instance.oid }
  })
});

describe('module-agent-tracking-sync settings without changes', () => {
  let org = useOrganization();

  it('answers the defaults of each level while nothing is stored', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    expect(
      await agentTrackingSettingsService.getOrganizationSettings({
        organization: fixture.organization
      })
    ).toEqual({
      settings: {
        organizationId: org.ids.organizationId,
        privacy: defaults.privacy,
        desktop: defaults.desktop,
        links: defaults.links
      },
      serviceStatus: 'applied'
    });
    expect(
      await agentTrackingSettingsService.getProjectSettings({
        organization: fixture.organization,
        project: fixture.project
      })
    ).toEqual({
      settings: {
        organizationId: org.ids.organizationId,
        projectId: org.ids.projectId,
        retention: defaults.retention
      },
      serviceStatus: 'applied'
    });
    expect(
      await agentTrackingSettingsService.getInstanceSettings({
        organization: fixture.organization,
        project: fixture.project,
        instance: fixture.instance
      })
    ).toEqual({
      settings: {
        organizationId: org.ids.organizationId,
        projectId: org.ids.projectId,
        instanceId: org.ids.instanceId,
        content: defaults.content,
        classification: defaults.classification
      },
      serviceStatus: 'applied',
      privacy: defaults.privacy
    });
  });

  it('stores and announces nothing for values that are already in place', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let updates = captureUpdates();

    try {
      let result = await updateInstance(fixture, { content: { mode: 'basic' } });
      expect(result.settings.content.mode).toBe('basic');
      await updateOrganization(fixture, { hideIndividuals: false });
      await updateProject(fixture, { usageDays: null });
    } finally {
      updates.stop();
    }

    expect(updates.events).toEqual([]);
    expect(await storedRows(fixture)).toEqual({
      organization: null,
      project: null,
      instance: null
    });
  });
});

describe('module-agent-tracking-sync settings lifecycle', () => {
  let org = useOrganization();

  it('stores each level, applies it in the service and announces it with the values before', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let updates = captureUpdates();

    try {
      expect(
        await updateOrganization(fixture, { hideIndividuals: true, minGroupUsers: 7 })
      ).toMatchObject({
        settings: { privacy: { hideIndividuals: true, minGroupUsers: 7 } },
        serviceStatus: 'applied'
      });
      expect(await updateProject(fixture, { recordDays: 30, usageDays: 200 })).toMatchObject({
        settings: { retention: { recordDays: 30, contentDays: null, usageDays: 200 } },
        serviceStatus: 'applied'
      });
      expect(
        await updateInstance(fixture, {
          content: { mode: 'full' },
          classification: { aiEnabled: true }
        })
      ).toMatchObject({
        settings: {
          content: { mode: 'full' },
          classification: { deterministicEnabled: true, aiEnabled: true }
        },
        serviceStatus: 'applied'
      });
    } finally {
      updates.stop();
    }

    expect(await storedRows(fixture)).toMatchObject({
      organization: { hideIndividuals: true, minGroupUsers: 7 },
      project: { recordDays: 30, contentDays: null, usageDays: 200 },
      instance: { mode: 'full', deterministicEnabled: true, aiEnabled: true }
    });

    let scope = {
      organization: fixture.organization,
      project: fixture.project,
      instance: fixture.instance
    };
    expect(await agentTrackingSettingsService.getOrganizationSettings(scope)).toMatchObject({
      settings: { privacy: { hideIndividuals: true, minGroupUsers: 7 } },
      serviceStatus: 'applied'
    });
    expect(await agentTrackingSettingsService.getProjectSettings(scope)).toMatchObject({
      settings: { retention: { recordDays: 30, contentDays: null, usageDays: 200 } },
      serviceStatus: 'applied'
    });
    expect(await agentTrackingSettingsService.getInstanceSettings(scope)).toMatchObject({
      settings: { content: { mode: 'full' }, classification: { aiEnabled: true } },
      serviceStatus: 'applied',
      privacy: { hideIndividuals: true, minGroupUsers: 7 }
    });

    expect((await trackedOrganization(org.ids)).settings.privacy).toEqual({
      hideIndividuals: true,
      minGroupUsers: 7
    });
    expect(
      await agentTracking().project.get({
        organizationId: org.ids.organizationId,
        projectId: org.ids.projectId
      })
    ).toMatchObject({
      recordRetentionDays: 30,
      contentRetentionDays: 30,
      usageRetentionDays: 200
    });
    expect(await trackedInstance(org.ids)).toMatchObject({
      recordRetentionDays: 30,
      usageRetentionDays: 200,
      settings: {
        contentPolicy: { defaultMode: 'full' },
        classification: { enabled: true, ai: { enabled: true } }
      }
    });

    expect(
      updates.events.map(event => ({
        settings: event.settings,
        previousSettings: event.previousSettings
      }))
    ).toEqual([
      {
        settings: {
          organizationId: org.ids.organizationId,
          privacy: { hideIndividuals: true, minGroupUsers: 7 },
          desktop: defaults.desktop,
          links: defaults.links
        },
        previousSettings: {
          organizationId: org.ids.organizationId,
          privacy: defaults.privacy,
          desktop: defaults.desktop,
          links: defaults.links
        }
      },
      {
        settings: {
          organizationId: org.ids.organizationId,
          projectId: org.ids.projectId,
          retention: { recordDays: 30, contentDays: null, usageDays: 200 }
        },
        previousSettings: {
          organizationId: org.ids.organizationId,
          projectId: org.ids.projectId,
          retention: defaults.retention
        }
      },
      {
        settings: {
          organizationId: org.ids.organizationId,
          projectId: org.ids.projectId,
          instanceId: org.ids.instanceId,
          content: { mode: 'full' },
          classification: { deterministicEnabled: true, aiEnabled: true }
        },
        previousSettings: {
          organizationId: org.ids.organizationId,
          projectId: org.ids.projectId,
          instanceId: org.ids.instanceId,
          content: defaults.content,
          classification: defaults.classification
        }
      }
    ]);

    await updateOrganization(fixture, defaults.privacy);
    await updateProject(fixture, { recordDays: null, usageDays: null });
    await updateInstance(fixture, {
      content: { mode: 'basic' },
      classification: { aiEnabled: false }
    });

    expect((await trackedOrganization(org.ids)).settings.privacy).toEqual(defaults.privacy);
    expect(await trackedInstance(org.ids)).toMatchObject({
      recordRetentionDays: 90,
      usageRetentionDays: 400,
      settings: {
        contentPolicy: { defaultMode: 'basic' },
        classification: { enabled: true, ai: { enabled: false } }
      }
    });
  });
});

describe('module-agent-tracking-sync Desktop settings and links', () => {
  let org = useOrganization();

  it('stores the Desktop settings and the ticket link and applies the Desktop settings in the service', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = {
      toolDetails: true,
      sessionContext: true,
      sessionTitles: true,
      historyImport: true,
      historyImportDays: 180
    };

    let wider = await agentTrackingSettingsService.updateOrganizationSettings({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        desktop,
        links: { ticketUrlTemplate: ' https://linear.app/acme/issue/{key} ' }
      }
    });

    expect(wider).toMatchObject({
      settings: {
        desktop,
        links: { ticketUrlTemplate: 'https://linear.app/acme/issue/{key}' }
      },
      serviceStatus: 'applied'
    });
    expect((await storedRows(fixture)).organization).toMatchObject({
      ...desktop,
      ticketUrlTemplate: 'https://linear.app/acme/issue/{key}'
    });
    expect((await trackedOrganization(org.ids)).settings.desktop).toEqual(desktop);
    expect(
      (
        await agentTrackingSettingsService.getOrganizationSettings({
          organization: fixture.organization
        })
      ).serviceStatus
    ).toBe('applied');

    let narrower = await agentTrackingSettingsService.updateOrganizationSettings({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        desktop: { sessionContext: false, sessionTitles: false, historyImportDays: 30 },
        links: { ticketUrlTemplate: '' }
      }
    });

    let narrowed = {
      ...desktop,
      sessionContext: false,
      sessionTitles: false,
      historyImportDays: 30
    };
    expect(narrower).toMatchObject({
      settings: { desktop: narrowed, links: { ticketUrlTemplate: null } },
      serviceStatus: 'applied'
    });
    expect((await trackedOrganization(org.ids)).settings.desktop).toEqual(narrowed);
    expect((await storedRows(fixture)).organization).toMatchObject({
      ...narrowed,
      ticketUrlTemplate: null
    });
  });
});

describe('module-agent-tracking-sync content capture', () => {
  let org = useOrganization();

  let promptRecord = (prompt: string) => ({
    timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
    body: { stringValue: 'claude_code.user_prompt' },
    attributes: [
      { key: 'event.name', value: { stringValue: 'user_prompt' } },
      { key: 'session.id', value: { stringValue: uniqueId('session') } },
      { key: 'user.email', value: { stringValue: uniqueEmail('agent-tracking') } },
      { key: 'prompt', value: { stringValue: prompt } },
      { key: 'prompt_length', value: { intValue: String(prompt.length) } }
    ]
  });

  let capturedAs = async (prompt: string) => {
    let instance = await trackedInstance(org.ids);

    return await eventually(
      async () => {
        let { items } = await agentTracking().records.list({ instanceId: instance.id });
        let entry = items
          .flatMap((item: any) => item.record.content ?? [])
          .find(
            (content: any) =>
              content.role == 'prompt' && content.length?.chars == prompt.length
          );
        expect(entry).toBeDefined();

        return entry;
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
  };

  it('captures what the instance setting says through a key Metorial issued, narrowing at once', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let source = expectOk(
      await org.clients.rest.post(agentTrackingPath(org, '/ingest-sources'), {
        name: uniqueId('Prompts'),
        client_family: 'claude_code'
      })
    );
    let send = async (prompt: string) =>
      await expectIngested(
        await sendClaudeCodeLogs({ ingestUrl: source.ingest_url, secret: source.secret }, [
          promptRecord(prompt)
        ])
      );

    let unset = 'a prompt sent before any content setting';
    await send(unset);
    let basic = await capturedAs(unset);
    expect(basic).toMatchObject({ mode: 'basic', state: 'present' });
    expect(basic.text).toBeUndefined();
    expect(basic.shape).toBeUndefined();

    await updateInstance(fixture, { content: { mode: 'full' } });

    let wide = 'a prompt sent while the instance keeps the full text';
    await send(wide);
    expect(await capturedAs(wide)).toMatchObject({ mode: 'full', text: wide });

    let narrowing = await updateInstance(fixture, { content: { mode: 'basic' } });
    expect(narrowing.serviceStatus).toBe('applied');
    expect((await trackedInstance(org.ids)).settings).toMatchObject({
      contentPolicy: { defaultMode: 'basic' }
    });

    let narrow = 'a prompt sent after narrowing back to basic again';
    await send(narrow);
    let narrowed = await capturedAs(narrow);
    expect(narrowed).toMatchObject({ mode: 'basic' });
    expect(narrowed.text).toBeUndefined();
  }, 180_000);
});
