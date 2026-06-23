import { renderWithLoader } from '@metorial-io/data-hooks';
import { Button, Input } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useState } from 'react';
import { adminsState } from '../../state';

export let AdminsPage = () => {
  let [after, setAfter] = useState<string | undefined>();
  let [search, setSearch] = useState<string | undefined>();

  let admins = adminsState.use({
    search,
    after
  });

  return renderWithLoader({ admins })(({ admins }) => (
    <>
      <form
        style={{ marginBottom: 20 }}
        onSubmit={e => {
          e.preventDefault();
          let formData = new FormData(e.target as HTMLFormElement);
          let search = formData.get('search') as string;
          setSearch(search);
        }}
      >
        <Input label="Search" hideLabel placeholder="Search" name="search" defaultValue={search} />
      </form>

      <Table
        headers={['Name', 'Email', 'Created At']}
        data={admins.data.items.map((admin: any) => [
          admin.name,
          admin.email,
          new Date(admin.createdAt).toLocaleDateString('de-at')
        ])}
      />

      {admins.data.items.length > 0 && (
        <Button
          size="1"
          style={{ marginTop: 20 }}
          onClick={() => setAfter(admins.data.items[admins.data.items.length - 1]?.id)}
        >
          Load More
        </Button>
      )}
    </>
  ));
};
