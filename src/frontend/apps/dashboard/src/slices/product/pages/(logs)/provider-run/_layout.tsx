import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, ExtraHeaderLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderRun
} from '@metorial/state';
import { Button, LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { ProviderRunStatusBadge } from '../../../scenes/providerRun/table';

export let ProviderRunLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerRunId } = useParams();
  let run = useProviderRun(instance.data?.id, providerRunId);

  let pathname = useLocation().pathname;

  let providerRunParams = [
    organization.data,
    project.data,
    instance.data,
    run.data?.id ?? providerRunId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link
          to={Paths.instance.providerRuns(organization.data, project.data, instance.data)}
        >
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all provider runs
          </Button>
        </Link>
      }
    >
      <ContentLayout>
        <PageHeader
          title="Provider Run"
          pagination={[
            {
              label: 'Provider Runs',
              href: Paths.instance.providerRuns(
                organization.data,
                project.data,
                instance.data
              )
            },
            {
              label: run.data?.id,
              href: Paths.instance.providerRun(...providerRunParams)
            }
          ]}
        />

        <LinkTabs
          current={pathname}
          links={[
            {
              label: 'Logs',
              to: Paths.instance.providerRun(...providerRunParams)
            }
          ]}
        />

        {renderWithLoader({ run })(({ run }) => (
          <AttributesLayout
            variant="large"
            items={[
              { label: 'Status', value: <ProviderRunStatusBadge run={run.data} /> },
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
    </ExtraHeaderLayout>
  );
};
