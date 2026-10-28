import * as nodeModule from 'node:module';

type LoadResult = { format: string; source?: string; shortCircuit?: boolean };
type LoadContext = Record<string, unknown>;

const registerHooks = (
  nodeModule as unknown as {
    registerHooks: (hooks: {
      load: (
        url: string,
        context: LoadContext,
        nextLoad: (url: string, context: LoadContext) => LoadResult,
      ) => LoadResult;
    }) => void;
  }
).registerHooks;

registerHooks({
  load(url, context, nextLoad) {
    if (String(url).endsWith('.css')) {
      return { format: 'module', source: 'export default "";', shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
