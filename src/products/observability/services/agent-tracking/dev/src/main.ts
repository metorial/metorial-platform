import { unitTestEnv } from '@mtsrc/agent-tracking-testing/config';
import { metorialConfigPlaceholders } from './lib/placeholders';

// The service's packages, and the Metorial query module whose builders the bench uses, read their
// settings when imported. Every command here runs the parts it needs in-process (parser, dialects,
// record, slice and query builders) without their databases, so settings the operator did not set
// get placeholders before anything loads. Commands read secrets from the environment as it was.
let operatorEnv = { ...process.env };

for (let [key, value] of Object.entries({ ...unitTestEnv, ...metorialConfigPlaceholders })) {
  if (key != 'NODE_ENV') process.env[key] ??= value;
}

let { main } = await import('./commands');

process.exitCode = await main(process.argv.slice(2), operatorEnv);
