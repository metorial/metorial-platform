import { useRefreshUntilSettled } from '../../lib/useRefreshUntilSettled';
import { getCallbackRegistrationState } from '../lib/callbackRegistrationState';
import { useCallbackSelectionsChangedAt } from '../lib/callbackSelectionChanges';
import { callbackInstancesLoader } from './callbackInstances';
import { callbackLoader } from './callbacks';

let REFRESH_INTERVAL_MS = 2_000;
let REFRESH_TIMEOUT_MS = 60_000;
let INSTANCES_PAGE_SIZE = 100;

export let useCallbackRegistration = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined
) => {
  let callback = callbackLoader.use(
    instanceId && callbackId ? { instanceId, callbackId } : null
  );

  // With a status filter the list includes every generation, not only the serving one, so a
  // replacement that is still being registered shows up as pending.
  let callbackInstances = callbackInstancesLoader.use(
    instanceId && callbackId
      ? {
          instanceId,
          callbackId,
          status: 'active',
          order: 'desc',
          limit: INSTANCES_PAGE_SIZE
        }
      : null
  );

  let selectionsChangedAt = useCallbackSelectionsChangedAt(instanceId, callbackId);
  let state =
    callback.data && callbackInstances.data
      ? getCallbackRegistrationState({
          callback: callback.data,
          callbackInstances: callbackInstances.data.items,
          selectionsChangedAt
        })
      : null;

  let refresh = useRefreshUntilSettled({
    key: instanceId && callbackId ? `callbackRegistration:${instanceId}:${callbackId}` : null,
    settled: state?.status !== 'registering',
    restartKey: selectionsChangedAt?.getTime() ?? null,
    refresh: () => {
      callback.refetch();
      callbackInstancesLoader.refetchAll({ ignoreFocus: true });
    },
    intervalMs: REFRESH_INTERVAL_MS,
    timeoutMs: REFRESH_TIMEOUT_MS
  });

  return {
    failure: state?.status === 'failed' ? state.sync : null,
    isRegistering: refresh.isRefreshing,
    hasTimedOut: refresh.hasTimedOut
  };
};

export type CallbackRegistration = ReturnType<typeof useCallbackRegistration>;
