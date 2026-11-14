import { renderWithLoader } from '@metorial-io/data-hooks';
import { Button, Select } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useEffect, useState } from 'react';
import { appsState, auditLogsState } from '../../state';

let AUDIT_LOG_TYPES = [
  'login',
  'login.email',
  'login.oauth',
  'login.sso',
  'logout',
  'auth.blocked',
  'user.created',
  'user.updated',
  'user.deleted',
  'user.email.added',
  'user.email.verified',
  'user.email.primary_changed',
  'user.email.deleted'
];

export let AuditLogsPage = () => {
  let apps = appsState.use({});

  let firstAppId = apps.data?.items?.[0]?.id;
  let [selectedAppId, setSelectedAppId] = useState<string | undefined>();
  useEffect(() => {
    if (firstAppId) setSelectedAppId(firstAppId);
  }, [firstAppId]);

  if (!selectedAppId) {
    return <div>No apps found. Create an app first.</div>;
  }

  return renderWithLoader({ apps })(({ apps }) => {
    return (
      <AuditLogsForApp
        appId={selectedAppId}
        apps={apps.data.items}
        onAppChange={setSelectedAppId}
      />
    );
  });
};

let AuditLogsForApp = ({
  appId,
  apps,
  onAppChange
}: {
  appId: string;
  apps: { id: string; clientId: string }[];
  onAppChange: (id: string) => void;
}) => {
  let [after, setAfter] = useState<string | undefined>();
  let [type, setType] = useState<string | undefined>();

  let auditLogs = auditLogsState.use({ appId, after, type });

  return renderWithLoader({ auditLogs })(({ auditLogs }) => (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {apps.length > 1 && (
          <select
            value={appId}
            onChange={e => onAppChange(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}
          >
            {apps.map(app => (
              <option key={app.id} value={app.id}>
                {app.clientId}
              </option>
            ))}
          </select>
        )}

        <Select
          value={type ?? 'all'}
          onChange={val => {
            setType(val === 'all' ? undefined : val);
            setAfter(undefined);
          }}
          placeholder="Filter by type"
          items={[
            { id: 'all', label: 'All types' },
            ...AUDIT_LOG_TYPES.map(t => ({ id: t, label: t }))
          ]}
        />
      </div>

      <Table
        headers={['Type', 'User', 'IP', 'Metadata', 'Created At']}
        data={auditLogs.data.items.map((log: any) => [
          <code style={{ fontSize: 12 }}>{log.type}</code>,
          log.user?.email ?? '-',
          log.ip ?? '-',
          <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {log.metadata ? JSON.stringify(log.metadata) : '-'}
          </span>,
          new Date(log.createdAt).toLocaleString('de-at')
        ])}
      />

      {auditLogs.data.items.length > 0 && (
        <Button
          size="1"
          style={{ marginTop: 20 }}
          onClick={() => setAfter(auditLogs.data.items[auditLogs.data.items.length - 1]?.id)}
        >
          Load More
        </Button>
      )}
    </>
  ));
};
