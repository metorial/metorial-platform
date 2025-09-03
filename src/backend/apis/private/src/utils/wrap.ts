import { provideExecutionContext } from '@metorial/execution-context';
import { DContext } from './context';
import { wrapPrivateError } from './error';

export let wrapGQL = <T>(context: DContext, cb: () => Promise<T>): Promise<T> =>
  provideExecutionContext(context.executionContext, () => wrapPrivateError(cb));
