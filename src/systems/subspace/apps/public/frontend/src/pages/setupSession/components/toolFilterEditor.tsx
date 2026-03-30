import { Checkbox, Flex, OptionToggle, Text, theme } from '@metorial/ui';
import styled from 'styled-components';
import type { ToolListItem } from '../types';

interface ToolFilterEditorProps {
  enabled: boolean;
  tools: ToolListItem[];
  mode: 'all' | 'select';
  selectedKeys: string[];
  onModeChange: (value: 'all' | 'select') => void;
  onSelectedKeysChange: (value: string[]) => void;
}

let ToolGrid = styled.div`
  display: grid;
  gap: 10px;
`;

let ToolCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
`;

export let ToolFilterEditor = ({
  enabled,
  tools,
  mode,
  selectedKeys,
  onModeChange,
  onSelectedKeysChange
}: ToolFilterEditorProps) => {
  if (!enabled || tools.length === 0) return null;

  return (
    <Flex direction="column" gap={12}>
      <div>
        <Text size="2" weight="medium">
          Tool Access
        </Text>
        <Text size="1" color="gray600">
          Choose whether setup should allow all tools or only a selected subset.
        </Text>
      </div>

      <OptionToggle
        label="Tool access mode"
        hideLabel
        fullWidth
        size="2"
        value={mode}
        onChange={value => onModeChange(value as 'all' | 'select')}
        items={[
          { id: 'all', label: 'Allow all tools' },
          { id: 'select', label: 'Select tools' }
        ]}
      />

      {mode === 'select' && (
        <ToolGrid>
          {tools.map(tool => {
            let isChecked = selectedKeys.includes(tool.key);

            return (
              <ToolCard
                key={tool.key}
                onClick={() =>
                  onSelectedKeysChange(
                    isChecked
                      ? selectedKeys.filter(key => key !== tool.key)
                      : [...selectedKeys, tool.key]
                  )
                }
              >
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    label={tool.name}
                    checked={isChecked}
                    onCheckedChange={checked =>
                      onSelectedKeysChange(
                        checked
                          ? [...selectedKeys, tool.key]
                          : selectedKeys.filter(key => key !== tool.key)
                      )
                    }
                  />
                </div>
                {tool.description && (
                  <Text size="1" color="gray600">
                    {tool.description}
                  </Text>
                )}
              </ToolCard>
            );
          })}
        </ToolGrid>
      )}
    </Flex>
  );
};
