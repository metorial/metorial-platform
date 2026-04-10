import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Attributes, Badge, Button, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomProviderEventsTable } from '../../../scenes/customProvider/events';
import { getCustomProviderScmLink } from '../../../scenes/customProvider/utils';
import { UsageScene } from '../../../scenes/usage/usage';

export let CustomProviderOverviewPage = () => {
  let instance = useCurrentInstance();

  let navigate = useNavigate();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let isExternalProvider = Boolean(customProvider.data?.draft?.remoteMcpServer);

  return renderWithLoader({ customProvider })(({ customProvider }) => (
    <>
      <Attributes
        columns={3}
        attributes={[
          {
            label: 'Name',
            content: customProvider.data.name
          },
          {
            label: 'Status',
            content: customProvider.data.status ? (
              <Badge
                color={
                  customProvider.data.status === 'active'
                    ? 'green'
                    : customProvider.data.status === 'archived'
                      ? 'gray'
                      : 'blue'
                }
              >
                {customProvider.data.status}
              </Badge>
            ) : (
              'Unknown'
            )
          },
          {
            label: 'Provider ID',
            content: customProvider.data.provider ? (
              <ID id={customProvider.data.provider.id} />
            ) : (
              'N/A'
            )
          },
          {
            label: 'Publisher',
            content: customProvider.data.provider?.publisher?.name ?? 'N/A'
          },
          {
            label: 'Created At',
            content: <RenderDate date={customProvider.data.createdAt!} />
          },
          {
            label: 'Custom Provider ID',
            content: <ID id={customProvider.data.id} />
          },
          ...(() => {
            let scmLink = getCustomProviderScmLink(customProvider.data);
            if (!scmLink) return [];

            return [
              {
                label: 'Repository URL',
                content: (
                  <a href={scmLink.repositoryUrl} target="_blank" rel="noreferrer">
                    {scmLink.repositoryUrl}
                  </a>
                )
              },
              ...(scmLink.branch
                ? [
                    {
                      label: 'Branch',
                      content: scmLink.branch
                    }
                  ]
                : [])
            ];
          })()
        ]}
      />

      <Spacer height={15} />

      <SideBox
        title="Test Provider"
        description="Use the Metorial Explorer to test your custom provider."
      >
        <Button
          as="span"
          size="2"
          disabled={!customProvider.data.provider?.id}
          onClick={async () => {
            navigate(
              Paths.instance.explorer(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                { provider_id: customProvider.data.provider?.id }
              )
            );
          }}
        >
          Test Provider
        </Button>
      </SideBox>

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how this custom provider is being in your instance."
        entities={[{ type: 'provider', id: customProvider.data.provider?.id ?? 'xxxx' }]}
        entityNames={{
          [customProvider.data.provider?.id ?? 'xxxx']: customProvider.data.provider?.name!
        }}
      />

      <Spacer height={15} />

      <Box
        title="Provider Commits"
        description="Recent commit/apply history for this provider."
      >
        <CustomProviderEventsTable customProvider={customProvider.data} />
      </Box>
    </>
  ));
};
