import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProtoGuardConfig
} from '@metorial/state';
import { Badge, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import styled from 'styled-components';
import { ProtoGuardSeverityBadge } from '../../../scenes/monitoring/badges';

type ProtoGuardFilter = {
  id: string;
  name: string;
  issueType: string;
  severity: string;
  enabled: boolean;
  alertConfidenceThreshold: number | null;
  defaultAlertConfidenceThreshold: number;
  scoreWeight: number;
};

let NameCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export let ProtoGuardPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let config = useProtoGuardConfig(instance.data?.id);

  return renderWithLoader({ instance, config })(({ config: loadedConfig }) => (
    <Table
      headers={['Filter', 'Severity', 'Enabled', 'Threshold', 'Default', 'Weight']}
      data={loadedConfig.data.filters.map((filter: ProtoGuardFilter) => ({
        href: Paths.instance.protoguardFilter(
          organization.data,
          project.data,
          instance.data,
          filter.id
        ),
        data: [
          <NameCell>
            <Text size="2" weight="strong">
              {filter.name}
            </Text>
            <Text size="1" color="gray600">
              {filter.issueType}
            </Text>
          </NameCell>,
          <ProtoGuardSeverityBadge severity={filter.severity} />,
          <Badge color={filter.enabled ? 'green' : 'gray'}>
            {filter.enabled ? 'Enabled' : 'Disabled'}
          </Badge>,
          filter.alertConfidenceThreshold ?? 'Default',
          filter.defaultAlertConfidenceThreshold,
          filter.scoreWeight
        ]
      }))}
    />
  ));
};
