import type { ReactNode } from 'react';
import { Button, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';

export let DeleteResourceDangerZone = (p: {
  description: string;
  buttonLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  onDelete: () => Promise<void>;
  loading?: boolean;
  success?: boolean;
  disabled?: boolean;
  confirmText?: string;
  children?: ReactNode;
}) => {
  return (
    <Box title="Danger Zone" description={p.description}>
      {p.children ? (
        <>
          {p.children}
          <Spacer size={15} />
        </>
      ) : null}

      <Button
        size="2"
        color="red"
        loading={p.loading}
        success={p.success}
        disabled={p.disabled}
        onClick={() =>
          confirm({
            title: p.confirmTitle,
            description: p.confirmDescription,
            confirmText: p.confirmText ?? 'Delete',
            onConfirm: p.onDelete
          })
        }
      >
        {p.buttonLabel}
      </Button>
    </Box>
  );
};
