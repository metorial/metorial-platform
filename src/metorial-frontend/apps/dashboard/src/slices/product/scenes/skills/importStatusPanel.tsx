import type { DashboardInstanceSkillsImportsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useSkillImport } from '@metorial/state';
import { Attributes, Badge, Callout, Panel, Spacer, Text, showModal } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

type SkillImport = DashboardInstanceSkillsImportsGetOutput;
type SkillImportStatus = SkillImport['status'];

let SkillLink = styled(Link)`
  font-weight: 600;
  text-decoration: none;
`;

let statusColor = (status: SkillImportStatus): 'blue' | 'red' | 'orange' | 'gray' =>
  status == 'completed'
    ? 'blue'
    : status == 'failed'
      ? 'red'
      : status == 'pending' || status == 'processing'
        ? 'orange'
        : 'gray';

let SkillImportStatusBadge = ({ status }: { status: SkillImportStatus }) => (
  <div>
    <Badge size="1" color={statusColor(status)}>
      {status}
    </Badge>
  </div>
);

let SkillImportDetails = (p: {
  instanceId: string;
  skillImportId: string;
  getSkillPath: (skillId: string) => string;
}) => {
  let skillImport = useSkillImport(p.instanceId, p.skillImportId);

  return renderWithLoader({ skillImport })(({ skillImport }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Status',
            content: <SkillImportStatusBadge status={skillImport.data.status} />
          },
          {
            label: 'Repository',
            content:
              skillImport.data.source.repositoryName ??
              (skillImport.data.source.type == 'public'
                ? skillImport.data.source.repositoryUrl
                : skillImport.data.source.repositoryId)
          }
        ]}
      />

      <Spacer height={20} />

      {(skillImport.data.items.length || !skillImport.data.error) && (
        <Table
          headers={['Skill', 'Path', 'Status']}
          data={skillImport.data.items
            .sort((a, b) => a.path.localeCompare(b.path))
            .map(item => ({
              data: [
            item.skill && item.status == 'completed' ? (
                  <SkillLink to={p.getSkillPath(item.skill.id)}>{item.skill.name}</SkillLink>
            ) : item.skill ? (
              <Text size="2" color="gray600">
                {item.skill.name}
              </Text>
                ) : item.error ? (
                  <Text size="2" color="red500">
                    {item.error}
                  </Text>
                ) : (
                  <Text size="2" color="gray600">
                    Waiting for skill…
                  </Text>
                ),
                item.path,
                <SkillImportStatusBadge status={item.status} />
              ]
            }))}
        />
      )}

      {!skillImport.data.items.length && !skillImport.data.error && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 16 }}>
          The repository is being scanned for skills.
        </Text>
      )}

      {skillImport.data.error && (
        <>
          <Spacer height={10} />
          <Callout color="red">{skillImport.data.error}</Callout>
        </>
      )}
    </>
  ));
};

export let showSkillImportStatusPanel = (p: {
  instanceId: string;
  skillImportId: string;
  getSkillPath: (skillId: string) => string;
}) =>
  showModal(({ dialogProps }) => (
    <Panel.Wrapper {...dialogProps} width={900}>
      <Panel.Header>
        <Panel.Title>Skill Import</Panel.Title>
      </Panel.Header>
      <Panel.Content>
        <SkillImportDetails {...p} />
      </Panel.Content>
    </Panel.Wrapper>
  ));
