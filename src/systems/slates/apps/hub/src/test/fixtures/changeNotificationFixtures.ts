import type {
  PrismaClient,
  ChangeNotification,
  Slate,
  SlateVersion
} from '../../../prisma/generated/client';
import { ChangeNotificationType, SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { SlateFixtures } from './slateFixtures';

export const ChangeNotificationFixtures = (db: PrismaClient) => {
  const defaultNotification = async (data: {
    slateOid: bigint;
    slateId: string;
    slateVersionOid?: bigint;
    slateVersionId?: string;
    type?: ChangeNotificationType;
    overrides?: Partial<ChangeNotification>;
  }): Promise<ChangeNotification> => {
    const { oid, id } = getId('changeNotification');

    const factory = defineFactory<ChangeNotification>(
      {
        oid,
        id,
        type: data.type ?? ChangeNotificationType.slate_version_created,
        slateOid: data.slateOid,
        slateId: data.slateId,
        slateVersionOid: data.slateVersionOid,
        slateVersionId: data.slateVersionId,
        ...data.overrides
      } as ChangeNotification,
      {
        persist: value => db.changeNotification.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSlate = async (data?: {
    type?: ChangeNotificationType;
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    notificationOverrides?: Partial<ChangeNotification>;
  }): Promise<{
    notification: ChangeNotification;
    slate: Slate & { currentVersion: SlateVersion };
  }> => {
    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const notification = await defaultNotification({
      slateOid: slate.oid,
      slateId: slate.id,
      slateVersionOid: slate.currentVersion.oid,
      slateVersionId: slate.currentVersion.id,
      type: data?.type,
      overrides: data?.notificationOverrides
    });

    return { notification, slate };
  };

  return {
    default: defaultNotification,
    withSlate
  };
};
