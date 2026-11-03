import { type SkillMcpAvailability, useSkillMcpAvailability } from '@metorial/state';
import { theme, Tooltip } from '@metorial/ui';
import { RiErrorWarningLine } from '@remixicon/react';
import { useEffect } from 'react';
import styled from 'styled-components';
import { useCurrentStoreHash } from '../scenes/skillStoreFileViewer';

let sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB'];

let formatSize = (bytes: number) => {
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < sizeUnits.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  let rounded =
    value >= 100 || unitIndex == 0 ? Math.round(value).toString() : value.toFixed(1);

  return `${rounded.replace(/\.0$/, '')} ${sizeUnits[unitIndex]}`;
};

let getLimitReason = (availability: SkillMcpAvailability) => {
  let tooManyFiles = availability.exceededLimits.includes('file_count');
  let tooBig = availability.exceededLimits.includes('size');

  let size = formatSize(availability.size);
  let maxSize = formatSize(availability.maxSize);

  if (tooBig && tooManyFiles) {
    return `It has ${availability.fileCount} files adding up to ${size}. Skills shared over MCP can have at most ${availability.maxFileCount} files and ${maxSize}.`;
  }

  if (tooBig) {
    return `Its files add up to ${size}. Skills shared over MCP can be at most ${maxSize}.`;
  }

  return `It has ${availability.fileCount} files. Skills shared over MCP can have at most ${availability.maxFileCount}.`;
};

let Badge = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 22px;
  padding: 0 8px 0 6px;
  border: none;
  border-radius: 6px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: default;

  svg {
    color: ${theme.colors.orange600};
  }
`;

let TooltipText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export let SkillMcpLimitsBadge = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
}) => {
  let availability = useSkillMcpAvailability(p.instanceId, p.skillId);

  let storeHash = useCurrentStoreHash();
  useEffect(() => {
    availability.refetch();
  }, [storeHash]);

  if (!availability.data || availability.data.available) return null;

  return (
    <Tooltip
      content={
        <TooltipText>
          <span>
            This skill works as usual, but apps connected over MCP won't see it.{' '}
            {getLimitReason(availability.data)}
          </span>
          <span>
            Reduce its files to make it available over MCP again. Sharing through a Git
            repository isn't affected.
          </span>
        </TooltipText>
      }
    >
      <Badge type="button">
        <RiErrorWarningLine size={14} />
        Not available over MCP
      </Badge>
    </Tooltip>
  );
};
