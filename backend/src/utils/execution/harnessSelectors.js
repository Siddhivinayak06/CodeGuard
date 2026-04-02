function shouldUseCompiledBatchHarness(
  lang,
  executionModel,
  executionConfig = {}
) {
  const normalizedLang = String(lang || '').toLowerCase();
  const normalizedModel = String(executionModel || '').toLowerCase();
  const harnessLangs = executionConfig.wrapperHarnessLangs || [];

  return (
    executionConfig.enableWrapperHarness === true &&
    normalizedModel === 'wrapper_harness' &&
    harnessLangs.includes(normalizedLang) &&
    (normalizedLang === 'python' ||
      normalizedLang === 'py' ||
      normalizedLang === 'c' ||
      normalizedLang === 'java')
  );
}

module.exports = {
  shouldUseCompiledBatchHarness,
};
