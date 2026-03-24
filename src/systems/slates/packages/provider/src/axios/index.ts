import baseAxios, { type CreateAxiosDefaults } from 'axios';
import { getCurrentContext } from '../context/hook';

baseAxios.interceptors.request.use(
  request => {
    // Has to be called in the context of an action execution
    let ctx = getCurrentContext();
    let spec = ctx.specification;

    request.headers.set('User-Agent', `slates.dev@1.0.0/${spec.key}`);
    request.headers.set('X-Slates-Provider', spec.key);

    return request;
  },
  error => Promise.reject(error)
);

export let createAxios = (config?: CreateAxiosDefaults) => {
  let instance = baseAxios.create({
    ...config,
    headers: {
      ...config?.headers
    }
  });

  instance.interceptors.request.use(
    request => {
      // Has to be called in the context of an action execution
      let ctx = getCurrentContext();
      let spec = ctx.specification;

      request.headers.set('User-Agent', `slates.dev@1.0.0/${spec.key}`);
      request.headers.set('X-Slates-Provider', spec.key);

      return request;
    },
    error => Promise.reject(error)
  );

  return instance;
};

export let axios = createAxios();
