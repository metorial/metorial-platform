import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProviderSessionProviders } from '../../(logs)/provider-session/providers';
import { RenderWithResolvedMagicMcpSession } from '../../../scenes/magicMcp/resolvedSession';

export let MagicMcpConnectionProvidersPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { connectionId } = useParams();

  return (
    <RenderWithResolvedMagicMcpSession magicMcpSessionId={connectionId}>
      {({ session }) => (
        <ProviderSessionProviders
          organization={organization.data}
          project={project.data}
          instance={instance.data}
          session={session}
        />
      )}
    </RenderWithResolvedMagicMcpSession>
  );
};
