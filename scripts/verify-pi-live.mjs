// Exercises real providers, Pi packages and desktop approval controls in an isolated copy of local app data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { PGlite } from '@electric-sql/pglite';

if (process.env.SOFTJL_LIVE_VERIFY !== '1') throw new Error('Set SOFTJL_LIVE_VERIFY=1 to authorize actual provider calls and temporary-file approvals.');
const repository = resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = process.env.SOFTJL_LIVE_DATA_DIR ?? join(process.env.APPDATA, 'softjl-desktop');
const cache = join(repository, '.cache');
await mkdir(cache, { recursive: true });
const root = await mkdtemp(join(cache, 'pi-live-'));
const data = join(root, 'app-data'), cwd = join(root, 'fixture');
const proof = 'LIVE_CHILD_' + randomUUID();
const proxy = process.env.SOFTJL_LIVE_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
const env = { ...process.env, SOFTJL_DESKTOP_TEST_DATA_DIR: data, SOFTJL_DESKTOP_SMOKE: '1', UML_STANDARD_CONTEXT_TOKENS: '32000' };
delete env.ELECTRON_RUN_AS_NODE;
let app, page, projectId, config;
const evidence = { startedAt: new Date().toISOString(), contextBudget: 32000, checks: [] };
const log = (event, fields = {}) => console.log(JSON.stringify({ event, ...fields }));

async function prepareVerification() {
  await mkdir(data); await mkdir(cwd);
  // Copy encrypted credentials with their Electron encryption metadata; never export a plaintext key.
  for (const name of ['database', 'provider-key.bin', 'Local State']) await cp(join(source, name), join(data, name), { recursive: true });
  execFileSync('git', ['init', '--quiet', cwd]);
  await writeFile(join(cwd, 'subagent-proof.txt'), proof);
  await mkdir(join(data, 'pi-agent'));
  await writeFile(join(data, 'pi-agent/web-search.json'), JSON.stringify({ workflow: 'none', ...(proxy ? { proxy } : {}) }));
}

