import { ApolloServer } from '@apollo/server';
import express from 'express';
import fs from 'fs/promises';
import { printSchema } from 'graphql';
import path from 'path';
import { buildSchema } from 'type-graphql';
import { FlagsResolver } from './resolvers/flags';
import { UserResolver } from './resolvers/user';
import { DContext } from './utils/context';

export let getApolloServer = async () => {
  let schema = await buildSchema({
    resolvers: [UserResolver, FlagsResolver],
    validate: true
  });

  let app = express();

  let server = new ApolloServer<DContext>({
    schema,
    introspection: true
  });

  let schemaString = printSchema(schema);
  if (process.env.NODE_ENV === 'development') {
    await fs.writeFile(path.join(__dirname, '../schema.graphql'), schemaString);
  }

  return { server, app };
};
