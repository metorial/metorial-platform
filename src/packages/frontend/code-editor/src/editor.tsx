import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { InputDescription, InputLabel, theme } from '@metorial/ui';
import CM, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sparkTheme } from './theme';

let CodeMirror: typeof CM = (CM as any).default || CM;

export let CodeEditor = forwardRef<
  { insert: (text: string) => void; isFocused: () => boolean },
  {
    label?: string;
    description?: string;
    height: string;
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
    lang?: 'schema' | 'javascript' | 'json' | 'template' | 'plain';
    border?: boolean;
    onBlur?: () => void;
  }
>(
  (
    { value: valueRaw, onChange, height, readOnly, lang, border, onBlur, label, description },
    outerRef
  ) => {
    let [value, setValue] = useState(() => valueRaw);
    let [focused, setFocused] = useState(false);

    let onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    let onChangeCached = useCallback((value: string) => {
      onChangeRef.current?.(value);
    }, []);

    let highlighter = useMemo(() => {
      let highlighter = [];
      if (lang == 'json') highlighter.push(json());
      if (lang == 'javascript') highlighter.push(javascript({ typescript: true }));
      return highlighter;
    }, [lang]);

    let codeMirrorRef = useRef<ReactCodeMirrorRef | undefined>(undefined);

    let insert = useCallback(
      (text: string) => {
        if (!codeMirrorRef.current?.view) return;
        let range = codeMirrorRef.current?.view.state.selection.ranges[0];
        codeMirrorRef.current?.view.dispatch({
          changes: {
            from: range.from,
            to: range.to,
            insert: text
          },
          selection: { anchor: range.from + 1 }
        });
      },
      [codeMirrorRef]
    );

    useEffect(() => {
      if (!outerRef) return;
      (outerRef as any).current = { insert };
      (outerRef as any).current.isFocused = () => {
        return !!codeMirrorRef.current?.view?.hasFocus;
      };
    }, [outerRef, insert]);

    useEffect(() => {
      if (focused && !readOnly) return;
      setValue(valueRaw);
    }, [focused, readOnly, valueRaw]);

    return (
      <>
        {label && <InputLabel>{label}</InputLabel>}
        {description && <InputDescription>{description}</InputDescription>}

        <div
          style={{
            ...(border !== false
              ? {
                  border: `1px solid ${theme.colors.gray300}`,
                  borderRadius: '7px',
                  overflow: 'hidden'
                }
              : {})
          }}
        >
          <CodeMirror
            value={value}
            height={height}
            extensions={highlighter}
            onChange={onChangeCached}
            readOnly={readOnly}
            theme={sparkTheme}
            ref={codeMirrorRef as any}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onFocus={() => setFocused(true)}
          />
        </div>
      </>
    );
  }
);
