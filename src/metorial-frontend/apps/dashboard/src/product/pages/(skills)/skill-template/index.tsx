import { renderWithLoader } from '@metorial/data-hooks';
import { DocumentEditorScene, DocumentSkeleton } from '@metorial/scene-docs';
import { useSkillWorkspace } from '@metorial/scene-skills';
import { useAllStoreItems, useCurrentInstance, useSkillTemplate } from '@metorial/state';
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

export let SkillTemplatePage = () => {
  let instance = useCurrentInstance();
  let { skillTemplateId } = useParams();
  let workspace = useSkillWorkspace();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);
  let storeItems = useAllStoreItems(instance.data?.id, skillTemplate.data?.storeId, {
    order: 'asc',
    type: ['document']
  });

  return (
    <DocumentPage>
      {!skillTemplate.data || !storeItems.data ? (
        skillTemplate.error || storeItems.error ? (
          renderWithLoader({ skillTemplate, storeItems })(() => null)
        ) : (
          <DocumentSkeleton />
        )
      ) : (
        renderWithLoader({ skillTemplate, storeItems })(({ storeItems }) => {
          let document = storeItems.data.find(
            item => item.path.replace(/^\/+/, '').toLowerCase() == 'skill.md'
          )?.document;

          if (!document) {
            return (
              <EmptyState>
                <Text color="gray600">
                  This template does not contain a SKILL.md document.
                </Text>
              </EmptyState>
            );
          }

          return (
            <DocumentEditorScene
              instanceId={instance.data?.id}
              documentId={document.id}
              chrome={workspace ? 'external' : undefined}
              titleAccessory={workspace?.skillDocumentTitleAccessory}
              setRestrictHeight={enabled =>
                (window as any).metorial_setRestrictHeight?.(enabled)
              }
              hideSharingControls
            />
          );
        })
      )}
    </DocumentPage>
  );
};
