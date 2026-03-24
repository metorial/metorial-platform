import type {
  PrismaClient,
  SlateEvent,
  Slate,
  SlateVersion
} from '../../../prisma/generated/client';
import { SlateEventType, SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { SlateFixtures } from './slateFixtures';

export const SlateEventFixtures = (db: PrismaClient) => {
  const defaultEvent = async (data: {
    slateOid: bigint;
    slateVersionOid: bigint;
    type?: SlateEventType;
    overrides?: Partial<SlateEvent>;
  }): Promise<SlateEvent> => {
    const { oid, id } = getId('slateEvent');
    const type = data.type ?? SlateEventType.version_pulled;

    const factory = defineFactory<SlateEvent>(
      {
        oid,
        id,
        type,
        message: `Event: ${type}`,
        slateOid: data.slateOid,
        slateVersionOid: data.slateVersionOid,
        ...data.overrides
      } as SlateEvent,
      {
        persist: value => db.slateEvent.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSlate = async (data?: {
    type?: SlateEventType;
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    eventOverrides?: Partial<SlateEvent>;
  }): Promise<{
    event: SlateEvent;
    slate: Slate & { currentVersion: SlateVersion };
  }> => {
    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const event = await defaultEvent({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      type: data?.type,
      overrides: data?.eventOverrides
    });

    return { event, slate };
  };

  return {
    default: defaultEvent,
    withSlate
  };
};
