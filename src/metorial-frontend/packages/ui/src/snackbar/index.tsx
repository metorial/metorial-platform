import { Toast } from '@base-ui/react/toast';
import { RiCheckLine, RiCloseLine, RiErrorWarningLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { Spinner } from '../spinner';
import { theme } from '../theme';

let SNACKBAR_LIMIT = 3;
let SNACKBAR_TIMEOUT = 4000;

type SnackbarKind = 'default' | 'loading' | 'success' | 'error';

type SnackbarData = {
  icon?: React.ReactNode;
};

export type SnackbarAction = {
  label: string;
  onClick: () => void;
};

export type SnackbarOptions = {
  message: React.ReactNode;
  icon?: React.ReactNode;
  action?: SnackbarAction;
  timeout?: number;
};

export type SnackbarPromiseOptions<Value> = {
  loading: React.ReactNode;
  success: React.ReactNode | ((value: Value) => React.ReactNode);
  error: React.ReactNode | ((error: unknown) => React.ReactNode);
};

let manager = Toast.createToastManager<SnackbarData>();

let toActionProps = (action?: SnackbarAction) =>
  action ? { children: action.label, onClick: action.onClick } : undefined;

let resolve = <T,>(value: React.ReactNode | ((input: T) => React.ReactNode), input: T) =>
  typeof value == 'function' ? (value as (input: T) => React.ReactNode)(input) : value;

export let snackbar = {
  show: (options: SnackbarOptions) =>
    manager.add({
      title: options.message,
      type: 'default' satisfies SnackbarKind,
      timeout: options.timeout ?? SNACKBAR_TIMEOUT,
      data: { icon: options.icon },
      actionProps: toActionProps(options.action)
    }),

  success: (message: React.ReactNode, action?: SnackbarAction) =>
    manager.add({
      title: message,
      type: 'success' satisfies SnackbarKind,
      timeout: SNACKBAR_TIMEOUT,
      actionProps: toActionProps(action)
    }),

  error: (message: React.ReactNode, action?: SnackbarAction) =>
    manager.add({
      title: message,
      type: 'error' satisfies SnackbarKind,
      timeout: SNACKBAR_TIMEOUT * 1.5,
      actionProps: toActionProps(action)
    }),

  promise: <Value,>(promise: Promise<Value>, options: SnackbarPromiseOptions<Value>) =>
    manager.promise(promise, {
      loading: { title: options.loading, type: 'loading' satisfies SnackbarKind, timeout: 0 },
      success: value => ({
        title: resolve(options.success, value),
        type: 'success' satisfies SnackbarKind,
        timeout: SNACKBAR_TIMEOUT
      }),
      error: error => ({
        title: resolve(options.error, error),
        type: 'error' satisfies SnackbarKind,
        timeout: SNACKBAR_TIMEOUT * 1.5
      })
    }),

  close: (id?: string) => manager.close(id)
};

let Viewport = styled(Toast.Viewport)`
  position: fixed;
  left: 50%;
  bottom: var(--snackbar-bottom, 24px);
  z-index: 100000;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 32px);
  transform: translateX(-50%);
  outline: none;
  transition: bottom 0.3s ease;
`;

let Root = styled(Toast.Root)`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  max-width: 520px;
  padding: 6px 6px 6px 12px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.medium};
  color: ${theme.colors.foreground};
  font-size: 13px;
  transition:
    opacity 0.24s ease,
    transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }

  &[data-limited] {
    display: none;
  }
`;

let Icon = styled.span<{ $kind: SnackbarKind }>`
  display: inline-flex;
  flex: 0 0 auto;
  color: ${({ $kind }) =>
    $kind == 'success'
      ? theme.colors.green900
      : $kind == 'error'
        ? theme.colors.red900
        : theme.colors.gray700};

  svg {
    width: 16px;
    height: 16px;
  }
`;

let Title = styled(Toast.Title)`
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
`;

let Action = styled(Toast.Action)`
  flex: 0 0 auto;
  height: 28px;
  padding: 0 10px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 7px;
  background: ${theme.colors.background};
  color: ${theme.colors.foreground};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let Close = styled(Toast.Close)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: ${theme.colors.gray600};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray200};
    color: ${theme.colors.gray800};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

let SnackbarIcon = ({ kind, icon }: { kind: SnackbarKind; icon?: React.ReactNode }) => {
  if (kind == 'loading') return <Spinner size={14} />;
  if (kind == 'success') return <RiCheckLine />;
  if (kind == 'error') return <RiErrorWarningLine />;
  return icon ? <>{icon}</> : null;
};

let SnackbarList = () => {
  let { toasts } = Toast.useToastManager<SnackbarData>();

  return (
    <>
      {toasts.map(toast => {
        let kind = (toast.type ?? 'default') as SnackbarKind;
        let hasIcon = kind != 'default' || !!toast.data?.icon;

        return (
          <Root key={toast.id} toast={toast} swipeDirection="down">
            {hasIcon && (
              <Icon $kind={kind}>
                <SnackbarIcon kind={kind} icon={toast.data?.icon} />
              </Icon>
            )}

            <Title />

            {toast.actionProps && <Action />}

            {kind != 'loading' && (
              <Close aria-label="Dismiss">
                <RiCloseLine />
              </Close>
            )}
          </Root>
        );
      })}
    </>
  );
};

export let SnackbarViewport = () => (
  <Toast.Provider toastManager={manager} limit={SNACKBAR_LIMIT}>
    <Toast.Portal>
      <Viewport>
        <SnackbarList />
      </Viewport>
    </Toast.Portal>
  </Toast.Provider>
);
