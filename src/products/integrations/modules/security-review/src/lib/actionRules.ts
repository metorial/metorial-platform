import type { SecurityLevel, SecurityReviewAction } from '@metorial-subspace/db';

let ranks: Record<SecurityLevel, number> = {
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4
};

export let highestExposure = (levels: SecurityLevel[]): SecurityLevel => {
  let known = levels.filter(level => level != 'unknown');
  let highest = known.reduce<SecurityLevel>((a, b) => (ranks[a] >= ranks[b] ? a : b), 'low');

  return levels.includes('unknown') && ranks[highest] < ranks.high ? 'unknown' : highest;
};

export let actionExposure = (action: SecurityReviewAction): SecurityLevel => {
  if (['financial', 'access_control', 'infrastructure'].includes(action.operation))
    return 'critical';
  if (action.operation == 'credentials') return 'high';
  if (action.operation == 'send' && action.data == 'credentials') return 'critical';
  if (action.scope == 'unrestricted' || action.operation == 'persist') return 'high';
  if (action.operation == 'send' && action.destination == 'arbitrary') return 'high';
  if (action.scope == 'account' && ['delete', 'execute'].includes(action.operation))
    return 'high';
  if (
    action.data == 'credentials' ||
    (action.operation == 'read' && action.data == 'private' && action.scope == 'account')
  )
    return 'high';
  if (action.scope == 'unknown' || action.data == 'unknown' || action.destination == 'unknown')
    return 'unknown';

  if (action.operation == 'send') {
    if (
      action.destination == 'arbitrary' ||
      (action.data == 'private' && action.scope == 'account')
    )
      return 'high';
    return 'moderate';
  }

  if (action.operation == 'delete') return action.scope == 'account' ? 'high' : 'moderate';
  if (action.operation == 'install') return 'moderate';
  if (action.operation == 'execute') return action.scope == 'account' ? 'high' : 'low';
  if (action.operation == 'write') return action.scope == 'account' ? 'moderate' : 'low';
  return 'low';
};

export let actionsExposure = (actions: SecurityReviewAction[]): SecurityLevel =>
  actions.length ? highestExposure(actions.map(actionExposure)) : 'unknown';
