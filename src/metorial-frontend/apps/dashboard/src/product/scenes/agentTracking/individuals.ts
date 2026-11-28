export type IndividualsVisibility = 'pending' | 'visible' | 'hidden' | 'unavailable';

export let individualsVisibility = (d: {
  enabled: boolean;
  scopes: { loaded: boolean; hasScope: boolean };
  settings: { loaded: boolean; failed: boolean; hideIndividuals: boolean };
}): IndividualsVisibility => {
  if (!d.enabled) return 'unavailable';
  if (!d.scopes.loaded) return 'pending';
  if (!d.scopes.hasScope || d.settings.failed) return 'unavailable';
  if (!d.settings.loaded) return 'pending';

  return d.settings.hideIndividuals ? 'hidden' : 'visible';
};
