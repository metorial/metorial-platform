import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMonitorAlert
} from '@metorial/state';
import { Button, Flex } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { useEffect } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  MonitorAlertStatusBadge,
  MonitorTargetBadge
} from '../../../scenes/monitoring/badges';

let OutletWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

let getAlertTitle = (alert: any) => {
  if (alert.protoGuardAlertId) return 'Prompt injection detected';

  let notification = alert.specificationChangeNotification;
  if (!notification) return 'Schema change alert';

  if (notification.fromSpecification) {
    return notification.toSpecification
      ? 'Provider schema changed'
      : 'Provider schema was removed';
  }

  return 'Provider schema was added';
};

let getAlertDescription = (alert: any) => {
  if (alert.protoGuardAlertId) return 'ProtoGuard detected a prompt-injection signal.';
  return undefined;
};

let MarkAlertViewed = ({ alert }: { alert: ReturnType<typeof useMonitorAlert> }) => {
  let viewed = alert.viewedMutator();
  let alertId = alert.data?.id;

  useEffect(() => {
    if (!alertId) return;
    viewed.mutate(undefined);
  }, [alertId]);

  return null;
};

let AlertHeaderActions = ({ alert }: { alert: ReturnType<typeof useMonitorAlert> }) => {
  let resolve = alert.resolveMutator();
  let unresolve = alert.unresolveMutator();

  if (alert.data?.status === 'resolved') {
    return (
      <Button
        size="2"
        color="black"
        variant="outline"
        loading={unresolve.isLoading}
        success={unresolve.isSuccess}
        onClick={() => unresolve.mutate(undefined)}
      >
        Reopen
      </Button>
    );
  }

  return (
    <Button
      size="2"
      color="black"
      variant="solid"
      loading={resolve.isLoading}
      success={resolve.isSuccess}
      onClick={() => resolve.mutate(undefined)}
    >
      Resolve
    </Button>
  );
};

export let AlertLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let { monitorAlertId } = useParams();
  let alert = useMonitorAlert(instance.data?.id, monitorAlertId);
  let pathname = useLocation().pathname;

  return (
    <ExtraHeaderLayout
      header={
        <Link to={Paths.instance.alerts(organization.data, project.data, instance.data)}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all alerts
          </Button>
        </Link>
      }
    >
      <MarkAlertViewed alert={alert} />
      {renderWithLoader({ alert })(({ alert: loadedAlert }) => {
        let title = getAlertTitle(loadedAlert.data);

        return (
          <ContentPanelLayout
            title={title}
            description={getAlertDescription(loadedAlert.data)}
            breadcrumbs={[
              {
                label: 'Alerts',
                to: Paths.instance.alerts(organization.data, project.data, instance.data)
              },
              {
                label: title,
                to: Paths.instance.alert(
                  organization.data,
                  project.data,
                  instance.data,
                  loadedAlert.data.id
                )
              }
            ]}
            extra={
              <Flex gap="5px" align="center" wrap="wrap">
                <MonitorAlertStatusBadge status={loadedAlert.data.status} />
                <MonitorTargetBadge target={loadedAlert.data.monitor.target} />
              </Flex>
            }
            actions={<AlertHeaderActions alert={alert} />}
            links={{
              current: pathname,
              items: [
                {
                  label: 'Overview',
                  to: Paths.instance.alert(
                    organization.data,
                    project.data,
                    instance.data,
                    loadedAlert.data.id
                  )
                },
                {
                  label: 'Access',
                  to: Paths.instance.alert(
                    organization.data,
                    project.data,
                    instance.data,
                    loadedAlert.data.id,
                    'access'
                  )
                }
              ]
            }}
          >
            <InitialLoadBoundary>
              <OutletWrapper>
                <Outlet />
              </OutletWrapper>
            </InitialLoadBoundary>
          </ContentPanelLayout>
        );
      })}
    </ExtraHeaderLayout>
  );
};
