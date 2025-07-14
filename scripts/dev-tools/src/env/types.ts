export type Env = {
  key: string;
  defaultValue?: string;
  isRequired?: boolean;
  isEnterprise?: boolean;
}[];

export type Destination = {
  type: 'oss' | 'enterprise';
  env: Env;
  path: string;
};
