import { AsyncLocalStorage } from 'async_hooks';
import type { SlateContext } from './context';

let asyncLocalStorage = new AsyncLocalStorage<SlateContext<any, any, any>>();

export let runWithContext = <
  ConfigType extends {},
  AuthType extends {},
  InputType extends {},
  RV
>(
  context: SlateContext<ConfigType, AuthType, InputType>,
  fn: () => Promise<RV>
): Promise<RV> => {
  return asyncLocalStorage.run(context, fn);
};

export let getCurrentContext = <
  ConfigType extends {},
  AuthType extends {},
  InputType extends {}
>(): SlateContext<ConfigType, AuthType, InputType> => {
  let context = asyncLocalStorage.getStore();
  if (!context) {
    throw new Error('No Slate context is available');
  }
  return context as SlateContext<ConfigType, AuthType, InputType>;
};
