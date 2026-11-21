import { Code, Tooltip } from '@metorial/ui';
import styled from 'styled-components';

let Name = styled.span`
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
`;

let TooltipText = styled.span`
  overflow-wrap: anywhere;
`;

let NameList = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  min-width: 0;
  max-width: 100%;
`;

export let TruncatedModelName = ({ name }: { name: string }) => (
  <Name>
    <Code size="1" style={{ whiteSpace: 'nowrap', padding: 0 }}>
      {name}
    </Code>
  </Name>
);

export let UnmatchedModelNames = ({ names }: { names: string[] }) => (
  <NameList>
    {names.map(name => (
      <Tooltip key={name} content={<TooltipText>{name}</TooltipText>}>
        <span>
          <TruncatedModelName name={name} />
        </span>
      </Tooltip>
    ))}
  </NameList>
);
