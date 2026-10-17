// Module resolution hooks: redirect two app modules to test fakes.
const fakes = {
  "/schema/db.config.js": new URL("./fake-db.js", import.meta.url).href,
  "/src/api/chat/service/gemini.service.js": new URL("./fake-gemini.js", import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  for (const [suffix, fakeUrl] of Object.entries(fakes)) {
    if (result.url.endsWith(suffix)) return { url: fakeUrl, shortCircuit: true };
  }
  return result;
}
