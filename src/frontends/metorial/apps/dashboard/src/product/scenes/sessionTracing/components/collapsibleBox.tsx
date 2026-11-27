import { Text, theme, Title } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLocalStorage } from 'react-use';
import styled from 'styled-components';

let LOCAL_STORAGE_PREFIX = 'sessionTracing:box:collapsed:';

let Wrapper = styled.div`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.background};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
`;

let Header = styled.button`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s ease;

  &:hover {
    background: ${theme.colors.gray200};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: -2px;
  }
`;

let HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

let RightActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
`;

let Chevron = styled(motion.span)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray600};
  flex-shrink: 0;
`;

let AnimatedContent = styled(motion.div)`
  overflow: hidden;
`;

let Body = styled.main`
  padding: 5px 20px 15px 20px;
`;

export let CollapsibleBox = ({
  children,
  defaultCollapsed = false,
  description,
  id,
  rightActions,
  title
}: {
  children: ReactNode;
  defaultCollapsed?: boolean;
  description?: ReactNode;
  id: string;
  rightActions?: ReactNode;
  title: ReactNode;
}) => {
  let [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(
    `${LOCAL_STORAGE_PREFIX}${id}`,
    defaultCollapsed
  );
  let collapsed = !!isCollapsed;

  return (
    <Wrapper>
      <Header
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setIsCollapsed(!collapsed)}
      >
        <HeaderContent>
          <Title as="h2" size="2" weight="strong">
            {title}
          </Title>
          {description && (
            <Text size="1" weight="medium" color="gray600">
              {description}
            </Text>
          )}
        </HeaderContent>
        <RightActions onClick={e => e.stopPropagation()}>
          {rightActions}
          <Chevron
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <RiArrowDownSLine size={18} />
          </Chevron>
        </RightActions>
      </Header>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <AnimatedContent
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <Body>{children}</Body>
          </AnimatedContent>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};
