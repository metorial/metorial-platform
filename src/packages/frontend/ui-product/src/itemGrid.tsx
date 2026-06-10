import { Button, Menu, Spacer, Text, theme, Title, toast } from '@metorial/ui';
import { RiMore2Fill } from '@remixicon/react';
import copy from 'copy-to-clipboard';
import React from 'react';
import { styled } from 'styled-components';

type ItemGridItemMode = 'default' | 'compactHorizontal';

type ItemGridRootProps = React.ComponentPropsWithoutRef<'ul'> & {
  width?: string;
  columns?: number;
  responsive?: boolean;
  responsiveTwoColumnWidth?: string;
  responsiveOneColumnWidth?: string;
};

let GridContainer = styled.div`
  container-type: inline-size;
  min-width: 0;
  width: 100%;
`;

let Grid = styled.ul.withConfig({
  shouldForwardProp: p =>
    p !== 'width' &&
    p !== 'columns' &&
    p !== 'responsive' &&
    p !== 'responsiveTwoColumnWidth' &&
    p !== 'responsiveOneColumnWidth'
})<{
  width?: string;
  columns?: number;
  responsive?: boolean;
  responsiveTwoColumnWidth?: string;
  responsiveOneColumnWidth?: string;
}>`
  display: grid;
  grid-template-columns: ${p =>
    p.columns
      ? `repeat(${p.columns}, minmax(0, 1fr))`
      : `repeat(auto-fill, minmax(${p.width ?? '300px'}, 1fr))`};
  gap: 20px;
  list-style: none;
  padding: 0;
  margin: 0;

  ${p =>
    p.columns && p.responsive
      ? `
    @container (max-width: ${p.responsiveTwoColumnWidth ?? '920px'}) {
      grid-template-columns: repeat(${Math.min(p.columns, 2)}, minmax(0, 1fr));
    }

    @container (max-width: ${p.responsiveOneColumnWidth ?? '500px'}) {
      grid-template-columns: minmax(0, 1fr);
    }
  `
      : ''}
`;

let Wrapper = styled.li.withConfig({ shouldForwardProp: p => p !== '$mode' })<{
  $mode?: ItemGridItemMode;
}>`
  display: flex;
  flex-direction: column;
  padding: ${p => (p.$mode === 'compactHorizontal' ? '12px' : '15px')};
  border: solid 1px ${theme.colors.gray300};
  border-radius: ${p => (p.$mode === 'compactHorizontal' ? '12px' : '15px')};
  transition: all 0.2s;

  &[data-button='true'] {
    cursor: pointer;

    &:hover,
    &:focus {
      border: solid 1px ${theme.colors.gray400};
      box-shadow: ${theme.shadows.medium};
    }
  }
`;

let Header = styled.header`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  position: relative;
`;

let HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
  max-width: 100%;
`;

let IconSlot = styled.div`
  width: 100%;
`;

let CompactHeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

let CompactTitleRow = styled.div.withConfig({ shouldForwardProp: p => p !== '$hasMenu' })<{
  $hasMenu: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: ${p => (p.$hasMenu ? '36px' : 0)};
  min-width: 0;
`;

let CompactTitleWrapper = styled.div`
  flex: 1;
  min-width: 0;

  h2 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let MenuWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
`;

let getButtonProps = (onClick: () => void) => ({
  onClick,
  role: 'button',
  tabIndex: 0,
  onKeyPress: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onClick();
    }
  },
  'data-button': 'true'
});

export let ItemGrid = {
  Root: ({ responsive, ...props }: ItemGridRootProps) => {
    let grid = <Grid responsive={responsive} {...props} />;

    if (!responsive) return grid;

    return <GridContainer>{grid}</GridContainer>;
  },
  Item: ({
    title,
    description,
    icon,
    entity,
    showCopyId = true,
    menu,
    onClick,
    bottom,
    mode = 'default',
    small,
    height
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    entity?: { id: string; hasUsage?: boolean };
    showCopyId?: boolean;
    menu?: { label: string; onClick: () => void }[];
    onClick?: () => void;
    bottom?: React.ReactNode;
    mode?: ItemGridItemMode;
    small?: boolean;
    height?: number;
  }) => {
    let menuItems = [
      ...(entity && showCopyId ? [{ id: 'id', label: 'Copy ID' }] : []),
      ...(menu?.map((item, i) => ({ id: String(i), label: item.label })) ?? [])
    ];

    return (
      <Wrapper
        {...(onClick ? getButtonProps(onClick) : {})}
        $mode={mode}
        style={{
          height: mode === 'compactHorizontal' ? height : undefined,
          minHeight: height ?? (mode === 'compactHorizontal' || small ? 'unset' : 200),
          overflow: mode === 'compactHorizontal' && height ? 'hidden' : undefined
        }}
      >
        <Header>
          {mode === 'compactHorizontal' ? (
            <CompactHeaderContent>
              <CompactTitleRow $hasMenu={menuItems.length > 0}>
                {icon}

                <CompactTitleWrapper>
                  <Title as="h2" size="3" weight="strong">
                    {title}
                  </Title>
                </CompactTitleWrapper>
              </CompactTitleRow>

              {description && (
                <Text size="1" weight="medium" color="gray700">
                  {description}
                </Text>
              )}
            </CompactHeaderContent>
          ) : (
            <HeaderContent>
              {icon && <IconSlot>{icon}</IconSlot>}

              <Title as="h2" size={small ? '3' : '4'} weight="strong">
                {title}
              </Title>
              {description && (
                <Text size="1" weight="medium" color="gray700">
                  {description}
                </Text>
              )}
            </HeaderContent>
          )}

          {menuItems.length > 0 && (
            <MenuWrapper onClick={e => e.stopPropagation()}>
              <Menu
                onItemClick={id => {
                  if (id == 'id' && entity) {
                    copy(entity.id);
                    toast.success('Copied to clipboard');
                  } else {
                    menu?.find((_, i) => String(i) === id)?.onClick();
                  }
                }}
                items={menuItems}
              >
                <Button size="2" iconLeft={<RiMore2Fill />} title="More" variant="outline" />
              </Menu>
            </MenuWrapper>
          )}
        </Header>

        {bottom && (
          <>
            <Spacer />
            {bottom}
          </>
        )}
      </Wrapper>
    );
  },
  CenteredItem: ({
    title,
    description,
    icon,
    onClick
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon: React.ReactNode;
    onClick?: () => void;
  }) => {
    return (
      <Wrapper
        {...(onClick ? getButtonProps(onClick) : {})}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 15,
          minHeight: 200
        }}
      >
        <div>{icon}</div>

        <Title as="h3" size="4" weight="strong">
          {title}
        </Title>

        {description && (
          <Text size="1" weight="medium" color="gray700">
            {description}
          </Text>
        )}
      </Wrapper>
    );
  },
  RawItem: Wrapper
};
