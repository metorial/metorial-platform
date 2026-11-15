import spec from './fixtures/bucket';
import { compile } from './compile';
import { generateTs } from './generate/ts';
console.log(generateTs(compile(spec)));
