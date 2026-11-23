import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

export let errorReportingSettings = defineSettings('errorReporting', {
  dsn: setting(v.optional(v.string()), {
    env: 'ERROR_REPORTING_DSN',
    audience: 'derived',
    description:
      'Sentry DSN of the error collector that receives this service’s errors. The DSN key names the component. Error reporting is off while unset.'
  })
});
