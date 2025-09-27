import fs from 'fs/promises';
import path from 'path';

export let typeDefs = `#graphql
type Query {
  getFlags: DFlags!
  getUser: DUser!
  getOrganization: DOrganization!

  getProviderOauthConnectionTestSession(
    connectionId: String!,
    instanceId: String!,
    redirectUri: String!
  ): DProviderOauthConnectionTestSession!
}

type DFlags {
  flags: [DFlag!]!
  target: String!
  organization: DOrganization!
}

type DFlag {
  id: ID!
  slug: String!
  value: Boolean!
}

type DOrganization {
  id: ID!
  status: String!
  type: String!
  name: String!
  slug: String!
  imageUrl: String!
  createdAt: DateTimeISO!
  updatedAt: DateTimeISO!
}

type DUser {
  id: ID!
  status: String!
  type: String!
  email: String!
  name: String!
  firstName: String
  lastName: String
  imageUrl: String!
  createdAt: DateTimeISO!
  updatedAt: DateTimeISO!
}

type DProviderOauthConnectionTestSession {
  connection: DProviderOauthConnection!
  testUrl: String!
}

type DProviderOauthConnection {
  id: ID!
  name: String
  description: String
  clientId: String
  scopes: [String!]!  
  config: JSON!
  createdAt: DateTimeISO!
  updatedAt: DateTimeISO!
  instanceId: String!
  metadata: JSON
}

scalar DateTimeISO

scalar JSON
`;

(async () => {
  if (process.env.NODE_ENV === 'development') {
    await fs.writeFile(path.join(__dirname, '../schema.graphql'), typeDefs);
  }
})().catch(console.error);