async function launch() {
  app = await electron.launch({ args: [repository, '--user-data-dir=' + data], env, timeout: 60000 });
  page = await app.firstWindow({ timeout: 60000 });
  await page.waitForURL('**/projects', { timeout: 60000 });
}
async function api(url, body) {
  return page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const value = await response.json();
    if (!response.ok) throw new Error(JSON.stringify({ status: response.status, value }));
    return value;
  }, { url, body });
}
async function run(label, message, decision = 'approve') {
  log('start', { label });
  const previous = (await api(`/api/projects/${projectId}/standard`)).state;
  const started = await api(`/api/projects/${projectId}/standard`, {
    operation: 'chat', message, language: 'zh-CN', reasoning: false,
    providerSettings: { providerConfigId: config.id, model: config.defaultModel },
  });
  const runId = started.state.run.id, seen = new Set(), approvals = [];
  // An externally started request must be loaded into the renderer's real running-state polling loop.
  await page.reload();
  let state;
  for (const deadline = Date.now() + 240000; Date.now() < deadline;) {
    state = (await api(`/api/projects/${projectId}/standard`)).state;
    const coding = await api(`/api/desktop/projects/${projectId}/conversation-code`);
    for (const prompt of coding.approvals) {
      if (prompt.runId !== runId || seen.has(prompt.id)) continue;
      seen.add(prompt.id);
      approvals.push({ tool: prompt.tool, child: prompt.title.includes('(Subagent)'), decision });
      log('approval', { label, tool: prompt.tool, child: prompt.title.includes('(Subagent)'), decision });
      assert.equal(prompt.dialog, 'select', 'This scenario expects the upstream permission selector');
      if (decision === 'cancel') {
        await page.getByRole('button', { name: '停止本轮任务', exact: true }).click();
        continue;
      }
      const deny = decision === 'deny' || decision === 'child-deny' && prompt.title.includes('(Subagent)');
      // Only approve the known temporary writes. Unexpected mutations fail the verification.
      if (['write', 'edit'].includes(prompt.tool)) {
        const target = resolve(cwd, String(prompt.arguments?.path ?? ''));
        assert.ok(['denied.txt', 'approved.txt', 'cancelled.txt'].some(name => target === join(cwd, name)), 'Unexpected write target');
      }
      const option = deny ? 'No' : 'Yes';
      assert.ok(prompt.options.includes(option), 'Upstream permission contract changed');
      await page.getByRole('button', { name: option, exact: true }).click({ timeout: 15000 });
    }
    if (state.run?.id === runId && state.run.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  assert.equal(state?.run?.status, decision === 'cancel' ? 'stopped' : 'completed', `${label}: ${state?.run?.error ?? 'run incomplete'}`);
  const messages = state.conversation.slice(previous.conversation?.length ?? 0);
  const tools = messages.flatMap(item => item.tools ?? []);
  const reply = messages.filter(item => item.role === 'assistant').at(-1)?.text ?? '';
  const record = { label, status: state.run.status, approvals, tools: tools.map(tool => ({ name: tool.name, status: tool.status })), reply, compactions: state.compactionCount ?? 0 };
  evidence.checks.push(record);
  await writeFile(join(root, 'evidence.json'), JSON.stringify(evidence, null, 2));
  log('complete', { label, status: record.status, tools: record.tools, compactions: record.compactions });
  return { state, tools, reply, approvals };
}

async function inspectCompaction() {
  // Read private history only after the Electron backend has closed its database.
  const db = new PGlite(join(data, 'database'));
  try {
    await db.waitReady;
    const result = await db.query('select state from project_workspace_states where project_id=$1', [projectId]);
    const state = result.rows[0].state.standardProject;
    const entries = state.piSession.entries.filter(entry => entry.type === 'compaction');
    assert.ok(entries.some(entry => entry.fromHook === true), 'No third-party compaction was persisted');
    for (const entry of entries) {
      const modified = entry.summary.match(/<modified-files>([\s\S]*?)<\/modified-files>/)?.[1] ?? '';
      assert.doesNotMatch(modified, /denied\.txt|cancelled\.txt/, 'Rejected intent was reported as a completed mutation');
    }
    evidence.compaction = entries.map(entry => ({ fromHook: entry.fromHook, tokensBefore: entry.tokensBefore, summary: entry.summary }));
  } finally { await db.close(); }
}

try {
  await prepareVerification();
  await launch();
  const all = (await api('/api/provider-configs')).providerConfigs.filter(item => item.status === 'active');
  config = process.env.SOFTJL_LIVE_PROVIDER_NAME ? all.find(item => item.name === process.env.SOFTJL_LIVE_PROVIDER_NAME) : all.length === 1 ? all[0] : undefined;
  assert.ok(config, 'Configure an active provider, or select one with SOFTJL_LIVE_PROVIDER_NAME');
  if (process.env.SOFTJL_LIVE_MODEL) {
    assert.ok(config.allowedModels.includes(process.env.SOFTJL_LIVE_MODEL));
    config.defaultModel = process.env.SOFTJL_LIVE_MODEL;
  }
  evidence.provider = { name: config.name, model: config.defaultModel };
  assert.equal((await api(`/api/provider-configs/${config.id}/test`, { model: config.defaultModel })).ok, true);
  log('provider-connected', evidence.provider);
  projectId = (await api('/api/projects', { name: 'Pi live integration', description: null, projectMode: 'standard' })).project.id;
  await page.goto(new URL('/projects/' + projectId, page.url()).href);
  // Only the OS chooser is controlled. All IPC, backend, model, tool and approval requests are real.
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, cwd);
  await page.getByRole('button', { name: '项目设置', exact: true }).click();
  await page.getByRole('button', { name: '选择文件夹', exact: true }).click();
  await page.waitForFunction(directory => document.querySelector('#project-workspace-directory')?.value === directory, cwd);
  assert.equal(await page.getByLabel('项目工作区', { exact: true }).inputValue(), cwd);
  await page.getByRole('button', { name: 'Agent 聊天', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /代码目录/ }).count(), 0);
  let result = await run('deny-write', '隔离环境权限联调，不生成模型或说明书。仅调用一次 write 写入 denied.txt，内容 MUST_NOT_EXIST；拒绝后立即停止，不换工具、路径或命令绕过。', 'deny');
  assert.ok(result.approvals.length && result.tools.some(tool => tool.name === 'write' && tool.status === 'failed'));
  await assert.rejects(access(join(cwd, 'denied.txt')));
  result = await run('allow-once', '仅调用 write 写入 approved.txt，内容严格为 LIVE_PERMISSION_GRANTED，成功后简短报告，不做其他事情。');
  assert.ok(result.approvals.length);
  assert.equal((await readFile(join(cwd, 'approved.txt'), 'utf8')).trimEnd(), 'LIVE_PERMISSION_GRANTED');
  result = await run('subagent', `必须调用 Explore 子代理，用 read 读取 subagent-proof.txt，返回完整校验码。父代理不要读取或猜测。显式指定 model=uml-managed/${config.defaultModel}，run_in_background=false，max_turns=4。不生成模型或说明书。`);
  assert.ok(result.reply.includes(proof));
  assert.ok(result.approvals.some(item => item.child));
  assert.ok(result.tools.some(tool => tool.name === 'subagent' && tool.data?.status === 'completed'));
  assert.ok(!result.tools.some(tool => ['read', 'powershell'].includes(tool.name)), 'Parent bypassed delegation');
  result = await run('external-search', '调用 web_search 搜索 assistant-ui ReviewableDiff 官方文档，workflow=none，provider=exa，numResults=3；再调用 fetch_content 读取 https://www.assistant-ui.com/elements/reviewable-diff 。仅根据本次检索说明组件交互并列出来源，不创建任何产物。');
  const search = result.tools.find(tool => tool.name === 'web_search');
  const fetched = result.tools.find(tool => tool.name === 'fetch_content');
  assert.ok(search?.data?.queries?.some(query => query.provider === 'exa' && query.results.length > 0));
  assert.ok(fetched?.data?.urls?.some(url => !url.error && url.content.length > 100));
  // Restored conversations collapse tool details by default; inspect the real expanded components.
  for (const button of await page.getByRole('button', { name: /推理过程|处理失败或已中断/ }).all()) {
    if (await button.getAttribute('aria-expanded') === 'false') await button.click();
  }
  await page.locator('[data-slot="web-search"]').last().waitFor();
  await page.locator('[data-slot="sources"]').last().waitFor();
  if (!result.state.compactionCount) {
    // Real context, not invented usage: supply bounded synthetic reference material if the transcript is still short.
    const reference = Array.from({ length: 160 }, (_, i) => `Record ${i}: A fictional student borrowed a fictional book. The sample is synthetic reference material. Inventory was checked before checkout, and the return cleared the loan. No operation is requested. `).join('\n');
    await run('context-reference', '以下是压缩验收的虚构参考材料，只回复收到，并保留已有子代理校验码与审批事实：\n' + reference);
    await run('context-boundary', '简短确认收到参考资料，不调用任何工具。');
  }
  await page.screenshot({ path: join(root, 'search.png'), fullPage: true });
  await app.close(); app = undefined;
  await inspectCompaction();
  await launch(); await page.goto(new URL('/projects/' + projectId, page.url()).href);
  result = await run('restart-after-compaction', '应用已经重启。只根据已有会话回答：子代理之前读到的完整校验码是什么？denied.txt 和 approved.txt 哪个写入成功、哪个被拒绝？不要读取文件或调用任何工具。');
  assert.ok(result.reply.includes(proof)); assert.equal(result.tools.length, 0);
  const deniedProof = randomUUID(); await writeFile(join(cwd, 'child-denied-proof.txt'), deniedProof);
  result = await run('deny-child-read', `调用 Explore 子代理，仅尝试一次 read 读取 child-denied-proof.txt；若被拒绝必须停止，不换工具绕过。父代理不得自己读取或猜测。使用 uml-managed/${config.defaultModel}，run_in_background=false，max_turns=3。`, 'child-deny');
  assert.ok(result.approvals.some(item => item.child)); assert.ok(!result.reply.includes(deniedProof));
  assert.ok(result.tools.some(tool => tool.name === 'subagent' && /denied|拒绝/i.test(tool.output ?? '')));
  await run('cancel-pending-write', '仅调用 write 向 cancelled.txt 写入 CANCEL_SHOULD_NOT_HAPPEN，等待用户审批，不做其他事情。', 'cancel');
  await assert.rejects(access(join(cwd, 'cancelled.txt')));
  result = await run('continue-after-cancel', '上一轮已取消，不要重试写入或调用工具。只回复：已取消，不再执行。');
  assert.equal(result.tools.length, 0); await assert.rejects(access(join(cwd, 'cancelled.txt')));
  assert.deepEqual((await api(`/api/desktop/projects/${projectId}/conversation-code`)).approvals, []);
  await page.screenshot({ path: join(root, 'continued.png'), fullPage: true });
  await app.close(); app = undefined;
  await inspectCompaction();
  evidence.completedAt = new Date().toISOString();
  await writeFile(join(root, 'evidence.json'), JSON.stringify(evidence, null, 2));
  log('verified', { evidence: join(root, 'evidence.json') });
} finally {
  await app?.close();
  // Only the generated encrypted database copy is removed; evidence and the harmless fixture remain.
  assert.ok(resolve(data).startsWith(resolve(root) + sep) && resolve(root).startsWith(resolve(cache) + sep));
  await rm(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
