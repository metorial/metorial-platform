import { SQL } from 'bun';
import { ssoSqlConnection } from './ssoSqlConnection';

export let createSsoSql = (url: string, sslFallback?: string) => {
  let connection = ssoSqlConnection(url, sslFallback);
  return new SQL(connection.url, { tls: connection.tls });
};
