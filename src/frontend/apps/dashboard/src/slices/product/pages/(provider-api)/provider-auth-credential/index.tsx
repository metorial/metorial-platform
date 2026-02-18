import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigs,
  useProviderAuthCredential,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';

export let ProviderAuthCredentialOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let credential = useProviderAuthCredential(
    instance.data?.id,
    providerDeploymentId,
    providerAuthCredentialsId
  );
  let authConfigs = useProviderAuthConfigs(
    instance.data?.id,
    providerDeploymentId,
    { providerAuthCredentialsId }
  );

  let deploymentHref = Paths.instance.providerDeployment(
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? providerDeploymentId
  );

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'ID',
            content: <ID id={credential.data.id} />
          },
          {
            label: 'Type',
            content: credential.data.type ?? '—'
          },
          {
            label: 'Provider',
            content: deployment.data?.provider?.name ?? deployment.data?.providerId ?? '—'
          },
          {
            label: 'Deployment',
            content: (
              <Link to={deploymentHref}>
                {deployment.data?.name ?? '—'}
              </Link>
            )
          },
          {
            label: 'Auth Configs',
            content: authConfigs.data?.items
              ? String(authConfigs.data.items.length)
              : '—'
          },
          {
            label: 'Created',
            content: credential.data.createdAt ? (
              <RenderDate date={credential.data.createdAt} />
            ) : (
              '—'
            )
          },
          {
            label: 'Updated',
            content: credential.data.updatedAt ? (
              <RenderDate date={credential.data.updatedAt} />
            ) : (
              '—'
            )
          }
        ]}
      />
    </>
  ));
};
