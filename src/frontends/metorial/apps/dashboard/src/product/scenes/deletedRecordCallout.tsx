import { Callout, Spacer } from '@metorial/ui';

export let DeletedRecordCallout = (p: {
  status?: 'active' | 'archived' | 'deleted' | string | null;
}) => {
  if (p.status !== 'archived' && p.status !== 'deleted') return null;

  return (
    <>
      <Callout color="orange">
        This record has been deleted and is shown here for reference only.
      </Callout>
      <Spacer height={20} />
    </>
  );
};
