import { ID } from '@metorial/db';
import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  aiToolPolicyService,
  consumerDeviceDetectionService,
  consumerDeviceService,
  consumerDeviceSettingsService
} from '../src';
import { captureFabric, createDesktopUser, signInDesktop } from './_fixtures';

type Finding = Parameters<
  typeof consumerDeviceDetectionService.reportDetections
>[0]['input']['findings'][number];

let finding = (toolKey: string, overrides: Partial<Finding> = {}): Finding => ({
  toolKey,
  state: 'installed',
  confidence: 'medium',
  signalKinds: ['config_dir'],
  version: null,
  ...overrides
});

type SignedInToken = Awaited<ReturnType<typeof signInDesktop>>;

let deviceTokens = new Map<bigint, SignedInToken>();

let createDevice = async (
  fixture: OrganizationFixture,
  desktop?: Awaited<ReturnType<typeof createDesktopUser>>
) => {
  let owner = desktop ?? (await createDesktopUser(fixture));
  let oauthToken = await signInDesktop(fixture, owner);

  let consumerDevice = await consumerDeviceService.checkInDevice({
    instance: fixture.instance,
    consumerProfile: owner.consumerProfile,
    oauthToken,
    auditScope: fixture.auditScope,
    input: {
      installationId: uniqueId('installation-0123456789'),
      name: 'E2E MacBook',
      os: 'macos',
      arch: 'aarch64',
      appVersion: '0.3.0',
      reportedClients: []
    }
  });
  deviceTokens.set(consumerDevice.oid, oauthToken);

  return {
    consumerDevice,
    consumerProfile: owner.consumerProfile,
    desktop: owner,
    oauthToken
  };
};

let enableDetection = async (fixture: OrganizationFixture) =>
  await consumerDeviceSettingsService.updateSettings({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { privacyNoticeAccepted: true, aiToolDetectionEnabled: true }
  });

let storedDetections = async (consumerDevice: { oid: bigint }) =>
  await db.consumerDeviceDetection.findMany({
    where: { consumerDeviceOid: consumerDevice.oid },
    orderBy: { toolKey: 'asc' }
  });

