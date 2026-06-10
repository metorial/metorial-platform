import { Button, Menu } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { RiArrowDownSLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export type OpenExplorerMode = 'manual' | 'assistant';

type OpenExplorerMenuCopy = {
  manualLabel?: ReactNode;
  manualDescription?: ReactNode;
  assistantLabel?: ReactNode;
  assistantDescription?: ReactNode;
};

type OpenExplorerButtonBaseProps = OpenExplorerMenuCopy & {
  buttonLabel?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  size?: '1' | '2' | '3' | '4' | '5';
  variant?: 'solid' | 'outline' | 'soft' | 'ghost';
  color?: string;
};

type OpenExplorerLaunchProps =
  | {
      to: string | ((mode: OpenExplorerMode) => string);
      onOpen?: never;
    }
  | {
      to?: never;
      onOpen: (mode: OpenExplorerMode) => void | Promise<void>;
    };

export type OpenExplorerButtonProps = OpenExplorerButtonBaseProps & OpenExplorerLaunchProps;

let withExplorerMode = (to: string, mode: OpenExplorerMode) => {
  if (to === '#') return to;

  let hashIndex = to.indexOf('#');
  let pathWithSearch = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  let hash = hashIndex >= 0 ? to.slice(hashIndex) : '';
  let queryIndex = pathWithSearch.indexOf('?');
  let path = queryIndex >= 0 ? pathWithSearch.slice(0, queryIndex) : pathWithSearch;
  let query = queryIndex >= 0 ? pathWithSearch.slice(queryIndex + 1) : '';
  let params = new URLSearchParams(query);

  params.set('mode', mode);

  let nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ''}${hash}`;
};

export let getExplorerModeUrl = (
  to: string | ((mode: OpenExplorerMode) => string),
  mode: OpenExplorerMode
) => withExplorerMode(typeof to === 'function' ? to(mode) : to, mode);

export let OpenExplorerButton = (p: OpenExplorerButtonProps) => {
  let navigate = useNavigate();

  let buttonLabel = p.children ?? p.buttonLabel ?? 'Open Explorer';

  return (
    <Menu
      label={typeof buttonLabel === 'string' ? buttonLabel : 'Open Explorer'}
      title="Choose Explorer Mode"
      items={[
        {
          id: 'manual',
          label: p.manualLabel ?? 'Manual Tool Calls',
          description: p.manualDescription ?? 'Inspect tools and call them yourself.'
        },
        {
          id: 'assistant',
          label: p.assistantLabel ?? 'AI Agent',
          description: p.assistantDescription ?? 'Chat with an agent that can use the tools.'
        }
      ]}
      onItemClick={id => {
        let mode: OpenExplorerMode = id === 'assistant' ? 'assistant' : 'manual';

        if (p.onOpen) {
          p.onOpen(mode);
          return;
        }

        navigate(getExplorerModeUrl(p.to, mode));
      }}
    >
      <Button
        type="button"
        size={p.size ?? '2'}
        variant={p.variant}
        color={p.color as any}
        disabled={p.disabled}
        loading={p.loading}
        iconRight={<RiArrowDownSLine size={14} />}
      >
        {buttonLabel}
      </Button>
    </Menu>
  );
};

export let OpenExplorerBox = ({
  title = 'Test this provider',
  description = 'Use the Metorial Explorer to test this provider.',
  buttonLabel,
  ...buttonProps
}: OpenExplorerButtonProps & {
  title?: ReactNode;
  description?: ReactNode;
}) => (
  <SideBox title={title} description={description}>
    <OpenExplorerButton buttonLabel={buttonLabel} {...buttonProps} />
  </SideBox>
);
