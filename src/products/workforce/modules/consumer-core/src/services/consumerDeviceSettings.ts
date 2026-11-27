import { forbiddenError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  type ConsumerDeviceConnectionMode,
  db,
  ID,
  Instance,
  Organization,
  Project,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { flagService } from '@metorial/module-flags';
import { aiToolDetectionFlag, deviceMonitor } from '../lib/aiToolDetection';

let defaultConnectionMode: ConsumerDeviceConnectionMode = 'local_proxy';

class ConsumerDeviceSettingsServiceImpl {
  async getSettings(d: { instance: Pick<Instance, 'oid'> }) {
    return await withTransaction(
      async db =>
        await db.consumerDeviceSettings.findUnique({
          where: { instanceOid: d.instance.oid }
        }),
      { ifExists: true }
    );
  }

  async isAiToolDetectionActive(d: {
    organization: Organization;
    project: Project;
    instance: Pick<Instance, 'oid'>;
  }) {
    let settings = await this.getSettings({ instance: d.instance });
    if (!settings?.aiToolDetectionEnabled) return false;

    return await this.isAiToolDetectionFlagged(d);
  }

  async isAiToolDetectionFlagged(d: { organization: Organization; project: Project }) {
    return await flagService.isFlagEnabledForScope({
      organization: d.organization,
      project: d.project,
      flag: aiToolDetectionFlag
    });
  }

  async withVisibleDetections<ConsumerDevice extends { detections: unknown[] }>(d: {
    organization: Organization;
    project: Project;
    consumerDevices: ConsumerDevice[];
  }) {
    return this.hideDetectionsUnless(
      d.consumerDevices,
      await this.isAiToolDetectionFlagged(d)
    );
  }

  async getDeviceViews<ConsumerDevice extends { detections: unknown[] }>(d: {
    organization: Organization;
    project: Project;
    instance: Pick<Instance, 'oid'>;
    consumerDevices: ConsumerDevice[];
  }) {
    let [settings, detectionFlagged] = await Promise.all([
      this.getSettings({ instance: d.instance }),
      this.isAiToolDetectionFlagged(d)
    ]);

    return {
      consumerDevices: this.hideDetectionsUnless(d.consumerDevices, detectionFlagged),
      monitor: deviceMonitor({
        aiToolDetection: !!settings?.aiToolDetectionEnabled && detectionFlagged
      }),
      install: { connectionMode: settings?.connectionMode ?? defaultConnectionMode }
    };
  }

  async updateSettings(d: {
    organization: Organization;
    project: Project;
    instance: Pick<Instance, 'oid'>;
    auditScope: AuditScope;
    actor: { isHuman: boolean };
    input: {
      aiToolDetectionEnabled?: boolean;
      privacyNoticeAccepted?: boolean;
      connectionMode?: ConsumerDeviceConnectionMode;
    };
  }) {
    await this.assertDetectionSettingsAvailable(d);
    this.assertCanTurnOn(d);

    return await withTransaction(async db => {
      // Taken before the device rows, in the same order as detection reports.
      await db.$queryRaw`
        SELECT "oid" FROM "ConsumerDeviceSettings"
        WHERE "instanceOid" = ${d.instance.oid}
        FOR UPDATE
      `;

      let previous = await db.consumerDeviceSettings.findUnique({
        where: { instanceOid: d.instance.oid }
      });

      let notice = {
        privacyNoticeAcceptedAt: previous?.privacyNoticeAcceptedAt ?? null,
        privacyNoticeAcceptedByActorOid: previous?.privacyNoticeAcceptedByActorOid ?? null
      };
      if (d.input.privacyNoticeAccepted === true && !notice.privacyNoticeAcceptedAt) {
        notice = {
          privacyNoticeAcceptedAt: new Date(),
          privacyNoticeAcceptedByActorOid: d.auditScope.organizationActorOid ?? null
        };
      }
      if (d.input.privacyNoticeAccepted === false) {
        notice = { privacyNoticeAcceptedAt: null, privacyNoticeAcceptedByActorOid: null };
      }

      let aiToolDetectionEnabled =
        d.input.aiToolDetectionEnabled ?? previous?.aiToolDetectionEnabled ?? false;
      if (aiToolDetectionEnabled && !notice.privacyNoticeAcceptedAt) {
        throw new ServiceError(
          preconditionFailedError({
            message:
              'Accept the privacy notice before turning on AI tool detection, and turn detection off before withdrawing it.'
          })
        );
      }

      let connectionMode =
        d.input.connectionMode ?? previous?.connectionMode ?? defaultConnectionMode;

      let unchanged =
        (previous?.aiToolDetectionEnabled ?? false) == aiToolDetectionEnabled &&
        (previous?.connectionMode ?? defaultConnectionMode) == connectionMode &&
        previous?.privacyNoticeAcceptedAt?.getTime() ==
          notice.privacyNoticeAcceptedAt?.getTime();
      if (unchanged) return previous;

      if (previous?.aiToolDetectionEnabled && !aiToolDetectionEnabled) {
        await db.consumerDevice.updateMany({
          where: { instanceOid: d.instance.oid },
          data: { detectionSeq: null, detectionReportedAt: null }
        });
        await db.consumerDeviceDetection.deleteMany({
          where: { instanceOid: d.instance.oid }
        });
      }

      let consumerDeviceSettings = await db.consumerDeviceSettings.upsert({
        where: { instanceOid: d.instance.oid },
        create: {
          id: await ID.generateId('consumerDeviceSettings'),
          instanceOid: d.instance.oid,
          aiToolDetectionEnabled,
          connectionMode,
          ...notice
        },
        update: { aiToolDetectionEnabled, connectionMode, ...notice }
      });

      addAfterTransactionHook(() =>
        Fabric.fire('consumer.device_settings.updated:after', {
          consumerDeviceSettings,
          previousConsumerDeviceSettings: previous,
          auditScope: d.auditScope
        })
      );

      return consumerDeviceSettings;
    });
  }

  private hideDetectionsUnless<ConsumerDevice extends { detections: unknown[] }>(
    consumerDevices: ConsumerDevice[],
    visible: boolean
  ) {
    return consumerDevices.map(consumerDevice =>
      visible ? consumerDevice : { ...consumerDevice, detections: [] }
    );
  }

  private async assertDetectionSettingsAvailable(d: {
    organization: Organization;
    project: Project;
    input: { aiToolDetectionEnabled?: boolean; privacyNoticeAccepted?: boolean };
  }) {
    if (
      d.input.aiToolDetectionEnabled === undefined &&
      d.input.privacyNoticeAccepted === undefined
    ) {
      return;
    }
    if (await this.isAiToolDetectionFlagged(d)) return;

    throw new ServiceError(
      forbiddenError({ message: 'AI tool detection isn’t available for this organization.' })
    );
  }

  private assertCanTurnOn(d: {
    actor: { isHuman: boolean };
    input: {
      aiToolDetectionEnabled?: boolean;
      privacyNoticeAccepted?: boolean;
      connectionMode?: ConsumerDeviceConnectionMode;
    };
  }) {
    if (
      !d.input.aiToolDetectionEnabled &&
      !d.input.privacyNoticeAccepted &&
      d.input.connectionMode != 'direct'
    ) {
      return;
    }
    if (d.actor.isHuman) return;

    throw new ServiceError(
      forbiddenError({
        message:
          'Only a signed-in dashboard user can accept the privacy notice, turn on AI tool detection or let AI tools connect directly.'
      })
    );
  }
}

export let consumerDeviceSettingsService = Service.create(
  'consumerDeviceSettingsService',
  () => new ConsumerDeviceSettingsServiceImpl()
).build();
