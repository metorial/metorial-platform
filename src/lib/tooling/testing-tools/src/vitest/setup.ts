export type TestGlobalsOptions = {
  tz?: string;
  nodeEnv?: string;
};

export const setupTestGlobals = (options: TestGlobalsOptions = {}): void => {
  if (options.tz) {
    process.env.TZ = options.tz;
  }

  if (options.nodeEnv) {
    process.env.NODE_ENV = options.nodeEnv;
  }
};
