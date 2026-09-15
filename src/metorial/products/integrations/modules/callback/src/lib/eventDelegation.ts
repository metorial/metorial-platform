export type CallbackEventDelegate = (d: { callbackEventId: string }) => Promise<void>;

let delegates = new Map<string, CallbackEventDelegate>();

export let registerCallbackEventDelegate = (
  adapterIdentifier: string,
  delegate: CallbackEventDelegate
) => {
  if (delegates.has(adapterIdentifier)) {
    throw new Error(
      `Callback event delegate for adapter "${adapterIdentifier}" is already registered`
    );
  }
  delegates.set(adapterIdentifier, delegate);
};

export let getCallbackEventDelegate = (adapterIdentifier: string) =>
  delegates.get(adapterIdentifier) ?? null;
