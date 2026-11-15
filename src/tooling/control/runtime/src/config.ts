export interface DatabaseConfig {
  name: string;
  schema: string;
  env: string | string[];
  fallback?: string | string[];
  parts?: string | string[];
  query?: string;
  precedence?: 'url' | 'parts';
  defaults?: { port?: string; name?: string };
  encode?: boolean;
  iam?: { arnEnv: string; regionEnv?: string };
  lock?: number;
  renames?: { table: string; from: string; to: string }[];
}

export interface RuntimeConfig {
  databases: DatabaseConfig[];
}
