import { CodeBlock } from '@metorial/code';
import { Callout, Flex, Text } from '@metorial/ui';
import { buildCodexConfig, codexConfigPath, codexRestartCommand } from './codexConfig';
import { ingestionKeyPlaceholder } from './settingsFile';
import { CommandStep, CopyButton, MissingFile } from './setupDeploy';

type CodexConfig = ReturnType<typeof buildCodexConfig>;

let CodexSends = () => (
  <Flex direction="column" gap={4}>
    <Text size="2" weight="strong">
      What Codex Sends
    </Text>
    <Text size="2" color="gray700">
      Sends: Each model request with its model and tokens, and each tool call with its
      arguments and output. Codex always sends tool arguments and output and has no setting to
      turn that off. Metorial keeps MCP server, MCP tool and skill names and tool arguments and
      output only while the organization has Detailed Tool Reporting on in the Agent Usage
      settings, and then according to this environment's content settings.
    </Text>
    <Text size="2" color="gray700">
      Not sent: The repository, branch and commits of a session, which are not in Codex's
      telemetry. Metorial Desktop adds them.
    </Text>
  </Flex>
);

export let CodexConfigInstructions = ({
  instanceId,
  config,
  notConfigured
}: {
  instanceId: string;
  config: CodexConfig | null;
  notConfigured: boolean;
}) => {
  if (!config) {
    return (
      <MissingFile instanceId={instanceId} notConfigured={notConfigured} subject="config" />
    );
  }

  return (
    <Flex direction="column" gap={12}>
      {config.usesPlaceholder ? (
        <Callout color="orange">
          Replace <code>{ingestionKeyPlaceholder}</code> in this config with the key you saved,
          or create a new key to get a complete config.
        </Callout>
      ) : null}

      <CodeBlock code={config.toml} language="toml" lineNumbers={false} />

      <Flex gap={8} wrap="wrap">
        <CopyButton
          value={config.toml}
          label={config.usesPlaceholder ? 'Copy Template (Key Missing)' : 'Copy Config'}
        />
        <CopyButton value={config.exporterLine} label="Copy Exporter Line" />
      </Flex>

      <Text size="2" color="gray700">
        If <code>{codexConfigPath}</code> already has an <code>[otel]</code> table, add the{' '}
        <code>exporter</code> line to that table instead: a second <code>[otel]</code> table
        makes the file invalid. Codex has one logs exporter, so an <code>exporter</code> line
        already in that table sends its logs elsewhere, and replacing it stops that export.
      </Text>

      <CodexSends />
    </Flex>
  );
};

export let CodexRestartInstructions = () => (
  <Flex direction="column" gap={8}>
    <CommandStep
      title="Run this in a terminal on each machine after changing the config."
      command={codexRestartCommand}
      language="bash"
    />
    <Text size="2" color="gray700">
      <code>codex exec</code> runs are not affected. The restart interrupts running sessions;
      continue them with <code>codex resume</code>.
    </Text>
  </Flex>
);
