import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import packageJson from './package.json';

function buildConfig({ input, output, declaration = false }) {
  return {
    input,
    plugins: [
      typescript({
        tsconfigOverride: declaration
          ? {
              compilerOptions: {
                declaration: true,
              },
            }
          : undefined,
      }),
      json(),
      resolve(),
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
    onwarn: (e) => {
      if (
        e.code === 'CIRCULAR_DEPENDENCY' &&
        [
          'src/nodes/quantifier.ts',
          'src/character-reader/character-reader-level-0.ts',
        ].includes(e.cycle[0])
      ) {
        return;
      }
      throw new Error(e);
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
        file: 'dist/redos-detector.es.js',
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
