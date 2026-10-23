import { UsageBackfillStateModel, type UsageBackfillSourceState } from '../models';
import { floorToMinute } from './bucket';
import { usageDbConnect } from './connection';

let STATE_ID = 'default';

let cachedCutoff: Date | null = null;

export let getUsageBackfillState = async () => {
  await usageDbConnect();

  let existing = await UsageBackfillStateModel.findById(STATE_ID).lean();
  if (existing) return existing;

  try {
    return await UsageBackfillStateModel.findOneAndUpdate(
      { _id: STATE_ID },
      {
        $setOnInsert: {
          cutoff: new Date(floorToMinute(Date.now())),
          sources: {},
          createdAt: new Date()
        }
      },
      { upsert: true, new: true, lean: true }
    );
  } catch (e: any) {
    if (e?.code != 11000) throw e;
    return await UsageBackfillStateModel.findById(STATE_ID).lean();
  }
};

export let getUsageBackfillCutoff = async () => {
  if (cachedCutoff) return cachedCutoff;

  let state = await getUsageBackfillState();
  if (!state) throw new Error('Usage backfill state could not be created');

  cachedCutoff = new Date(state.cutoff);
  return cachedCutoff;
};

export let updateUsageBackfillSource = async (
  source: string,
  update: Omit<UsageBackfillSourceState, 'updatedAt'>
) => {
  await usageDbConnect();

  await UsageBackfillStateModel.updateOne(
    { _id: STATE_ID },
    { $set: { [`sources.${source}`]: { ...update, updatedAt: new Date() } } }
  );
};
