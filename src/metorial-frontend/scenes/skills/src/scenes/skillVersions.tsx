import { renderWithPagination } from '@metorial/data-hooks';
import { useSkillVersions } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import styled from 'styled-components';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

export let SkillVersionsScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
}) => {
  let versions = useSkillVersions(p.instanceId, p.skillId, { order: 'desc' });

  return renderWithPagination(versions)(versions => (
    <Box title="Versions" description="Version history captured from this skill's files.">
      {versions.data.items.length === 0 ? (
        <EmptyState>
          <Text color="gray600" size="2">
            No versions found for this skill yet.
          </Text>
        </EmptyState>
      ) : (
        <Table
          headers={['Version', 'Created', 'ID']}
          data={versions.data.items.map(version => [
            `Version ${version.versionNumber}`,
            <RenderDate date={version.createdAt} />,
            <ID id={version.id} />
          ])}
        />
      )}
    </Box>
  ));
};
