const micromatch = require('micromatch');
const prettier = require('prettier');

module.exports = async (allStagedFiles) => {
  const prettierSupportedExtensions = (
    await prettier.getSupportInfo()
  ).languages
    .map(({ extensions }) => extensions)
    .flat();

  const addQuotes = (a) => `"${a}"`;

  const eslintFiles = micromatch(allStagedFiles, '**/*.ts');
  const prettierFiles = micromatch(
    allStagedFiles,
    prettierSupportedExtensions.map((extension) => `**/*${extension}`),
  );

  return [
    eslintFiles.length &&
      `eslint --max-warnings 0 ${eslintFiles.map(addQuotes).join(' ')}`,
    prettierFiles.length &&
      `prettier --write ${prettierFiles.map(addQuotes).join(' ')}`,
  ].filter(Boolean);
};
