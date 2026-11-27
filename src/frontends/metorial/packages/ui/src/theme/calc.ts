type CalcInput = number | string;

export let calc = {
  add: (a: CalcInput, b: CalcInput) => `calc(${a} + ${b})`,
  subtract: (a: CalcInput, b: CalcInput) => `calc(${a} - ${b})`,
  multiply: (a: CalcInput, b: CalcInput) => `calc(${a} * ${b})`,
  divide: (a: CalcInput, b: CalcInput) => `calc(${a} / ${b})`
};
