import type { SignalValue, SignalValues, VirtualModelSignal } from '@mtsrc/ai-gateway-spec';
import { DecisionError } from './errors';
import type { SystemOneAnswer, SystemOneQuestion } from './systemOne';

let probabilityOf = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;

export let toQuestions = (signals: Record<string, VirtualModelSignal>) =>
  Object.fromEntries(
    Object.entries(signals).map(([name, signal]): [string, SystemOneQuestion] => {
      if (signal.type == 'boolean') {
        return [name, { type: 'noul', instructions: signal.instructions }];
      }

      if (signal.type == 'choice') {
        return [
          name,
          { type: 'choice', instructions: signal.instructions, criteria: signal.options }
        ];
      }

      return [
        name,
        { type: 'score', instructions: signal.instructions, criteria: signal.levels }
      ];
    })
  );

let invalidAnswer = (name: string, reason: string) =>
  new DecisionError('invalid_response', `The decision model's answer to "${name}" ${reason}.`);

let toSignalValue = (
  name: string,
  signal: VirtualModelSignal,
  answer: SystemOneAnswer | undefined
): SignalValue => {
  if (!answer || answer.type != (signal.type == 'boolean' ? 'noul' : signal.type)) {
    throw invalidAnswer(name, 'is missing or has the wrong type');
  }

  if (signal.type == 'boolean' && answer.type == 'noul') {
    let probability = probabilityOf(answer.noul);
    return { type: 'boolean', value: probability >= 0.5, probability };
  }

  if (signal.type == 'choice' && answer.type == 'choice') {
    if (!(answer.choice in signal.options))
      throw invalidAnswer(name, 'is not one of the options');

    let probabilities = Object.fromEntries(
      Object.keys(signal.options).map(option => [
        option,
        probabilityOf(answer.probabilities?.[option])
      ])
    );

    return {
      type: 'choice',
      choice: answer.choice,
      probability: probabilities[answer.choice] ?? probabilityOf(answer.confidence),
      confidence: probabilityOf(answer.confidence),
      probabilities
    };
  }

  if (signal.type == 'score' && answer.type == 'score') {
    let probabilities = signal.levels.map((_, index) =>
      probabilityOf(answer.probabilities?.[String(index)])
    );
    let level = probabilities.reduce(
      (best, value, index) => (value > probabilities[best]! ? index : best),
      0
    );

    return {
      type: 'score',
      score: typeof answer.score == 'number' ? answer.score : level,
      level,
      probability: probabilities[level]!,
      confidence: probabilityOf(answer.confidence),
      probabilities
    };
  }

  throw invalidAnswer(name, 'has the wrong type');
};

export let toSignalValues = (
  signals: Record<string, VirtualModelSignal>,
  answers: Record<string, SystemOneAnswer>
): SignalValues =>
  Object.fromEntries(
    Object.entries(signals).map(([name, signal]) => [
      name,
      toSignalValue(name, signal, answers[name])
    ])
  );
