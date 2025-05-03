export interface Context {
  ip: string;
  ua?: string;
}

export interface RequestFlags {
  storeRequests?: false | { instanceId: string };
}

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
