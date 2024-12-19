import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(
  fs.readFileSync('./package.json', { encoding: 'utf-8' }),
);

function buildConfig({ input, output, declaration = false }) {
  return {
    input,
    plugins: [
      typescript({
        compilerOptions: {
          declaration,
          declarationDir: declaration ? '/' : undefined,
        },
      }),
      resolve(),
      commonjs(),
      {
        name: 'package-json',
        resolveId(id) {
          return id.startsWith('package-json:') ? id : null;
        },
        load(id) {
          if (!id.startsWith('package-json:')) {
            return null;
          }
          const matches = /^package-json:([^]*)$/.exec(id);
          if (matches) {
            const name = matches[1];
            let value = packageJson[matches[1]];
            if (name === 'version' && !value) {
              value = 'dev';
            }
            if (value) {
              return `export default ${JSON.stringify(`${value}`)};`;
            }
          }
          throw new Error('Error reading from package.json');
        },
      },
    ].filter(Boolean),
    onLog: (level, log, handler) => {
      if (
        log.code === 'CIRCULAR_DEPENDENCY' &&
        [
          path.resolve('src/nodes/quantifier.ts'),
          path.resolve('src/character-reader/character-reader-level-0.ts'),
        ].includes(log.ids[0])
      ) {
        return;
      }

      if (level === 'warn') {
        // treat warnings as errors
        handler('error', log);
      } else {
        handler(level, log);
      }
    },
    output,
  };
}
export default [
  buildConfig({
    input: 'src/redos-detector.ts',
    declaration: true,
    output: [
      {
        name: 'RedosDetector',
        file: 'dist/redos-detector.js',
        format: 'umd',
      },
      {
        file: 'dist/redos-detector.mjs',
        format: 'es',
      },
    ],
  }),
  buildConfig({
    input: 'src/cli.ts',
    output: [
      {
        file: 'dist/cli.js',
        format: 'commonjs',
      },
    ],
  }),
];
