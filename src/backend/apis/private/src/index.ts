import { expressMiddleware } from '@as-integrations/express5';
import { getDashboardAuthCookieFromNodeReq } from '@metorial/auth';
import { Context } from '@metorial/context';
import { notFoundError, ServiceError, unauthorizedError } from '@metorial/error';
import {
  createExecutionContext,
  provideExecutionContext,
  updateExecutionContext
} from '@metorial/execution-context';
import { extractIp } from '@metorial/forwarded-for';
import { generateCustomId } from '@metorial/id';
import { authenticationService } from '@metorial/module-access';
import { organizationService } from '@metorial/module-organization';
import express from 'express';
import { getApolloServer } from './server';
import { DContext } from './utils/context';
import { wrapPrivateError } from './utils/error';

export let startPrivateApiServer = async ({ port }: { port: number }) => {
  let { server, app } = await getApolloServer();

  await server.start();

  app.use(express.json());
  app.use((req, res, next) => {
    let origin = req.headers.origin ?? '*';

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  app.use(
    '/dashboard/organizations/:organizationId/graphql',
    expressMiddleware(server, {
      context: async ({ req }): Promise<DContext> => {
        let context: Context = {
          ua: req.headers['user-agent'] ?? 'unknown',
          ip: extractIp(req.headers as any) ?? '0.0.0.0'
        };

        let executionContext = createExecutionContext({
          type: 'request',
          contextId: generateCustomId('req_'),
          ip: context.ip,
          userAgent: context.ua!
        });

        return provideExecutionContext(executionContext, () =>
          wrapPrivateError(async () => {
            let sessionClientSecret = getDashboardAuthCookieFromNodeReq(req);

            if (!sessionClientSecret) {
              throw new ServiceError(
                unauthorizedError({
                  message: 'Missing Authorization header',
                  description: `Expected the authentication header to be "Bearer <token>".`,
                  hint: 'Copy your API key from the Metorial dashboard and use it in the "Authorization" header in the format "Bearer your_token_from_the_dashboard"'
                })
              );
            }

            let auth = await authenticationService.authenticate({
              type: 'user_session',
              sessionClientSecret: sessionClientSecret!,
              context
            });

            if (auth.type !== 'user') {
              throw new ServiceError(
                unauthorizedError({
                  message: 'Invalid session',
                  description: 'The provided session is not valid for user authentication.'
                })
              );
            }

            let executionContext = updateExecutionContext({
              userId: auth.user.id,
              machineAccessId: auth.machineAccess?.id,
              ip: context.ip,
              userAgent: context.ua ?? 'unknown'
            });

            let { organization, member, actor } =
              await organizationService.getOrganizationByIdForUser({
                organizationId: req.params.organizationId,
                user: auth.user
              });

            return {
              auth,
              context,
              executionContext,

              organization,
              member,
              actor
            };
          })
        );
      }
    })
  );

  app.all('/*path', (req, res) => {
    res.status(404).send(notFoundError({ entity: 'endpoint' }).toResponse());
  });

  app.listen(port, () => {
    console.log(`Private API server running at http://localhost:${port}/graphql`);
  });
};
