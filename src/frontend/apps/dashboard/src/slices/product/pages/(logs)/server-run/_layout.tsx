import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useServerRun
} from '@metorial/state';
import { LinkTabs, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { ServerRunStatusBadge } from '../../../scenes/serverRuns/table';

export let ServerRunLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { serverRunId } = useParams();
  let run = useServerRun(instance.data?.id, serverRunId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    run.data?.id ?? serverRunId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Server Run"
        pagination={[
          {
            label: 'Server Runs',
            href: Paths.instance.serverRuns(organization.data, project.data, instance.data)
          },
          {
            label: run.data?.id,
            href: Paths.instance.serverRun(...serverPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Logs',
            to: Paths.instance.serverRun(...serverPathParams)
          }
        ]}
      />

      {renderWithLoader({ run })(({ run }) => (
        <AttributesLayout
          variant="large"
          items={[
            { label: 'Status', value: <ServerRunStatusBadge run={run.data} /> },
            { label: 'Run Group ID', value: <ID id={run.data.id} /> },
            { label: 'Created At', value: <RenderDate date={run.data.createdAt} /> },
            {
              label: 'Start At',
              value: run.data.startedAt ? (
                <RenderDate date={run.data.startedAt} />
              ) : (
                <span style={{ opacity: 0.6 }}>Pending</span>
              )
            },
            {
              label: 'Stopped At',
              value: run.data.stoppedAt ? (
                <RenderDate date={run.data.stoppedAt} />
              ) : (
                <span style={{ opacity: 0.6 }}>Pending</span>
              )
            },
            {
              label: 'Deployment ID',
              value: <ID id={run.data.serverDeployment.id} />
            },
            {
              label: 'Server ID',
              value: <ID id={run.data.server.id} />
            },
            {
              label: 'Session ID',
              value: <ID id={run.data.serverSession.sessionId} />
            }
          ]}
        >
          <Outlet />
        </AttributesLayout>
      ))}
    </ContentLayout>
  );
};
