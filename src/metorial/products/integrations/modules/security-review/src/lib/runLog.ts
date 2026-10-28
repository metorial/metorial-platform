let MAX_LOG_CHARS = 400_000;

export let redactSecrets = (value: string) =>
  value
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url omitted]')
    .replace(/(bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(
      /((?:api[_-]?key|token|secret|authorization)["\x27]?\s*[:=]\s*["\x27]?)[^\s,"\x27}]+/gi,
      '$1[redacted]'
    );

export class RunLog {
  private text = '';
  private truncated = false;

  constructor(private startedAt = Date.now()) {}

  add(entry: string) {
    if (this.truncated) return;

    let elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1).padStart(6);
    let line = `[+${elapsed}s] ${redactSecrets(entry)}\n`;

    if (this.text.length + line.length > MAX_LOG_CHARS) {
      this.truncated = true;
      this.text += `[log truncated at ${MAX_LOG_CHARS} characters]\n`;
      return;
    }

    this.text += line;
  }

  toString() {
    return this.text;
  }
}
