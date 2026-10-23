// Builds the Electron processes and renderer, keeping modeling resources beside their modules.
import { build as transform } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve, relative, dirname, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'src');
const output = resolve(root, 'dist');
const outputPath = relative(root, output);
if (outputPath.startsWith('..') || isAbsolute(outputPath) || !outputPath) {
  throw new Error('Build output must stay inside this repository');
}
await rm(output, { recursive: true, force: true });
const entries = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(file);
    } else if (!/\.test\.[cm]?[jt]sx?$/.test(file)) {
      if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        entries.push(file);
      } else if (!['.ts', '.tsx'].includes(extname(file))) {
        // Skills and rule files keep their module-relative location in packaged execution.
        const destination = resolve(output, relative(source, file));
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(file, destination);
      }
    }
  }
}
await collect(resolve(source, 'main'));
await collect(resolve(source, 'shared'));
await transform({
  entryPoints: entries, outbase: source, outdir: output,
  bundle: false, platform: 'node', format: 'esm', target: 'node24',
});
await transform({
  entryPoints: [resolve(source, 'preload/index.ts')],
  outfile: resolve(output, 'preload/index.cjs'), bundle: true,
  platform: 'node', format: 'cjs', external: ['electron'],
});

const renderer = resolve(source, 'renderer/src');
try {
  await build({
    configFile: false,
    logLevel: 'warn',
    root: resolve(source, 'renderer'),
    plugins: [react(), tailwind()],
    publicDir: resolve(root, 'resources/public'),
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    resolve: {
      alias: {
        '@/components/ui': resolve(renderer, 'shared/ui'),
        '@/lib/utils': resolve(renderer, 'shared/ui/utils.ts'),
        '@': renderer,
        // Onborda expects this navigation API; the desktop adapter uses browser history.
        'next/navigation': resolve(renderer, 'shared/lib/browser-navigation.tsx'),
      },
    },
    build: { outDir: resolve(output, 'renderer'), emptyOutDir: true, chunkSizeWarningLimit: 3000 },
  });
  // Renderer-only dependencies are bundled, so keep their font licenses in the app too.
  const licenses = resolve(output, 'renderer/licenses');
  await mkdir(licenses, { recursive: true });
  for (const name of ['public-sans', 'jetbrains-mono']) {
    await copyFile(resolve(root, 'node_modules/@fontsource-variable', name, 'LICENSE'), resolve(licenses, name + '.txt'));
  }
  await copyFile(resolve(renderer, 'shared/assistant-ui/LICENSE'), resolve(licenses, 'assistant-ui-elements.txt'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
