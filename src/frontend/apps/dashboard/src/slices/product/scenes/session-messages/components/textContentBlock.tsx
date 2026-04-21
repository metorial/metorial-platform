import { CodeBlock } from '@metorial/code';
import { theme } from '@metorial/ui';

export let TextContentBlock = ({
  text,
  language
}: {
  text: string;
  language?: string;
}) => {
  let effectiveLanguage = language ?? 'text';
  let isPlain = effectiveLanguage === 'text' || effectiveLanguage === 'markdown';

  if (isPlain) {
    return (
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          padding: '10px 12px',
          border: `1px solid ${theme.colors.gray300}`,
          borderRadius: 8,
          background: theme.colors.gray100,
          color: theme.colors.gray900
        }}
      >
        {text}
      </pre>
    );
  }

  return <CodeBlock language={effectiveLanguage} variant="bordered" code={text} />;
};
