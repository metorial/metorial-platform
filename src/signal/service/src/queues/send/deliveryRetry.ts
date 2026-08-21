export type EnqueueDeliveryAttempt = (
  data: { intentId: string },
  opts?: { delay?: number; id?: string }
) => Promise<unknown>;

export let getDeliveryAttemptJobId = (intentId: string, attemptNumber: number) =>
  `${intentId}:attempt:${attemptNumber}`;

export let enqueueDeliveryAttempt = async (d: {
  enqueue: EnqueueDeliveryAttempt;
  intentId: string;
  attemptNumber: number;
  delayMs?: number;
}) => {
  let opts: { id: string; delay?: number } = {
    id: getDeliveryAttemptJobId(d.intentId, d.attemptNumber)
  };
  if (d.delayMs !== undefined) opts.delay = d.delayMs;

  await d.enqueue({ intentId: d.intentId }, opts);
};
