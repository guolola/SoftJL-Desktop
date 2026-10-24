// Loads the real Windows fff library from Electron ASAR with the production unpack layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import electron from 'electron';
import asar from '@electron/asar';

test('packaged Electron loads fff native DLL and finds a real file', { skip: process.platform !== 'win32', timeout: 60000 }, async () => {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, 'softjl-fff-asar-'));
  const app = join(root, 'app'), project = join(root, 'project');
  try {
    await mkdir(app); await mkdir(project);
    await writeFile(join(project, 'native-fixture.txt'), 'native library search fixture');
    const packages = ['@ff-labs/fff-node', '@ff-labs/fff-bin-win32-x64', 'ffi-rs', '@yuuang/ffi-rs-win32-x64-msvc'];
    for (const name of packages) await cp(resolve('node_modules', name), join(app, 'node_modules', name), { recursive: true });
    await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'pi-native-smoke', main: 'main.cjs' }));
    await writeFile(join(app, 'main.cjs'), `
      (async () => {
        const { FileFinder } = await import('@ff-labs/fff-node');
        const created = FileFinder.create({ basePath: process.argv[2], disableWatch: true });
        if (!created.ok) throw new Error(created.error);
        try {
          await created.value.waitForScan(10000);
          const result = created.value.fileSearch('native-fixture');
          if (!result.ok || !result.value.items.some(item => item.relativePath === 'native-fixture.txt')) throw new Error(JSON.stringify(result));
          console.log('FFF_ASAR_OK');
        } finally { created.value.destroy(); }
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `);
    const archive = join(root, 'app.asar');
    // This fixture contains only the four production-unpacked native packages.
    await asar.createPackageWithOptions(app, archive, { unpackDir: 'node_modules' });
    await access(join(archive + '.unpacked', 'node_modules/@ff-labs/fff-bin-win32-x64/fff_c.dll'));
    const result = await promisify(execFile)(electron, [join(archive, 'main.cjs'), project], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, timeout: 30000,
    });
    assert.match(result.stdout, /FFF_ASAR_OK/);
  } finally {
    // Only remove the fixture created above, never an input project path.
    assert.ok(resolve(root).startsWith(base + sep + 'softjl-fff-asar-'));
    await rm(root, { recursive: true, force: true });
  }
});
