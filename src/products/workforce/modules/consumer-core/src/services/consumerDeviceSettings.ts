import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { addAfterTransactionHook, db, ID, Instance, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';

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

  async isAiToolDetectionEnabled(d: { instance: Pick<Instance, 'oid'> }) {
    let settings = await this.getSettings(d);

    return !!settings?.aiToolDetectionEnabled;
  }

  async updateSettings(d: {
    instance: Pick<Instance, 'oid'>;
    auditScope: AuditScope;
    input: { aiToolDetectionEnabled?: boolean; privacyNoticeAccepted?: boolean };
  }) {
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

      let unchanged =
        (previous?.aiToolDetectionEnabled ?? false) == aiToolDetectionEnabled &&
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
          ...notice
        },
        update: { aiToolDetectionEnabled, ...notice }
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
}

export let consumerDeviceSettingsService = Service.create(
  'consumerDeviceSettingsService',
  () => new ConsumerDeviceSettingsServiceImpl()
).build();
