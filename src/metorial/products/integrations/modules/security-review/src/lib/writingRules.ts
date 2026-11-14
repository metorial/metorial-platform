export let reviewWritingRules = `## Writing for the reader

Write for the person deciding whether to connect, install or keep using this integration or skill.
Include a fact only if it helps them understand who operates it, what access it has, a concrete
security issue, or an action they can take. Inspect the evidence thoroughly; report only the result.

Use plain words, present tense and the conclusion first. Default to one short sentence per prose
field; add a second only for a distinct consequence or necessary qualification. Character limits are
ceilings, not targets. Do not pack a long inventory into one sentence to meet this guidance.

Keep supporting proof in evidence references. Do not narrate your investigation, list the sources
you checked, quote branding or footers, or explain routine platform and OAuth mechanics. Name a host,
tool, scope, file or version only when that detail explains access, establishes an otherwise unknown
operator, identifies an issue or makes an action concrete. License and repository metadata belong in
prose only when they materially affect the security assessment.

Each section answers its own question. The summary gives the verdict and most consequential access
or issue; provenance identifies the operator; capabilities explain what the tools or skill do;
findings explain concrete issues or notable capabilities. Do not repeat the same explanation across
sections, create a finding for every tool, or add generic safety advice and hypothetical risks.
Required sections can be brief, and optional lists can be empty. Preserve material risks and real
uncertainty even when they need more explanation.

Be specific and calm. No markdown headings inside fields, filler, hedging such as "may potentially",
mention of AI authorship, or numeric scores in prose; scores are rendered from data.`;
