import { defaultConfig } from './defaultConfig';
import { MetorialConfig } from './types';

let config = { ...defaultConfig };

export let setConfig = (newConfig: Partial<MetorialConfig>) => {
  config = Object.assign(config, newConfig);
};

export let getConfig = () => config;
