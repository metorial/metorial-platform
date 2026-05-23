import { QueueRetryError } from '@mtsrc/queue';
import { getSentry } from '@mtsrc/sentry';
import { SlateTriggerEventInputStatus } from '../../../prisma/generated/client';
import { db } from '../../db';
import {
  getTriggerEventInputStorageKey,
  type TriggerEventInputPayload
} from '../../lib/triggerEventInput';
import { invocationsBucketRecord, storage } from '../../storage';
import { slateTriggerEventInputArchiveQueue } from './eventQueues';

let Sentry = getSentry();

const terminalStatuses = new Set<SlateTriggerEventInputStatus>([
  SlateTriggerEventInputStatus.succeeded,
  SlateTriggerEventInputStatus.failed,
  SlateTriggerEventInputStatus.skipped
]);

export let slateTriggerEventInputArchiveQueueProcessor =
  slateTriggerEventInputArchiveQueue.process(async data => {
    try {
      let eventInput = await db.slateTriggerEventInput.findFirst({
        where: { id: data.eventInputId },
        select: {
          id: true,
          status: true,
          input: true,
          payloadStorageKey: true,
          payloadStoredAt: true,
          createdAt: true
        }
      });
      if (!eventInput) return;
      if (eventInput.payloadStorageKey || eventInput.payloadStoredAt) return;
      if (!terminalStatuses.has(eventInput.status)) return;

      let hasPayload = eventInput.input != null;
      if (!hasPayload) {
        await db.slateTriggerEventInput.update({
          where: { id: eventInput.id },
          data: {
            payloadStoredAt: new Date()
          }
        });
        return;
      }

      let storageKey = getTriggerEventInputStorageKey(eventInput.id);
      let payload: TriggerEventInputPayload = {
        id: eventInput.id,
        input: eventInput.input as Record<string, any> | null,
        createdAt: eventInput.createdAt
      };

      await storage.putObject(
        invocationsBucketRecord.bucket,
        storageKey,
        JSON.stringify(payload)
      );

      await db.slateTriggerEventInput.update({
        where: { id: eventInput.id },
        data: {
          payloadStorageKey: storageKey,
          payloadStoredAt: new Date(),
          input: null
        }
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { eventInputId: data.eventInputId }
      });

      console.error('Failed to archive trigger event input:', {
        eventInputId: data.eventInputId,
        error
      });
      throw new QueueRetryError();
    }
  });
