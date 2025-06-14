import { RenderDate, theme } from '@metorial/ui';
import styled from 'styled-components';

let EntryWrapper = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  color: ${theme.colors.gray600};

  svg {
    width: 20px;
    height: 20px;
  }

  span {
    font-size: 13px;
    font-weight: 500;
    flex: 1;
  }

  &[data-variant='error'] {
    color: ${theme.colors.red600};
  }
`;

export let Entry = ({
  icon,
  title,
  time,
  variant
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  time: Date;
  variant?: 'default' | 'error';
}) => {
  return (
    <EntryWrapper data-variant={variant}>
      {icon}
      <span>{title}</span>
      <time>
        <RenderDate date={time} />
      </time>
    </EntryWrapper>
  );
};
