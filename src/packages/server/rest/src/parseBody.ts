import { ServiceError, badRequestError } from '@metorial/error';
import { Context } from 'hono';
import qs from 'qs';

export let parseBody = async (c: Context<any, string, any>) => {
  let contentType = c.req.header('Content-Type');
  if (!contentType) return null;

  if (contentType.includes('application/json')) {
    try {
      let body = await c.req.text();
      return {
        type: 'json' as const,
        data: JSON.parse(body)
      };
    } catch (e) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid JSON body',
          reason: 'invalid_json_body'
        })
      );
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    try {
      let body = await c.req.text();
      return {
        type: 'form-urlencoded' as const,
        data: qs.parse(body)
      };
    } catch (e) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid form-urlencoded body',
          reason: 'invalid_form-urlencoded_body'
        })
      );
    }
  }

  throw new ServiceError(
    badRequestError({
      message: `Unsupported content type ${contentType}`,
      reason: 'unsupported_content_type'
    })
  );
};
