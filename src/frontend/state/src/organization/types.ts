import { DashboardBootOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';

export type MetorialBootUser = DashboardBootOutput['user'];
export type MetorialOrganization = DashboardBootOutput['organizations'][number];

export type MetorialProject = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MetorialInstance = {
  object: 'organization.instance';
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  type: 'development' | 'production';
  createdAt: Date;
  updatedAt: Date;
  project: MetorialProject;
};
export type MetorialApiKey = {
  object: string;
  id: string;
  status: string;
  secretRedacted: string;
  secretRedactedLong?: string;
  secret: string | null;
  type: string;
  name: string;
  instanceId?: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  revealInfo?: {
    forever?: boolean;
    until?: Date;
  };
  [key: string]: unknown;
};
