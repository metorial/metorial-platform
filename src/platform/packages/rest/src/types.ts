import { Context } from '@metorial/context';

export interface RequestFlags {}

export type Authenticator<AuthInfo> = (
  req: Request,
  url: URL
) => Promise<{
  auth: AuthInfo;
  context: Context;
  flags: RequestFlags;
  defaultVersion: string | undefined;
  allowedVersions: string[];
}>;
