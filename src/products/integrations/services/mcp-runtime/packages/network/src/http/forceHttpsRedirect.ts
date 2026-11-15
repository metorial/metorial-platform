import type { HttpStatusCode } from 'axios';

export let forceHttpsRedirect = (initialUrlRaw: string) => {
  let initialUrl = new URL(initialUrlRaw);

  return {
    beforeRedirect: (
      options: Record<string, any>,
      responseDetails: {
        headers: Record<string, string>;
        statusCode: HttpStatusCode;
      }
    ) => {
      // Build the would-be redirected URL from follow-redirects' options
      let next = new URL(`${options.protocol}//${options.hostname}${options.path}`);

      if (initialUrl.protocol == 'https:' && next.protocol == 'http:') {
        next.protocol = 'https:';
        if (next.port === '80') next.port = '';
      }

      options.protocol = next.protocol;
      options.hostname = next.hostname;
      options.host = next.host;
      options.path = next.pathname + next.search;
    }
  };
};
