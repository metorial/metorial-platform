import { db, type SessionMessage } from '@metorial-subspace/db';
import { getOffloadedSessionMessage } from './offload';
import { getJsonSizeBytes } from './payloadLimits';

type SessionMessageBodyRecord = Pick<
  SessionMessage,
  'oid' | 'id' | 'isOffloadedToStorage' | 'inputSize' | 'outputSize'
>;

type MeasuredSessionMessageSizes = {
  oid: bigint;
  inputSize?: number;
  outputSize?: number;
};

export type SessionMessageBodies = {
  input: PrismaJson.SessionMessageInput | null;
  output: PrismaJson.SessionMessageOutput | null;
  inputSize: number | null;
  outputSize: number | null;
  inputOmitted: boolean;
  outputOmitted: boolean;
};

let isWithinLimit = (size: number | null, limitBytes: number) =>
  size === null || size <= limitBytes;

let resolveBody = <T>(d: {
  value: T | null;
  isLoaded: boolean;
  storedSize: number | null;
  limitBytes: number;
}) => {
  if (!d.isLoaded) {
    return {
      value: null,
      size: d.storedSize,
      omitted: d.storedSize !== null && d.storedSize > d.limitBytes
    };
  }

  let size = d.storedSize ?? getJsonSizeBytes(d.value);
  if (size > d.limitBytes) return { value: null, size, omitted: true };

  return { value: d.value, size, omitted: false };
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
    isWithinLimit(message.inputSize, opts.limitBytes);
  let needsOutput = (message: SessionMessageBodyRecord) =>
    isWithinLimit(message.outputSize, opts.limitBytes);

  let inlineInputOids = messages
    .filter(message => !message.isOffloadedToStorage && needsInput(message))
    .map(message => message.oid);
  let inlineOutputOids = messages
    .filter(message => !message.isOffloadedToStorage && needsOutput(message))
    .map(message => message.oid);
  let offloadedMessages = messages.filter(
    message => message.isOffloadedToStorage && (needsInput(message) || needsOutput(message))
  );

  let [inputRows, outputRows, offloadedBodies] = await Promise.all([
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
        async message => [message.oid, await getOffloadedSessionMessage(message)] as const
      )
    )
  ]);

  let inputMap = new Map(inputRows.map(row => [row.oid, row.input]));
  let outputMap = new Map(outputRows.map(row => [row.oid, row.output]));
  let offloadedMap = new Map(offloadedBodies);

  let bodies = new Map<bigint, SessionMessageBodies>();
  let measuredSizes: MeasuredSessionMessageSizes[] = [];

  for (let message of messages) {
    let offloaded = offloadedMap.get(message.oid);

    let isInputLoaded = message.isOffloadedToStorage ? !!offloaded : inputMap.has(message.oid);
    let isOutputLoaded = message.isOffloadedToStorage
      ? !!offloaded
      : outputMap.has(message.oid);

    let input = resolveBody({
      value: message.isOffloadedToStorage
        ? (offloaded?.input ?? null)
        : (inputMap.get(message.oid) ?? null),
      isLoaded: isInputLoaded,
      storedSize: message.inputSize,
      limitBytes: opts.limitBytes
    });
    let output = resolveBody({
      value: message.isOffloadedToStorage
        ? (offloaded?.output ?? null)
        : (outputMap.get(message.oid) ?? null),
      isLoaded: isOutputLoaded,
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
      message.inputSize === null && isInputLoaded ? (input.size ?? undefined) : undefined;
    let measuredOutputSize =
      message.outputSize === null && isOutputLoaded ? (output.size ?? undefined) : undefined;

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
