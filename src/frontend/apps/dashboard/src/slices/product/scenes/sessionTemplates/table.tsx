import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessionTemplates } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let SessionTemplatesTable = ({ instanceId }: { instanceId: string }) => {
  let instance = useCurrentInstance();
  let templates = useSessionTemplates(instanceId);

  return renderWithPagination(templates)(templates => (
    <>
      <Table
        headers={['Name', 'Providers', 'Created']}
        data={templates.data.items.map(template => ({
          data: [
            <Text size="2" weight="strong">
              {template.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unnamed</span>
              )}
              {template.description && (
                <Text size="2" color="gray600">
                  {template.description.slice(0, 60)}
                  {template.description.length > 60 ? '...' : ''}
                </Text>
              )}
            </Text>,
            <Text size="2">{template.providers?.length ?? 0} providers</Text>,
            <RenderDate date={template.createdAt} />
          ],
          href: Paths.instance.sessionTemplate(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            template.id
          )
        }))}
      />

      {templates.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No templates found.
        </Text>
      )}
    </>
  ));
};
