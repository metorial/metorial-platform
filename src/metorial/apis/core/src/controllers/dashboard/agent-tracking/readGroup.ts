import { maxRangeDays } from '@metorial/module-agent-tracking-query';
import { rangeFields } from '../../../lib/agentTrackingParams';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { requireAgentTrackingEnabled } from '../../../middleware/requireAgentTrackingEnabled';

export let agentTrackingBasePath = '/dashboard/instances/:instanceId/agent-tracking';

export let agentTrackingReadGroup = instanceGroup
  .use(isDashboardGroup())
  .use(requireAgentTrackingEnabled())
  .use(checkAccess({ possibleScopes: ['instance.agent_tracking:read'] }));

export let rangeQueryFieldsFor = (maxDays: number) =>
  rangeFields({
    range:
      'A calendar range in time_zone: today, last_7_days and last_30_days (today and the days before it), month_to_date, or last_month. Ranges that include today end now. Defaults to last_30_days. Leave out when passing from and to.',
    from: `The start of an explicit range, inclusive. Needs to. At most ${maxDays} days before to.`,
    to: 'The end of an explicit range, exclusive. Needs from.',
    timeZone: 'The IANA time zone days are counted in. Defaults to UTC.'
  });

export let rangeQueryFields = rangeQueryFieldsFor(maxRangeDays);
