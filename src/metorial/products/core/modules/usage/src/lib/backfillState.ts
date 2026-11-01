import { UsageBackfillStateModel, type UsageBackfillSourceState } from '../models';
import { floorToMinute } from './bucket';
import { usageDbConnect } from './connection';

let STATE_ID = 'default';

let cachedCutoffs = new Map<string, Date>();

export let getUsageBackfillState = async (stateId = STATE_ID) => {
  await usageDbConnect();

  let existing = await UsageBackfillStateModel.findById(stateId).lean();
  if (existing) return existing;

  try {
    return await UsageBackfillStateModel.findOneAndUpdate(
      { _id: stateId },
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
    return await UsageBackfillStateModel.findById(stateId).lean();
  }
};

export let getUsageBackfillCutoff = async (stateId = STATE_ID) => {
  let cachedCutoff = cachedCutoffs.get(stateId);
  if (cachedCutoff) return cachedCutoff;

  let state = await getUsageBackfillState(stateId);
  if (!state) throw new Error('Usage backfill state could not be created');

  cachedCutoff = new Date(state.cutoff);
  cachedCutoffs.set(stateId, cachedCutoff);
  return cachedCutoff;
};

export let updateUsageBackfillSource = async (
  source: string,
  update: Omit<UsageBackfillSourceState, 'updatedAt'>,
  stateId = STATE_ID
) => {
  await usageDbConnect();

  await UsageBackfillStateModel.updateOne(
    { _id: stateId },
    { $set: { [`sources.${source}`]: { ...update, updatedAt: new Date() } } }
  );
};
