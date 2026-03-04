import { useForm } from '@metorial/data-hooks';
import { Input, Spacer } from '@metorial/ui';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ProvidersGrid } from '../../../scenes/providers/grid_';

export let ProvidersPage = () => {
  let form = useForm({
    initialValues: {
      search: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        search: yup.string().defined()
      })
  });
  let searchDebounced = useDebounced(form.values.search, 500);

  return (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for providers..."
        {...form.getFieldProps('search')}
      />

      <Spacer size={15} />

      <ProvidersGrid search={searchDebounced} limit={21} />
    </>
  );
};
