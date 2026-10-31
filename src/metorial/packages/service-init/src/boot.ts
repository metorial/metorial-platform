export type BootStep = {
  name: string;
  run: () => unknown | Promise<unknown>;
};

export let bootStep = (name: string, run: BootStep['run']): BootStep => ({ name, run });

export let importStep = (name: string, load: () => Promise<unknown>): BootStep =>
  bootStep(name, load);

export let runBoot = async (steps: BootStep[]) => {
  for (let step of steps) {
    try {
      await step.run();
    } catch (error) {
      console.error(`Boot step "${step.name}" failed`, error);
      throw error;
    }
  }
};
