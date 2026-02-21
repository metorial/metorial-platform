import { ApolloServer } from '@apollo/server';
import express from 'express';
export { expressMiddleware } from '@as-integrations/express5';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import { DContext } from './utils/context';

export let getApolloServer = async () => {
  let app = express();

  let server = new ApolloServer<DContext>({
    introspection: true,
    resolvers,
    typeDefs
  });

  return { server, app };
};
