process.env.TZ = 'UTC';
process.env.BOXYHQ_NO_ANALYTICS = '1';
process.env.DO_NOT_TRACK = '1';

await import('./api');

await import('./internal');

export {};
