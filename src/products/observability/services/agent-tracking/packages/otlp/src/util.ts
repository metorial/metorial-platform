import { ServiceError } from '@lowerdeck/error';
import { otlpLimits, type OtlpAttributes, type OtlpValue } from './model';
import { tooManyItemsError } from './errors';

export type DecodeState = { itemCount: number; malformed: number };

export let newState = (): DecodeState => ({ itemCount: 0, malformed: 0 });

export let emptyAttributes = (): OtlpAttributes => Object.create(null);

export let emptyObject = (): { [key: string]: OtlpValue } => Object.create(null);

export let countItem = (state: DecodeState) => {
  state.itemCount++;

  if (state.itemCount > otlpLimits.maxItems) throw new ServiceError(tooManyItemsError());
};

export let int64ToValue = (value: bigint): number | string => {
  let signed = BigInt.asIntN(64, value);

  return signed >= BigInt(Number.MIN_SAFE_INTEGER) && signed <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(signed)
    : signed.toString();
};

export let nanosToDate = (nanos: bigint): Date | null =>
  nanos > 0n ? new Date(Number(nanos / 1_000_000n)) : null;

export let attributeCount = () => ({ count: 0 });
