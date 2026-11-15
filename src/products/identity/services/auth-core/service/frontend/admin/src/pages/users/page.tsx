import { renderWithLoader } from '@metorial-io/data-hooks';
import { Button, Input } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useEffect, useState } from 'react';
import { appsState, usersState } from '../../state';

export let UsersPage = () => {
  let [after, setAfter] = useState<string | undefined>();
  let [search, setSearch] = useState<string | undefined>();

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
      <UsersForApp
        appId={selectedAppId}
        search={search}
        after={after}
        apps={apps.data.items}
        onAppChange={setSelectedAppId}
        onSearchChange={setSearch}
        onLoadMore={setAfter}
      />
    );
  });
};

let UsersForApp = ({
  appId,
  search,
  after,
  apps,
  onAppChange,
  onSearchChange,
  onLoadMore
}: {
  appId: string;
  search?: string;
  after?: string;
  apps: { id: string; clientId: string }[];
  onAppChange: (id: string) => void;
  onSearchChange: (s: string) => void;
  onLoadMore: (after: string | undefined) => void;
}) => {
  let users = usersState.use({ appId, search, after });

  return renderWithLoader({ users })(({ users }) => (
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

        <form
          style={{ flex: 1 }}
          onSubmit={e => {
            e.preventDefault();
            let formData = new FormData(e.target as HTMLFormElement);
            onSearchChange(formData.get('search') as string);
          }}
        >
          <Input label="Search" hideLabel placeholder="Search" name="search" defaultValue={search} />
        </form>
      </div>

      <Table
        headers={['Name', 'Email', 'Created At', '']}
        data={users.data.items.map(user => ({
          data: [
            user.name,
            user.email,
            new Date(user.createdAt).toLocaleDateString('de-at'),
            <Button as="span" size="1">View</Button>
          ],
          href: `/users/${user.id}`
        }))}
      />

      {users.data.items.length > 0 && (
        <Button
          size="1"
          style={{ marginTop: 20 }}
          onClick={() => onLoadMore(users.data.items[users.data.items.length - 1]?.id)}
        >
          Load More
        </Button>
      )}
    </>
  ));
};
