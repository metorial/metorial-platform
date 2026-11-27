import { db, type SessionMessage } from '@metorial-subspace/db';
import {
  getOffloadedSessionMessage,
  getOffloadedSessionMessageSize,
  type OffloadedSessionMessage
} from './offload';
import { getJsonSizeBytes } from './payloadLimits';

// Offloaded input and output share one storage object, so reading either side downloads both.
let OFFLOADED_READ_LIMIT_FACTOR = 8;

type SessionMessageBodyRecord = Pick<
  SessionMessage,
  'oid' | 'id' | 'isOffloadedToStorage' | 'inputSize' | 'outputSize'
>;

type MeasuredSessionMessageSizes = {
  oid: bigint;
  inputSize?: number;
  outputSize?: number;
};

type BodyReadState = 'loaded' | 'missing' | 'skipped';

type OffloadedRead =
  | { state: 'loaded'; data: OffloadedSessionMessage }
  | { state: 'missing' | 'skipped' };

export type SessionMessageBodies = {
  input: PrismaJson.SessionMessageInput | null;
  output: PrismaJson.SessionMessageOutput | null;
  inputSize: number | null;
  outputSize: number | null;
  inputOmitted: boolean;
  outputOmitted: boolean;
};

let shouldLoadBody = (size: number | null, limitBytes: number) =>
  size === null || (size > 0 && size <= limitBytes);

let resolveBody = <T>(d: {
  value: T | null;
  state: BodyReadState;
  storedSize: number | null;
  limitBytes: number;
}) => {
  if (d.storedSize === 0) return { value: null, size: 0, omitted: false };

  if (d.state === 'missing') return { value: null, size: d.storedSize, omitted: false };
  if (d.state === 'skipped') return { value: null, size: d.storedSize, omitted: true };

  let size = d.storedSize ?? getJsonSizeBytes(d.value);
  if (size > d.limitBytes) return { value: null, size, omitted: true };

  return { value: d.value, size, omitted: false };
};

let readOffloadedBodies = async (
  message: SessionMessageBodyRecord,
  readLimitBytes: number
): Promise<OffloadedRead> => {
  let size =
    message.inputSize !== null && message.outputSize !== null
      ? message.inputSize + message.outputSize
      : await getOffloadedSessionMessageSize(message);

  if (size === null) return { state: 'missing' };
  if (size > readLimitBytes) return { state: 'skipped' };

  let data = await getOffloadedSessionMessage(message);
  return data ? { state: 'loaded', data } : { state: 'missing' };
};

let persistMeasuredSizes = async (sizes: MeasuredSessionMessageSizes[]) => {
  await Promise.all(
    sizes.flatMap(size => [
      size.inputSize !== undefined
        ? db.sessionMessage.updateMany({
            where: { oid: size.oid, inputSize: null },
            data: { inputSize: size.inputSize }
          })
        : null,
      size.outputSize !== undefined
        ? db.sessionMessage.updateMany({
            where: { oid: size.oid, outputSize: null },
            data: { outputSize: size.outputSize }
          })
        : null
    ])
  );
};

export let loadSessionMessageBodies = async (
  messages: SessionMessageBodyRecord[],
  opts: { limitBytes: number }
) => {
  let needsInput = (message: SessionMessageBodyRecord) =>
    shouldLoadBody(message.inputSize, opts.limitBytes);
  let needsOutput = (message: SessionMessageBodyRecord) =>
    shouldLoadBody(message.outputSize, opts.limitBytes);

  let inlineInputOids = messages
    .filter(message => !message.isOffloadedToStorage && needsInput(message))
    .map(message => message.oid);
  let inlineOutputOids = messages
    .filter(message => !message.isOffloadedToStorage && needsOutput(message))
    .map(message => message.oid);
  let offloadedMessages = messages.filter(
    message => message.isOffloadedToStorage && (needsInput(message) || needsOutput(message))
  );

  let [inputRows, outputRows, offloadedReads] = await Promise.all([
    inlineInputOids.length
      ? db.sessionMessage.findMany({
          where: { oid: { in: inlineInputOids } },
          select: { oid: true, input: true }
        })
      : [],
    inlineOutputOids.length
      ? db.sessionMessage.findMany({
          where: { oid: { in: inlineOutputOids } },
          select: { oid: true, output: true }
        })
      : [],
    Promise.all(
      offloadedMessages.map(
        async message =>
          [
            message.oid,
            await readOffloadedBodies(message, opts.limitBytes * OFFLOADED_READ_LIMIT_FACTOR)
          ] as const
      )
    )
  ]);

  let inputMap = new Map(inputRows.map(row => [row.oid, row.input]));
  let outputMap = new Map(outputRows.map(row => [row.oid, row.output]));
  let offloadedMap = new Map(offloadedReads);

  let bodies = new Map<bigint, SessionMessageBodies>();
  let measuredSizes: MeasuredSessionMessageSizes[] = [];

  for (let message of messages) {
    let offloaded = offloadedMap.get(message.oid);
    let offloadedData = offloaded?.state === 'loaded' ? offloaded.data : null;

    let getInlineState = (isNeeded: boolean, map: Map<bigint, unknown>): BodyReadState =>
      !isNeeded ? 'skipped' : map.has(message.oid) ? 'loaded' : 'missing';

    let inputState = message.isOffloadedToStorage
      ? (offloaded?.state ?? 'skipped')
      : getInlineState(needsInput(message), inputMap);
    let outputState = message.isOffloadedToStorage
      ? (offloaded?.state ?? 'skipped')
      : getInlineState(needsOutput(message), outputMap);

    let input = resolveBody({
      value: offloadedData ? offloadedData.input : (inputMap.get(message.oid) ?? null),
      state: inputState,
      storedSize: message.inputSize,
      limitBytes: opts.limitBytes
    });
    let output = resolveBody({
      value: offloadedData ? offloadedData.output : (outputMap.get(message.oid) ?? null),
      state: outputState,
      storedSize: message.outputSize,
      limitBytes: opts.limitBytes
    });

    bodies.set(message.oid, {
      input: input.value,
      output: output.value,
      inputSize: input.size,
      outputSize: output.size,
      inputOmitted: input.omitted,
      outputOmitted: output.omitted
    });

    let measuredInputSize =
      message.inputSize === null && inputState === 'loaded'
        ? (input.size ?? undefined)
        : undefined;
    let measuredOutputSize =
      message.outputSize === null && outputState === 'loaded'
        ? (output.size ?? undefined)
        : undefined;

    if (measuredInputSize !== undefined || measuredOutputSize !== undefined) {
      measuredSizes.push({
        oid: message.oid,
        inputSize: measuredInputSize,
        outputSize: measuredOutputSize
      });
    }
  }

  if (measuredSizes.length) {
    persistMeasuredSizes(measuredSizes).catch(e =>
      console.error('Failed to persist measured session message body sizes', e)
    );
  }

  return bodies;
};
