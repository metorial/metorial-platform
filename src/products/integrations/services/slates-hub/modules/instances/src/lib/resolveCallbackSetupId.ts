export type CallbackSetupLookup = {
  state?: string;
  setupCookieIds: string[];
  lastSetupCookieId?: string;
};

export let resolveCallbackSetupId = (lookup: CallbackSetupLookup) =>
  lookup.state ||
  lookup.lastSetupCookieId ||
  (lookup.setupCookieIds.length === 1 ? lookup.setupCookieIds[0] : undefined);
