import { renderWithLoader } from '@metorial/data-hooks';
import { DocumentEditorScene } from '@metorial/scene-docs';
import {
  useAllStoreItems,
  useCurrentInstance,
  useCurrentOrganization,
  useSkill
} from '@metorial/state';
import { Text } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let DocumentPage = styled.div`
  height: 100%;
  min-height: 0;
`;

let EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 32px;
`;

export let SkillPage = () => {
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let storeItems = useAllStoreItems(instance.data?.id, skill.data?.storeId, {
    order: 'asc',
    type: ['document']
  });

  return (
    <DocumentPage>
      {renderWithLoader({ skill, storeItems })(({ skill, storeItems }) => {
        let skillDocument = storeItems.data.find(
          item => item.path.replace(/^\/+/, '').toLowerCase() == 'skill.md'
        )?.document;

        if (!skillDocument) {
          return (
            <EmptyState>
              <Text color="gray600">This skill does not contain a SKILL.md document.</Text>
            </EmptyState>
          );
        }

        return (
          <DocumentEditorScene
            instanceId={instance.data?.id}
            documentId={skillDocument.id}
            setRestrictHeight={enabled =>
              (window as any).metorial_setRestrictHeight?.(enabled)
            }
            hideSharingControls
            skillShareContext={{
              mode: 'dashboard',
              organizationId: organization.data?.id,
              skills: [{ id: skill.data.id, name: skill.data.name }]
            }}
          />
        );
      })}
    </DocumentPage>
  );
};
