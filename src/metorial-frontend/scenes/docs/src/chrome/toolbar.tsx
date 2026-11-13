import { useDocumentEditorChrome } from '@metorial/state';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { ThemeProvider } from 'styled-components';
import { Toolbar } from '../editor/Toolbar';
import { DocsStyles } from '../styles/GlobalStyles';
import { lightTheme } from '../styles/theme';

export let DocumentEditorChromeToolbar = () => {
  let chrome = useDocumentEditorChrome();
  if (!chrome) return null;

  return (
    <ThemeProvider theme={lightTheme}>
      <DocsStyles>
        <Toolbar
          editor={chrome.editor as TiptapEditor | null}
          disabled={chrome.toolbarDisabled || chrome.readOnly}
          onRequestLinkEdit={chrome.actions.requestLinkEdit}
        />
      </DocsStyles>
    </ThemeProvider>
  );
};
