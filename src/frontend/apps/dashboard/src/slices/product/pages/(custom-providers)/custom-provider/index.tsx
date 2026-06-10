import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { OpenExplorerBox } from '../../../components/openExplorer';
import { CustomProviderEventsTable } from '../../../scenes/customProvider/events';
import { getCustomProviderScmLink } from '../../../scenes/customProvider/utils';
import { UsageScene } from '../../../scenes/usage/usage';

export let CustomProviderOverviewPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ customProvider })(({ customProvider }) => {
    let scmLink = getCustomProviderScmLink(customProvider.data);
    let remoteMcpServer = customProvider.data.draft.remoteMcpServer;

    return (
      <>
        <Attributes
          columns={3}
          attributes={[
            {
              label: 'Provider ID',
              content: customProvider.data.provider ? (
                <ID id={customProvider.data.provider.id} />
              ) : (
                'N/A'
              )
            },
            {
              label: 'Custom Provider ID',
              content: <ID id={customProvider.data.id} />
            },

            ...(scmLink
              ? [
                  {
                    label: 'Repository URL',
                    content: (
                      <a href={scmLink.repositoryUrl} target="_blank" rel="noreferrer">
                        {scmLink.repositoryUrl}
                      </a>
                    )
                  }
                ]
              : remoteMcpServer
                ? [
                    {
                      label: 'Remote MCP Server',
                      content: remoteMcpServer.url
                    }
                  ]
                : [
                    {
                      label: 'Created At',
                      content: <RenderDate date={customProvider.data.provider?.createdAt} />
                    }
                  ])
          ]}
        />

        <Spacer height={15} />

        <OpenExplorerBox
          title="Test Provider"
          description="Use the Metorial Explorer to test your custom provider."
          buttonLabel="Test Provider"
          disabled={!customProvider.data.provider?.id}
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            { provider_id: customProvider.data.provider?.id }
          )}
        />

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
    );
  });
};
