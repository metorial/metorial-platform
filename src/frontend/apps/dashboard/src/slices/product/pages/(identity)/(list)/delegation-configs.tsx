import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { IdentityDelegationConfigsTable } from '../../../scenes/identity/delegationConfigsTable';

export let IdentityDelegationConfigsPage = () => {
  let instance = useCurrentInstance();
  let { search, setSearch, searchQuery } = useSearchFilter();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search delegation configs..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <IdentityDelegationConfigsTable
        instanceId={instance.data.id}
        filters={{ search: searchQuery }}
      />
    </>
  ));
};
