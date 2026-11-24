export type BootStep = {
  name: string;
  run: () => unknown | Promise<unknown>;
};

export let bootStep = (name: string, run: BootStep['run']): BootStep => ({ name, run });

export let importStep = (name: string, load: () => Promise<unknown>): BootStep =>
  bootStep(name, load);

type BootFailureHandler = (error: unknown, step: string) => void;

let bootFailureHandler: BootFailureHandler | null = null;

export let setBootFailureHandler = (handler: BootFailureHandler | null) => {
  bootFailureHandler = handler;
};

let startMetricsIfEnabled = async () => {
  if (process.env.METRICS_ENABLED !== 'true') return;

  try {
    let { startMetrics } = await import('@metorial/metrics');
    await startMetrics();
  } catch (error) {
    console.error('Metrics could not be started', error);
  }
};

let errorReportingStarted = false;

let startErrorReportingIfConfigured = async () => {
  if (!process.env.ERROR_REPORTING_DSN) return;

  try {
    let { initErrorReporting } = await import('@metorial/error-reporting');
    errorReportingStarted = initErrorReporting();
  } catch (error) {
    console.error('Error reporting could not be started', error);
  }
};

let reportBootFailure = async (error: unknown, step: string) => {
  if (!errorReportingStarted) return;

  try {
    let { reportBootFailure } = await import('@metorial/error-reporting');
    await reportBootFailure(error, step);
  } catch {}
};

export let runBoot = async (steps: BootStep[]) => {
  await startMetricsIfEnabled();
  await startErrorReportingIfConfigured();

  for (let step of steps) {
    try {
      await step.run();
    } catch (error) {
      console.error(`Boot step "${step.name}" failed`, error);
      await reportBootFailure(error, step.name);
      if (!bootFailureHandler) throw error;

      bootFailureHandler(error, step.name);
      await new Promise<never>(() => {});
    }
  }
};
