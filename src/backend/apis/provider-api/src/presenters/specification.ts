import { authMethodPresenter, AuthMethodData } from './authMethod';
import { toolPresenter, ToolData } from './tool';

export type SpecificationData = {
  id: string;
  name: string;
  description: string | null;
  configSchema: unknown;
  tools: ToolData[];
  authMethods: AuthMethodData[];
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let specificationPresenter = (specification: SpecificationData) => ({
  object: 'provider.specification' as const,
  id: specification.id,
  name: specification.name,
  description: specification.description,
  configSchema: specification.configSchema,
  tools: specification.tools.map(toolPresenter),
  authMethods: specification.authMethods.map(authMethodPresenter),
  providerId: specification.providerId,
  createdAt: specification.createdAt,
  updatedAt: specification.updatedAt
});
