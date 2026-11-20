export type Tokens = {
  inputUncached: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  reasoning: number;
};

export let emptyTokens = (): Tokens => ({
  inputUncached: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0
});

export let addTokens = (target: Tokens, tokens: Tokens) => {
  target.inputUncached += tokens.inputUncached;
  target.cacheRead += tokens.cacheRead;
  target.cacheWrite += tokens.cacheWrite;
  target.output += tokens.output;
  target.reasoning += tokens.reasoning;
};
