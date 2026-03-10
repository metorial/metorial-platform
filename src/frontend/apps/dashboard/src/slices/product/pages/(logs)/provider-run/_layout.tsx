import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderRun
} from '@metorial/state';
import { LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { ServerRunStatusBadge } from '../../../scenes/providerRun/table';

export let ProviderRunLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerRunId } = useParams();
  let run = useProviderRun(instance.data?.id, providerRunId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    run.data?.id ?? providerRunId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Provider Run"
        pagination={[
          {
            label: 'Provider Runs',
            href: Paths.instance.providerRuns(organization.data, project.data, instance.data)
          },
          {
            label: run.data?.id,
            href: Paths.instance.providerRun(...serverPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Logs',
            to: Paths.instance.providerRun(...serverPathParams)
          }
        ]}
      />

      {renderWithLoader({ run })(({ run }) => (
        <AttributesLayout
          variant="large"
          items={[
            { label: 'Status', value: <ServerRunStatusBadge run={run.data} /> },
            { label: 'Run ID', value: <ID id={run.data.id} /> },
            { label: 'Created At', value: <RenderDate date={run.data.createdAt} /> },
            {
              label: 'Completed At',
              value: run.data.completedAt ? (
                <RenderDate date={run.data.completedAt} />
              ) : (
                <span style={{ opacity: 0.6 }}>Running</span>
              )
            },
            {
              label: 'Provider ID',
              value: <ID id={run.data.providerId ?? '—'} />
            },
            {
              label: 'Session ID',
              value: <ID id={run.data.sessionId ?? '—'} />
            }
          ]}
        >
          <Outlet />
        </AttributesLayout>
      ))}
    </ContentLayout>
  );
};
