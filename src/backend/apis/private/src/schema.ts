import fs from 'fs/promises';
import path from 'path';

export let typeDefs = `#graphql
type Query {
  getFlags: DFlags!
  getUser: DUser!
  getOrganization: DOrganization!
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

scalar DateTimeISO
`;

(async () => {
  if (process.env.NODE_ENV === 'development') {
    await fs.writeFile(path.join(__dirname, '../schema.graphql'), typeDefs);
  }
})().catch(console.error);
