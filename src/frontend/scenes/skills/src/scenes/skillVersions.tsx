import { renderWithPagination } from '@metorial/data-hooks';
import { useSkillVersions } from '@metorial/state';
import { Entity, RenderDate, Text } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import styled from 'styled-components';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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
        <Items>
          {versions.data.items.map(version => (
            <Entity.Wrapper key={version.id} aligned>
              <Entity.Content>
                <Entity.Field title={`Version ${version.versionNumber}`} />
                <Entity.Field
                  title="Created"
                  value={<RenderDate date={version.createdAt} />}
                />
                <Entity.Field
                  title="Store version"
                  value={<ID id={version.storeVersionId} />}
                />
                <Entity.Field title="ID" value={<ID id={version.id} />} />
              </Entity.Content>
            </Entity.Wrapper>
          ))}
        </Items>
      )}
    </Box>
  ));
};
