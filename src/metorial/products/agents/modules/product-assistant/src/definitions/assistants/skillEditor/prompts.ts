import { detag } from '../../../lib/detag';
import { baseSystemPrompt } from '../../implementations/_systemPrompt';
import type { SkillEditorRequest } from './context';

let aboutSkills = detag`
<about_skills>
A skill is a package of instructions and resources that an AI agent loads on demand.
The root document SKILL.md describes what the skill does and when to use it; other documents and files hold references, examples, scripts, and templates.
Markdown documents in the agents/ directory define sub-agents. Only .md documents are allowed there.
</about_skills>
`;

let workspacePrompt = (d: { request: SkillEditorRequest; writable: boolean }) => detag`
<workspace>
The skill "${d.request.skillName}" is mounted at /skill. /workspace is a scratch directory that is never saved.
Use listFiles, readFile, and grep to explore the skill; bash runs in a virtual shell with common unix tools (no network, no package managers).
Files over 5 MB, and any file read after 10 MB of skill content has been loaded in this request, read as empty and cannot be edited or copied. ls -l still shows their real size, so treat an empty read of a non-empty file as skipped, not as missing content.
${
  d.writable
    ? 'Writes under /skill are saved to the skill automatically after each tool call. The tool result reports every saved change; fix failures before continuing.\nSKILL.md cannot be deleted or moved. File names may only contain letters, numbers, spaces and . _ - ( ) $. Use .md for documents.'
    : 'The skill is mounted read-only. Do not try to change files.'
}
</workspace>
`;

let documentPrompt = (request: SkillEditorRequest) =>
  request.document
    ? detag`
<open_document>
The user has the document "${request.document.title}" open in the editor; it lives at /skill${request.document.path}.
Use read_document to read it. Blocks are labeled with ids like [b3]; use these ids to target edits.
</open_document>
`
    : '';

let webPrompt = (hasWeb: boolean) =>
  hasWeb
    ? 'You can search the web with webSearch and read pages with getWebContent when the request needs current or external information.'
    : 'You do not have web access.';

let markdownRules = detag`
<markdown>
Write GitHub-flavored markdown. Supported extras: callouts written as <info>...</info>, <warning>...</warning>, <success>...</success>, and <danger>...</danger> blocks with a blank line inside each tag, and equations as <equation>...</equation>.
Do not wrap your output in a code fence unless the content itself is code.
</markdown>
`;

type ModePromptContext = { request: SkillEditorRequest; blockAlias?: string };

let modePrompts: Record<SkillEditorRequest['mode'], (d: ModePromptContext) => string> = {
  block: ({ blockAlias }) => detag`
<task>
The user inserted an AI block into the open document and described what it should contain.
Write the block's content with write_block. Call it exactly once with the complete markdown for the block, then reply with one short sentence.
Match the surrounding document's tone, terminology, and heading levels. Do not repeat content that already exists elsewhere in the document.
${
  blockAlias
    ? `The AI block is [${blockAlias}] in read_document; use read_document to see its surroundings.`
    : 'The block is located where the user placed it; use read_document to see its surroundings.'
}
</task>
`,

  rewrite: ({ request }) => detag`
<task>
Rewrite the user's selected text according to their instruction and call replace_selection exactly once with the replacement markdown.
Keep the meaning, facts, links, and formatting unless the instruction says otherwise. Only return the replacement for the selection, never the surrounding text.
After calling the tool, reply with at most one short sentence.
</task>

<selection>
${request.selection?.text ?? ''}
</selection>
`,

  summarize: ({ request }) => detag`
<task>
Summarize the ${request.target?.type ?? 'document'} the user asked about and insert the summary with insert_after.
Keep it concise and faithful to the source. Call insert_after exactly once, then reply with one short sentence.
</task>
${request.target?.text ? `\n<source>\n${request.target.text}\n</source>` : ''}
`,

  document: () => detag`
<task>
Help the user with the open document and the rest of the skill.
Edit the open document with edit_document. Each operation targets a block id from read_document:
- replace: replace target (through targetEnd, inclusive) with content
- insert_before / insert_after: add new blocks next to target; use "doc_start" or "doc_end" for an empty document
- delete: remove target (through targetEnd)
Use "@title" with replace to rename the document.
Read before editing, prefer small targeted operations over rewriting the whole document, and re-read after an error about changed blocks.
Edits appear in the user's editor immediately. Other skill files can be created and changed with the file tools.
When you're done, briefly summarize what you changed.
</task>
`,

  skill: () => detag`
<task>
Help the user build and maintain this skill: answer questions about it, and create, edit, rename, or delete its documents and files.
Explore before you change anything, keep SKILL.md accurate when you add or remove resources, and keep edits focused on the request.
When you're done, briefly summarize which files you changed.
</task>
`,

  ask: ({ request }) => detag`
<task>
Answer the user's question about ${request.document ? 'the open document and ' : ''}this skill.
${
  request.canWrite
    ? 'Do not change any files in this mode.'
    : 'The user has read-only access, so you cannot change the skill. If they ask for changes, explain that they need edit access, and you may show the proposed content in your reply instead.'
}
</task>
`
};

export let skillEditorSystemPrompt = (d: {
  request: SkillEditorRequest;
  blockAlias?: string;
  writable: boolean;
  hasWeb: boolean;
}) => detag`
${baseSystemPrompt()}

${aboutSkills}

${workspacePrompt(d)}

${documentPrompt(d.request)}

${modePrompts[d.request.mode]({ request: d.request, blockAlias: d.blockAlias })}

${markdownRules}

<web>
${webPrompt(d.hasWeb)}
</web>
`;
