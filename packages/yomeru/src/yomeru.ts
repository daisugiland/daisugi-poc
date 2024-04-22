// @ts-nocheck

import {
  existsSync,
  mkdirSync,
  promises,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join } from 'node:path';

const { stat, readdir, readFile } = promises;

export class DocFragment {
  #lines: string[] = [];
  #data = '';
  #filename: string;
  #path: string;
  #fragmentId: string;
  #startFragmentMark: string;
  #endFragmentMark: string;
  #startMark: string;
  #endMark: string;
  #mark: string;
  #allMarks: string[];
  #fileExtension: string;
  #state = {
    waiting: 0,
    fragmentEnded: 2,
    summaryStarted: 3,
    codeStarted: 4,
  };
  #currentState = this.#state.waiting;

  constructor(
    fragmentId: string,
    startMark: string,
    endMark: string,
    mark: string,
    fileExtension: string,
  ) {
    this.#startMark = startMark;
    this.#endMark = endMark;
    this.#mark = mark;
    this.#allMarks = [startMark, endMark, mark];
    this.#fileExtension = fileExtension;
    this.#fragmentId = fragmentId;
    const segments = fragmentId
      .split('/')
      .filter((segment) => {
        return !segment.startsWith('#');
      });
    this.#path = segments.slice(0, -1).join('/');
    this.#filename = `${
      segments[segments.length - 1]
    }.${fileExtension}`;
    this.#startFragmentMark = `${this.#startMark}${fragmentId}`;
    this.#endFragmentMark = `${this.#endMark}${fragmentId}`;
  }

  addLine(line: string) {
    if (this.#currentState === this.#state.waiting) {
      if (line.includes(this.#startFragmentMark)) {
        this.#currentState = this.#state.summaryStarted;
      }
      return;
    }
    if (this.#currentState === this.#state.fragmentEnded) {
      return;
    }
    if (line.includes(this.#endFragmentMark)) {
      this.#currentState = this.#state.fragmentEnded;
      this.#lines.push('```');
      this.#data = this.#removeLeadingSpaces(
        this.#lines,
      ).join('\n');
      this.#lines = [];
      return;
    }
    if (
      this.#currentState === this.#state.summaryStarted &&
      line.includes(this.#mark)
    ) {
      this.#lines.push(line.replace(this.#mark, ''));
      return;
    }
    if (this.#currentState === this.#state.summaryStarted) {
      this.#lines.push(`\`\`\`${this.#fileExtension}`);
      this.#currentState = this.#state.codeStarted;
    }
    if (
      this.#currentState === this.#state.codeStarted &&
      !this.#allMarks.some((item) => line.includes(item))
    ) {
      this.#lines.push(line);
    }
    return;
  }

  getData() {
    return {
      fragmentId: this.#fragmentId,
      data: this.#data,
      path: this.#path,
      filename: this.#filename,
    };
  }

  #removeLeadingSpaces(lines: string[]) {
    const leadingSpacesCount =
      this.#getMinLeadingSpaces(lines);
    return lines.map((line) => {
      if (line.startsWith('```')) {
        return line;
      }
      return line.slice(leadingSpacesCount);
    });
  }

  #getMinLeadingSpaces(lines: string[]) {
    let minSpaces = Infinity;
    for (const line of lines) {
      const leadingSpaces = line.search(/\S/);
      if (leadingSpaces > 0 && leadingSpaces < minSpaces) {
        minSpaces = leadingSpaces;
      }
    }
    // Return the minimum number of leading spaces greater than zero.
    return minSpaces !== Infinity ? minSpaces : 0;
  }
}

async function getAllFilesInDirectory(
  directoryPath: string,
  excludeDirectories: string[] = [],
  desiredExtensions: string[] = [],
) {
  const files: string[] = [];
  const stack: string[] = [directoryPath];
  while (stack.length > 0) {
    const currentPath = stack.pop() as string;
    const entries = await readdir(currentPath);
    for (const entry of entries) {
      const entryPath = join(currentPath, entry);
      const stats = await stat(entryPath);
      if (stats.isDirectory()) {
        if (!excludeDirectories.includes(entry)) {
          stack.push(entryPath);
        }
      } else {
        const fileExtension = extname(entry);
        if (desiredExtensions.includes(fileExtension)) {
          files.push(entryPath);
        }
      }
    }
  }
  return files;
}

function createFileRecursively(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, '', 'utf-8');
}

export function getFileDocFragments(data: string) {
  const fragmentIds: string[] = [];
  const re = new RegExp(/\/\/\<(.+)/gm);
  let match;
  while ((match === re.exec(data)) !== null) {
    if (match) {
      fragmentIds.push(match[1]);
    }
  }
  const docFragments: DocFragment[] = fragmentIds.map(
    (fragmentId) => {
      return new DocFragment(
        fragmentId,
        '//<',
        '//>',
        '// ',
        'ts',
      );
    },
  );
  const lines = data.split('\n');
  for (const line of lines) {
    for (const docFragment of docFragments) {
      docFragment.addLine(line);
    }
  }
  return docFragments.map((docFragment) => {
    return docFragment.getData();
  });
}

async function start() {
  const filePaths = await getAllFilesInDirectory(
    './',
    ['node_modules', '.git', 'dist'],
    ['.ts'],
  );
  const docFragments = [];
  for (const filePath of filePaths) {
    const data = await readFile(filePath, 'utf-8');
    console.log('LLLLLL', data);
    // docFragments.push(...getFileDocFragments(data));
  }
  console.log(docFragments);
}

start();
