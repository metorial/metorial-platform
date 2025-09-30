import { isServiceError } from '@metorial/error';
import { Context } from 'hono';
import { errorHtml } from '../templates/error';

export let wrapHtmlError =
  (c: Context) =>
  async <R>(cb: () => Promise<R>) => {
    try {
      return await cb();
    } catch (err) {
      if (isServiceError(err)) {
        c.status(err.data.status);
        return c.html(errorHtml({
          title: 'Authentication Error',
          message: 'Metorial could not authenticate you.',
          details: err.data.message
        }));
      }

      throw err; // Re-throw if it's not a ServiceError
    }
  };