describe('module-consumer-core AI tool detections', () => {
  let org = useOrganization();
  let disabledOrg = useOrganization();
  let settingsOrg = useOrganization();
  let purgeOrg = useOrganization();

  let fixture: OrganizationFixture;

  let report = (
    consumerDevice: Parameters<
      typeof consumerDeviceDetectionService.reportDetections
    >[0]['consumerDevice'],
    seq: number,
    findings: Finding[],
    generatedAt = new Date()
  ) =>
    consumerDeviceDetectionService.reportDetections({
      consumerDevice,
      oauthToken: deviceTokens.get(consumerDevice.oid),
      auditScope: fixture.auditScope,
      input: { seq, generatedAt, findings }
    });

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    await enableDetection(fixture);
  });

  it('stores the tools a device reports and drops tools the catalog does not know', async () => {
    let { consumerDevice } = await createDevice(fixture);
    let changed = captureFabric('consumer.device.detections.changed:after');

    let result = await report(consumerDevice, 1, [
      finding('cursor', { signalKinds: ['app', 'config_dir'], confidence: 'high' }),
      finding('ollama', { state: 'running', signalKinds: ['process'], version: '0.12.0' }),
      finding('not-a-real-tool')
    ]);
    changed.stop();

    expect(result.applied).toBe(true);
    expect(result.consumerDevice.detectionSeq).toBe(1);
    expect(result.consumerDevice.detections.map(detection => detection.toolKey)).toEqual([
      'cursor',
      'ollama'
    ]);

    let stored = await storedDetections(consumerDevice);
    expect(stored).toEqual([
      expect.objectContaining({
        toolKey: 'cursor',
        state: 'installed',
        confidence: 'high',
        signalKinds: ['app', 'config_dir'],
        instanceOid: fixture.instance.oid,
        goneAt: null
      }),
      expect.objectContaining({ toolKey: 'ollama', state: 'running', version: '0.12.0' })
    ]);
    expect(changed.events).toEqual([
      expect.objectContaining({ added: ['cursor', 'ollama'], removed: [] })
    ]);
  });

  it('ignores a repeated or older report', async () => {
    let { consumerDevice } = await createDevice(fixture);
    await report(consumerDevice, 5, [finding('cursor')]);
    let before = await storedDetections(consumerDevice);
    let changed = captureFabric('consumer.device.detections.changed:after');

    let repeated = await report(consumerDevice, 5, [finding('codex')]);
    let older = await report(consumerDevice, 4, []);
    changed.stop();

    expect(repeated.applied).toBe(false);
    expect(older.applied).toBe(false);
    expect(older.consumerDevice.detectionSeq).toBe(5);
    expect(await storedDetections(consumerDevice)).toEqual(before);
    expect(changed.events).toEqual([]);
  });

  it('applies only one of two reports racing with the same sequence number', async () => {
    let { consumerDevice } = await createDevice(fixture);

    let results = await Promise.all([
      report(consumerDevice, 1, [finding('cursor')]),
      report(consumerDevice, 1, [finding('codex')])
    ]);

    expect(results.filter(result => result.applied)).toHaveLength(1);
    expect(await storedDetections(consumerDevice)).toHaveLength(1);
  });

  it('marks tools a report leaves out gone and brings them back when reported again', async () => {
    let { consumerDevice } = await createDevice(fixture);
    await report(consumerDevice, 1, [finding('cursor'), finding('codex')]);
    let changed = captureFabric('consumer.device.detections.changed:after');

    await report(consumerDevice, 2, [finding('codex')]);
    let gone = (await storedDetections(consumerDevice)).find(row => row.toolKey == 'cursor')!;
    expect(gone.goneAt).not.toBeNull();

    let returned = await report(consumerDevice, 3, [finding('codex'), finding('cursor')]);
    changed.stop();

    let back = (await storedDetections(consumerDevice)).find(row => row.toolKey == 'cursor')!;
    expect(back.oid).toBe(gone.oid);
    expect(back.goneAt).toBeNull();
    expect(back.firstSeenAt).toEqual(gone.firstSeenAt);
    expect(returned.consumerDevice.detections.map(detection => detection.toolKey)).toEqual([
      'codex',
      'cursor'
    ]);
    expect(changed.events.map(event => [event.added, event.removed])).toEqual([
      [[], ['cursor']],
      [['cursor'], []]
    ]);
  });

  it('dates detections when the device generated the report, never in the future', async () => {
    let { consumerDevice } = await createDevice(fixture);
    let generatedAt = new Date(Date.now() - 60 * 60 * 1000);

    await report(consumerDevice, 1, [finding('cursor')], generatedAt);
    let [first] = await storedDetections(consumerDevice);
    expect(first!.lastSeenAt).toEqual(generatedAt);

    await report(consumerDevice, 2, [finding('cursor')], new Date(Date.now() + 86_400_000));
    let [second] = await storedDetections(consumerDevice);
    expect(second!.lastSeenAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(second!.firstSeenAt).toEqual(generatedAt);
  });

  it('refuses reports while detection is off and from devices that are signed out', async () => {
    let disabledFixture = await loadOrganizationFixture(disabledOrg.ids);
    let { consumerDevice } = await createDevice(disabledFixture);

    await expectServiceError(
      consumerDeviceDetectionService.reportDetections({
        consumerDevice,
        oauthToken: deviceTokens.get(consumerDevice.oid),
        auditScope: disabledFixture.auditScope,
        input: { seq: 1, generatedAt: new Date(), findings: [finding('cursor')] }
      }),
      'detection_disabled'
    );
    expect(await storedDetections(consumerDevice)).toEqual([]);

    let signedOut = await createDevice(fixture);
    let revoked = await db.consumerDevice.update({
      where: { oid: signedOut.consumerDevice.oid },
      data: { status: 'revoked', revokedAt: new Date() }
    });
    await expectServiceError(report(revoked, 1, [finding('cursor')]), 'precondition_failed');

    let endedMeanwhile = await createDevice(fixture);
    await db.consumerDevice.update({
      where: { oid: endedMeanwhile.consumerDevice.oid },
      data: { status: 'revoked', revokedAt: new Date() }
    });
    await expectServiceError(
      report(endedMeanwhile.consumerDevice, 1, [finding('cursor')]),
      'precondition_failed'
    );
    expect(await storedDetections(endedMeanwhile.consumerDevice)).toEqual([]);
  });

  it('drops what a device reported when it ends', async () => {
    let { consumerDevice } = await createDevice(fixture);
    await report(consumerDevice, 4, [finding('cursor')]);

    await consumerDeviceService.revokeDevice({
      consumerDevice,
      auditScope: fixture.auditScope
    });

    expect(await storedDetections(consumerDevice)).toEqual([]);
    expect(
      await db.consumerDevice.findUniqueOrThrow({ where: { oid: consumerDevice.oid } })
    ).toMatchObject({ status: 'revoked', detectionSeq: null, detectionReportedAt: null });
  });

  it('lists detections by consumer, device, tool, status and approval', async () => {
    let first = await createDevice(fixture);
    let second = await createDevice(fixture);
    await report(first.consumerDevice, 1, [finding('lm-studio'), finding('perplexity')]);
    await report(second.consumerDevice, 1, [finding('lm-studio')]);
    await report(second.consumerDevice, 2, []);

    let list = async (
      filters: Partial<Parameters<typeof consumerDeviceDetectionService.listDetections>[0]>
    ) =>
      (
        await firstPage(
          await consumerDeviceDetectionService.listDetections({
            instance: fixture.instance,
            consumerDeviceIds: [first.consumerDevice.id, second.consumerDevice.id],
            ...filters
          })
        )
      )
        .map(detection => `${detection.consumerDevice.id}:${detection.toolKey}`)
        .sort();

    expect(await list({})).toEqual([
      `${first.consumerDevice.id}:lm-studio`,
      `${first.consumerDevice.id}:perplexity`
    ]);
    expect(await list({ statuses: ['gone'] })).toEqual([
      `${second.consumerDevice.id}:lm-studio`
    ]);
    expect(await list({ toolKeys: ['perplexity'] })).toEqual([
      `${first.consumerDevice.id}:perplexity`
    ]);
    expect(
      await list({
        consumerIds: [
          (
            await db.consumerProfile.findUniqueOrThrow({
              where: { oid: second.consumerProfile.oid },
              include: { consumer: true }
            })
          ).consumer.id
        ],
        statuses: ['present', 'gone']
      })
    ).toEqual([`${second.consumerDevice.id}:lm-studio`]);
    expect(await list({ consumerDeviceIds: [] })).toEqual([]);

    await aiToolPolicyService.updatePolicy({
      instance: fixture.instance,
      toolKey: 'perplexity',
      auditScope: fixture.auditScope,
      input: { status: 'sanctioned' }
    });
    expect(await list({ policyStatuses: ['sanctioned'] })).toEqual([
      `${first.consumerDevice.id}:perplexity`
    ]);
    expect(await list({ policyStatuses: ['unreviewed', 'not_sanctioned'] })).toEqual([
      `${first.consumerDevice.id}:lm-studio`
    ]);
  });

  it('counts devices and people per tool, and only on signed-in devices of the instance', async () => {
    let otherFixture = await loadOrganizationFixture(disabledOrg.ids);
    let before = await aiToolPolicyService.getTool({
      instance: fixture.instance,
      toolKey: 'goose'
    });

    let laptop = await createDevice(fixture);
    let desktop = await createDevice(fixture, laptop.desktop);
    let colleague = await createDevice(fixture);
    let revoked = await createDevice(fixture);
    for (let device of [laptop, desktop, colleague, revoked])
      await report(device.consumerDevice, 1, [finding('goose')]);
    await db.consumerDevice.update({
      where: { oid: revoked.consumerDevice.oid },
      data: { status: 'revoked' }
    });

    let after = await aiToolPolicyService.getTool({
      instance: fixture.instance,
      toolKey: 'goose'
    });
    expect((after.usage?.deviceCount ?? 0) - (before.usage?.deviceCount ?? 0)).toBe(3);
    expect((after.usage?.peopleCount ?? 0) - (before.usage?.peopleCount ?? 0)).toBe(2);
    expect(after.usage?.lastSeenAt).toBeInstanceOf(Date);

    let elsewhere = await aiToolPolicyService.getTool({
      instance: otherFixture.instance,
      toolKey: 'goose'
    });
    expect(elsewhere.usage).toBeNull();

    let detected = await aiToolPolicyService.listTools({
      instance: fixture.instance,
      detected: true
    });
    expect(detected.map(entry => entry.tool.key)).toContain('goose');
    expect(detected.every(entry => entry.usage)).toBe(true);
  });

  it('records approval decisions per instance', async () => {
    let otherFixture = await loadOrganizationFixture(disabledOrg.ids);
    let updated = captureFabric('ai_tool.policy.updated:after');

    let sanctioned = await aiToolPolicyService.updatePolicy({
      instance: fixture.instance,
      toolKey: 'aider',
      auditScope: fixture.auditScope,
      input: { status: 'sanctioned', note: 'Approved for engineering' }
    });
    let unchanged = await aiToolPolicyService.updatePolicy({
      instance: fixture.instance,
      toolKey: 'aider',
      auditScope: fixture.auditScope,
      input: { status: 'sanctioned' }
    });
    let withdrawn = await aiToolPolicyService.updatePolicy({
      instance: fixture.instance,
      toolKey: 'aider',
      auditScope: fixture.auditScope,
      input: { status: 'unreviewed', note: null }
    });
    updated.stop();

    expect(sanctioned.policy).toMatchObject({
      status: 'sanctioned',
      note: 'Approved for engineering',
      decidedByActorOid: fixture.auditScope.organizationActorOid ?? null
    });
    expect(unchanged.policy?.decidedAt).toEqual(sanctioned.policy?.decidedAt);
    expect(withdrawn.policy).toMatchObject({ status: 'unreviewed', note: null });
    expect(updated.events.map(event => event.previousAiToolPolicy?.status ?? null)).toEqual([
      null,
      'sanctioned'
    ]);

    let elsewhere = await aiToolPolicyService.getTool({
      instance: otherFixture.instance,
      toolKey: 'aider'
    });
    expect(elsewhere.policy).toBeNull();

    await expectServiceError(
      aiToolPolicyService.updatePolicy({
        instance: fixture.instance,
        toolKey: 'not-a-real-tool',
        auditScope: fixture.auditScope,
        input: { status: 'sanctioned' }
      }),
      'not_found'
    );
  });

  it('turns detection on only after the privacy notice is accepted', async () => {
    let settingsFixture = await loadOrganizationFixture(settingsOrg.ids);
    let update = (input: {
      aiToolDetectionEnabled?: boolean;
      privacyNoticeAccepted?: boolean;
    }) =>
      consumerDeviceSettingsService.updateSettings({
        instance: settingsFixture.instance,
        auditScope: settingsFixture.auditScope,
        input
      });
    let updated = captureFabric('consumer.device_settings.updated:after');

    expect(
      await consumerDeviceSettingsService.getSettings({ instance: settingsFixture.instance })
    ).toBeNull();
    await expectServiceError(update({ aiToolDetectionEnabled: true }), 'precondition_failed');
    expect(await update({ aiToolDetectionEnabled: false })).toBeNull();

    let accepted = await update({ privacyNoticeAccepted: true });
    let enabled = await update({ aiToolDetectionEnabled: true, privacyNoticeAccepted: true });
    expect(enabled).toMatchObject({ aiToolDetectionEnabled: true });
    expect(enabled!.privacyNoticeAcceptedAt).toEqual(accepted!.privacyNoticeAcceptedAt);
    expect(
      await consumerDeviceSettingsService.isAiToolDetectionEnabled({
        instance: settingsFixture.instance
      })
    ).toBe(true);

    await expectServiceError(update({ privacyNoticeAccepted: false }), 'precondition_failed');
    let withdrawn = await update({
      aiToolDetectionEnabled: false,
      privacyNoticeAccepted: false
    });
    updated.stop();

    expect(withdrawn).toMatchObject({
      aiToolDetectionEnabled: false,
      privacyNoticeAcceptedAt: null,
      privacyNoticeAcceptedByActorOid: null
    });
    expect(
      updated.events.map(event => [
        event.previousConsumerDeviceSettings?.aiToolDetectionEnabled ?? null,
        event.consumerDeviceSettings.aiToolDetectionEnabled
      ])
    ).toEqual([
      [null, false],
      [false, true],
      [true, false]
    ]);
  });

  it("only accepts reports made with the device's own sign-in", async () => {
    let { consumerDevice, desktop } = await createDevice(fixture);
    let otherSignIn = await signInDesktop(fixture, desktop);

    for (let oauthToken of [otherSignIn, undefined]) {
      await expectServiceError(
        consumerDeviceDetectionService.reportDetections({
          consumerDevice,
          oauthToken,
          auditScope: fixture.auditScope,
          input: { seq: 1, generatedAt: new Date(), findings: [finding('cursor')] }
        }),
        'precondition_failed'
      );
    }
    expect(await storedDetections(consumerDevice)).toEqual([]);
  });

  it('starts the sequence again when the device signs in anew', async () => {
    let { consumerDevice, desktop } = await createDevice(fixture);
    await report(consumerDevice, 9, [finding('cursor')]);

    let newSignIn = await signInDesktop(fixture, desktop);
    let reenrolled = await consumerDeviceService.checkInDevice({
      instance: fixture.instance,
      consumerProfile: desktop.consumerProfile,
      oauthToken: newSignIn,
      auditScope: fixture.auditScope,
      input: {
        installationId: consumerDevice.installationId,
        name: 'E2E MacBook',
        os: 'macos',
        arch: 'aarch64',
        appVersion: '0.3.0',
        reportedClients: []
      }
    });
    expect(reenrolled.id).toBe(consumerDevice.id);
    expect(reenrolled.detectionSeq).toBeNull();

    let fromOldSignIn = await report(consumerDevice, 40, [finding('ollama')]);
    expect(fromOldSignIn.applied).toBe(false);
    expect(fromOldSignIn.consumerDevice.detectionSeq).toBeNull();

    let restarted = await consumerDeviceDetectionService.reportDetections({
      consumerDevice: reenrolled,
      oauthToken: newSignIn,
      auditScope: fixture.auditScope,
      input: {
        seq: 1,
        generatedAt: new Date(),
        findings: [finding('cursor'), finding('codex')]
      }
    });
    expect(restarted.applied).toBe(true);
    expect(restarted.consumerDevice.detectionSeq).toBe(1);
    expect((await storedDetections(consumerDevice)).map(row => row.toolKey)).toEqual([
      'codex',
      'cursor'
    ]);
  });

  it('leaves devices silent for 30 days out of the counts but keeps listing them', async () => {
    let before = await aiToolPolicyService.getTool({
      instance: fixture.instance,
      toolKey: 'warp'
    });
    let { consumerDevice } = await createDevice(fixture);
    await report(consumerDevice, 1, [finding('warp')]);

    let counted = await aiToolPolicyService.getTool({
      instance: fixture.instance,
      toolKey: 'warp'
    });
    expect((counted.usage?.deviceCount ?? 0) - (before.usage?.deviceCount ?? 0)).toBe(1);

    await db.consumerDevice.update({
      where: { oid: consumerDevice.oid },
      data: { detectionReportedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }
    });

    let stale = await aiToolPolicyService.getTool({
      instance: fixture.instance,
      toolKey: 'warp'
    });
    expect(stale.usage?.deviceCount ?? 0).toBe(before.usage?.deviceCount ?? 0);
    expect(
      (
        await firstPage(
          await consumerDeviceDetectionService.listDetections({
            instance: fixture.instance,
            consumerDeviceIds: [consumerDevice.id]
          })
        )
      ).map(detection => detection.toolKey)
    ).toEqual(['warp']);
  });

  it('deletes what devices reported and hides detections while detection is off', async () => {
    let purgeFixture = await loadOrganizationFixture(purgeOrg.ids);
    await enableDetection(purgeFixture);
    let { consumerDevice } = await createDevice(purgeFixture);
    let reportFor = (seq: number) =>
      consumerDeviceDetectionService.reportDetections({
        consumerDevice,
        oauthToken: deviceTokens.get(consumerDevice.oid),
        auditScope: purgeFixture.auditScope,
        input: { seq, generatedAt: new Date(), findings: [finding('cursor')] }
      });
    await reportFor(3);

    await consumerDeviceSettingsService.updateSettings({
      instance: purgeFixture.instance,
      auditScope: purgeFixture.auditScope,
      input: { aiToolDetectionEnabled: false }
    });

    expect(await storedDetections(consumerDevice)).toEqual([]);
    expect(
      await db.consumerDevice.findUniqueOrThrow({ where: { oid: consumerDevice.oid } })
    ).toMatchObject({ detectionSeq: null, detectionReportedAt: null });
    await expectServiceError(reportFor(4), 'detection_disabled');

    await db.consumerDevice.update({
      where: { oid: consumerDevice.oid },
      data: { detectionReportedAt: new Date() }
    });
    await db.consumerDeviceDetection.create({
      data: {
        id: await ID.generateId('consumerDeviceDetection'),
        consumerDeviceOid: consumerDevice.oid,
        instanceOid: purgeFixture.instance.oid,
        toolKey: 'cursor',
        state: 'installed',
        confidence: 'medium',
        signalKinds: ['app'],
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    expect(
      (
        await aiToolPolicyService.getTool({
          instance: purgeFixture.instance,
          toolKey: 'cursor'
        })
      ).usage
    ).toBeNull();
    expect(
      await firstPage(
        await consumerDeviceDetectionService.listDetections({
          instance: purgeFixture.instance
        })
      )
    ).toEqual([]);
    expect(
      (
        await consumerDeviceService.getDeviceById({
          instance: purgeFixture.instance,
          consumerDeviceId: consumerDevice.id
        })
      ).detections
    ).toEqual([]);

    await enableDetection(purgeFixture);
    expect((await reportFor(1)).applied).toBe(true);
  });
});
