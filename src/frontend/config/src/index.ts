import { ProgrammablePromise } from '@metorial/programmable-promise';
import { defaultConfig, FrontendConfig, RequiredFrontendConfig } from './type';

let configRef: { current: FrontendConfig | null } = { current: null };
let configPromise = new ProgrammablePromise<void>();

export let setConfig = (newConfig: RequiredFrontendConfig) => {
  configRef.current = {
    ...defaultConfig,
    ...configRef.current,
    ...newConfig
  };

  setTimeout(() => configPromise.resolve(), 0);
};

export let getConfig = () => {
  if (!configRef.current) throw new Error('Config not set');
  return configRef.current;
};

export let awaitConfig = async () => {
  if (configRef.current) return configRef.current;
  await configPromise.promise;
  return configRef.current!;
};

export * from './paths';
