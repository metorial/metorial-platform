import { Panel, showModal } from '@metorial/ui';
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from 'react';
import styled from 'styled-components';

let CHILD_DIALOG_TEARDOWN_GRACE_MS = 500;

let CallbackPanelMarker = styled.div`
  display: contents;
`;

let getDialogZIndex = (dialog: Element) => {
  let zIndex = Number.parseInt(getComputedStyle(dialog).zIndex, 10);
  return Number.isNaN(zIndex) ? null : zIndex;
};

let isDialogAbove = (panelDialog: Element, candidate: Element) => {
  if (candidate === panelDialog || panelDialog.contains(candidate)) return false;

  let panelZIndex = getDialogZIndex(panelDialog);
  let candidateZIndex = getDialogZIndex(candidate);

  if (
    panelZIndex != null &&
    candidateZIndex != null &&
    panelZIndex !== candidateZIndex
  ) {
    return candidateZIndex > panelZIndex;
  }

  return !!(
    panelDialog.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING
  );
};

let useCallbackPanelDismissGuard = (isOpen: boolean) => {
  let [marker, setMarker] = useState<HTMLDivElement | null>(null);
  let childDialogPresentRef = useRef(false);
  let dismissBlockedRef = useRef(false);
  let teardownGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let panelDialog = marker?.closest('[role="dialog"]');
    if (!panelDialog) return;

    let update = () => {
      let hasChildDialog = Array.from(document.querySelectorAll('[role="dialog"]')).some(
        candidate => isDialogAbove(panelDialog, candidate)
      );

      if (hasChildDialog) {
        childDialogPresentRef.current = true;
        dismissBlockedRef.current = true;

        if (teardownGraceRef.current) {
          clearTimeout(teardownGraceRef.current);
          teardownGraceRef.current = null;
        }
        return;
      }

      if (!childDialogPresentRef.current) return;

      childDialogPresentRef.current = false;
      teardownGraceRef.current = setTimeout(() => {
        dismissBlockedRef.current = false;
        teardownGraceRef.current = null;
      }, CHILD_DIALOG_TEARDOWN_GRACE_MS);
    };

    let observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'style', 'data-state']
    });
    update();

    return () => {
      observer.disconnect();
      if (teardownGraceRef.current) clearTimeout(teardownGraceRef.current);
      teardownGraceRef.current = null;
      childDialogPresentRef.current = false;
      dismissBlockedRef.current = false;
    };
  }, [isOpen, marker]);

  return {
    markerRef: setMarker,
    shouldBlockDismiss: () => dismissBlockedRef.current
  };
};

type CallbackPanelWrapperProps = ComponentProps<typeof Panel.Wrapper>;

export let CallbackPanelWrapper = ({
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  ...panelProps
}: CallbackPanelWrapperProps) => {
  let { markerRef, shouldBlockDismiss } = useCallbackPanelDismissGuard(panelProps.isOpen);

  return (
    <Panel.Wrapper
      {...panelProps}
      onEscapeKeyDown={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onEscapeKeyDown?.(event);
      }}
      onPointerDownOutside={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onPointerDownOutside?.(event);
      }}
      onInteractOutside={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onInteractOutside?.(event);
      }}
      onFocusOutside={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onFocusOutside?.(event);
      }}
    >
      <CallbackPanelMarker ref={markerRef}>{children}</CallbackPanelMarker>
    </Panel.Wrapper>
  );
};

export let showCallbackProviderCreationPanel = (
  children: (d: { close: () => void; setWidth: (width: number) => void }) => ReactNode,
  opts?: { width?: number }
) =>
  showModal(({ dialogProps, close }) => {
    let defaultWidth = opts?.width ?? 1100;
    let [width, setWidth] = useState(defaultWidth);

    return (
      <CallbackPanelWrapper {...dialogProps} width={width}>
        {children({ close, setWidth })}
      </CallbackPanelWrapper>
    );
  });
