import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Spacer, toast } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomProviderUpdateForm } from '../../../../scenes/customProvider/updateForm';
import { DeleteResourceDangerZone } from '../../../../scenes/deleteResourceDangerZone';

export let CustomProviderSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let archiveMutator = customProvider.useArchiveMutator();

  return renderWithLoader({ customProvider })(({ customProvider }) => {
    let isArchived = customProvider.data.status === 'archived';

    return (
      <>
        <CustomProviderUpdateForm customProvider={customProvider.data} />

        <Spacer size={15} />

        <DeleteResourceDangerZone
          description="Archive this custom provider to disable all connections, configurations, and deployments linked to it. This action is irreversible."
          buttonLabel="Archive provider"
          confirmTitle="Archive custom provider"
          confirmDescription="This will archive the custom provider, its linked provider resources, auth configs, configs, deployments, and integrations. This action cannot be undone. Are you sure you want to proceed?"
          confirmText="Archive"
          disabled={isArchived}
          loading={archiveMutator.isLoading}
          success={archiveMutator.isSuccess}
          onDelete={async () => {
            await archiveMutator.mutate({});
            toast.success('Custom provider archived');

            if (!instance.data) return;

            navigate(
              customProvider.data.type === 'remote'
                ? Paths.instance.externalProviders(
                    instance.data.organization,
                    instance.data.project,
                    instance.data
                  )
                : Paths.instance.customProviders(
                    instance.data.organization,
                    instance.data.project,
                    instance.data
                  )
            );
          }}
        />
      </>
    );
  });
};
