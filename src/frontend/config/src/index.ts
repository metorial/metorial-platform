import { defaultConfig, FrontendConfig, RequiredFrontendConfig } from './type';

let config: FrontendConfig | null = null;

export let setConfig = (newConfig: RequiredFrontendConfig) => {
  config = {
    ...defaultConfig,
    ...config,
    ...newConfig
  };

  console.log('Frontend config set', config);
};

export let getConfig = () => {
  if (!config) throw new Error('Config not set');
  return config;
};

export * from './paths';
