import { assertTestDatabaseUrl, setupTestGlobals } from '@lowerdeck/testing-tools';

setupTestGlobals({ nodeEnv: 'test', tz: 'UTC' });

assertTestDatabaseUrl(
  process.env.DATABASE_URL ?? '',
  url =>
    process.env.NODE_ENV === 'test' &&
    (process.env.CONTROL_WORKSPACE_ID === 'e2e' || url.toLowerCase().includes('test')),
  'DATABASE_URL'
);
