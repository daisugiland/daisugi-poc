import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DocFragment,
  getFileDocFragments,
} from '../yomeru.js';

const script = `
  //<#1/hello/#1/world
  // ## hello
  // Hello world!
  //<#1/hello/#2/world
  // Hello world 2!
  export function hello() {
    return 'hello';
    //>#1/hello/#2/world
  }
  //>#1/hello/#1/world
`;

const outputFragment1 = {
  fragmentId: '#1/hello/#1/world',
  path: 'hello',
  filename: 'world.ts',
  data: `## hello
Hello world!
\`\`\`ts
export function hello() {
  return 'hello';
}
\`\`\``,
};

const outputFragment2 = {
  fragmentId: '#1/hello/#2/world',
  path: 'hello',
  filename: 'world.ts',
  data: `Hello world 2!
\`\`\`ts
export function hello() {
  return 'hello';
\`\`\``,
};

describe('yomeru', () => {
  describe('DocFragment', () => {
    it('should return expected value', () => {
      const linedScript = script.split('\n');
      const docFragment = new DocFragment(
        '#1/hello/#1/world',
        '//<',
        '//>',
        '// ',
        'ts',
      );
      for (const line of linedScript) {
        docFragment.addLine(line);
      }
      assert.deepStrictEqual(
        docFragment.getData(),
        outputFragment1,
      );
    });
  });

  describe('getFileDocFragments', () => {
    it('should return expected value', () => {
      assert.deepStrictEqual(getFileDocFragments(script), [
        outputFragment1,
        outputFragment2,
      ]);
    });
  });
});
