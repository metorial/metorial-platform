import {
  Button,
  getLink,
  Menu,
  Spacer,
  Spinner,
  Text,
  theme,
  Title,
  toast
} from '@metorial/ui';
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

let Wrapper = styled.li.withConfig({
  shouldForwardProp: p => p !== '$mode' && p !== '$disabled'
})<{
  $mode?: ItemGridItemMode;
  $disabled?: boolean;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: ${p => (p.$mode === 'compactHorizontal' ? '12px' : '15px')};
  background: none;
  border: solid 1px ${theme.colors.gray300};
  border-radius: ${p => (p.$mode === 'compactHorizontal' ? '12px' : '15px')};
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  transition: all 0.2s;
  opacity: ${p => (p.$disabled ? 0.45 : 1)};

  &[data-button='true'] {
    cursor: pointer;

    &:hover,
    &:focus-visible,
    a:focus-visible & {
      border: solid 1px ${theme.colors.gray400};
      box-shadow: ${theme.shadows.medium};
    }
  }
`;

let LoadingIndicator = styled.div`
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
`;

let Header = styled.header`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  position: relative;
`;

let HeaderContent = styled.div.withConfig({ shouldForwardProp: p => p !== '$hasMenu' })<{
  $hasMenu: boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding-right: ${p => (p.$hasMenu ? '46px' : 0)};
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

let TitleWrapper = styled.div`
  min-width: 0;
  max-width: 100%;

  h2,
  h3 {
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
`;

let MenuWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
`;

type ItemGridActionProps = {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

let getActionProps = ({ href, onClick, disabled }: ItemGridActionProps) => {
  if (onClick) {
    return {
      as: 'button' as const,
      type: 'button' as const,
      onClick,
      disabled,
      'data-button': 'true'
    };
  }

  if (href && !disabled) {
    return {
      as: 'span' as const,
      'data-button': 'true'
    };
  }

  return {};
};

let NativeLink = styled.a``;

let wrapAction = (
  children: React.ReactNode,
  href?: string,
  disabled?: boolean,
  nativeLink?: boolean
) => {
  if (!href || disabled) return children;

  let Link = nativeLink ? NativeLink : getLink();

  return (
    <Link
      to={href}
      style={{
        color: 'inherit',
        display: 'flex',
        minWidth: 0,
        textDecoration: 'none'
      }}
    >
      {children}
    </Link>
  );
};

export let ItemGrid = {
  Root: ({ responsive, style, ...props }: ItemGridRootProps) => {
    let grid = <Grid responsive={responsive} style={style as any} {...props} />;

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
    href,
    onClick,
    bottom,
    mode = 'default',
    small,
    height,
    disabled = false,
    loading = false,
    nativeLink = false
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    entity?: { id: string; hasUsage?: boolean };
    showCopyId?: boolean;
    menu?: { label: string; onClick: () => void }[];
    href?: string;
    onClick?: () => void;
    bottom?: React.ReactNode;
    mode?: ItemGridItemMode;
    small?: boolean;
    height?: number;
    disabled?: boolean;
    loading?: boolean;
    nativeLink?: boolean;
  }) => {
    let menuItems = [
      ...(entity && showCopyId ? [{ id: 'id', label: 'Copy ID' }] : []),
      ...(menu?.map((item, i) => ({ id: String(i), label: item.label })) ?? [])
    ];

    return wrapAction(
      <Wrapper
        {...getActionProps({ href, onClick, disabled })}
        $mode={mode}
        $disabled={disabled}
        aria-busy={loading}
        style={{
          height: mode === 'compactHorizontal' ? height : undefined,
          minHeight: height ?? (mode === 'compactHorizontal' || small ? 'unset' : 200),
          overflow: mode === 'compactHorizontal' && height ? 'hidden' : undefined
        }}
      >
        {loading && (
          <LoadingIndicator>
            <Spinner size={20} />
          </LoadingIndicator>
        )}

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
            <HeaderContent $hasMenu={menuItems.length > 0}>
              {icon && <IconSlot>{icon}</IconSlot>}

              <TitleWrapper>
                <Title as="h2" size={small ? '3' : '4'} weight="strong">
                  {title}
                </Title>
              </TitleWrapper>
              {description && (
                <Text size="1" weight="medium" color="gray700">
                  {description}
                </Text>
              )}
            </HeaderContent>
          )}

          {menuItems.length > 0 && (
            <MenuWrapper
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
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
      </Wrapper>,
      onClick ? undefined : href,
      disabled,
      nativeLink
    );
  },
  CenteredItem: ({
    title,
    description,
    icon,
    href,
    onClick,
    disabled = false,
    loading = false,
    nativeLink = false
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    nativeLink?: boolean;
  }) => {
    return wrapAction(
      <Wrapper
        {...getActionProps({ href, onClick, disabled })}
        $disabled={disabled}
        aria-busy={loading}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 15,
          minHeight: 200
        }}
      >
        {loading && (
          <LoadingIndicator>
            <Spinner size={20} />
          </LoadingIndicator>
        )}

        <div>{icon}</div>

        <TitleWrapper>
          <Title as="h3" size="4" weight="strong">
            {title}
          </Title>
        </TitleWrapper>

        {description && (
          <Text size="1" weight="medium" color="gray700">
            {description}
          </Text>
        )}
      </Wrapper>,
      onClick ? undefined : href,
      disabled,
      nativeLink
    );
  },
  RawItem: Wrapper
};
