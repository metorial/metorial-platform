import { BaseContext } from '@apollo/server';
import { Context } from '@metorial/context';
import { Organization, OrganizationActor, OrganizationMember } from '@metorial/db';
import { ExecutionContext } from '@metorial/execution-context';
import type { AuthInfo } from '@metorial/module-access';

export type PrivateAuth = AuthInfo & { type: 'user' };

export type DContext = BaseContext & {
  auth: PrivateAuth;
  context: Context;
  organization: Organization;
  member: OrganizationMember;
  actor: OrganizationActor;
  executionContext: ExecutionContext;
};
