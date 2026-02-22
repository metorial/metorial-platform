import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionErrorGroup
} from '@metorial/state';
import { LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';

export let ServerErrorLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { serverErrorId } = useParams();
  let error = useSessionErrorGroup(instance.data?.id, serverErrorId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    error.data?.id ?? serverErrorId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={error.data?.message ?? ''}
        pagination={[
          {
            label: 'Errors',
            href: Paths.instance.providerErrors(organization.data, project.data, instance.data)
          },
          {
            label: error.data?.code ?? 'Error',
            href: Paths.instance.providerError(...serverPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Occurrences',
            to: Paths.instance.providerError(...serverPathParams)
          }
          // {
          //   label: 'Affected Deployments',
          //   to: Paths.instance.providerError(...serverPathParams, 'deployments')
          // }
        ]}
      />

      {renderWithLoader({ error })(({ error }) => (
        <AttributesLayout
          variant="large"
          items={[
            { label: 'Error Group ID', value: <ID id={error.data.id} /> },
            { label: 'First Seen', value: <RenderDate date={error.data.createdAt} /> },
            {
              label: 'Occurrences',
              value: error.data.occurrenceCount ?? '—'
            },
            { label: 'Code', value: error.data.code ?? '—' },
            { label: 'Provider', value: error.data.providerId ?? '—' }
          ]}
        >
          <Outlet />
        </AttributesLayout>
      ))}
    </ContentLayout>
  );
};
