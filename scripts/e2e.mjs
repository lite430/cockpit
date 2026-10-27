#!/usr/bin/env node
// 端到端冒烟测试：spawn 真实 server 进程 → 轮询 /api/health 就绪 → 依次断言核心链路 → 杀子进程 → 按结果 exit 0/1。
// 覆盖：todos 增改删闭环 / materials/quick 默认字段 / bookmarklet.js MIME / AI 未配置 503 / 未知路由 404。
// 数据写到 .tmp/e2e-数据.json（gitignore 已忽略），跑前跑后都清理，不碰 data/db.json。
// 注意：AI_API_KEY 置空时 loadAiConfig 会回落到 server/config.json（见 server/ai.js）；
//      本机若存在已配好 key 的 config.json，503 断言会失败——那是配置冲突，不是脚本问题。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_NAME = 'e2e-数据.json';
const TMP_DIR = path.join(ROOT, '.tmp');

// ---------------- 断言工具：收集全部失败，最后统一报告 ----------------
const failures = [];
let current = '';
function step(name) {
  current = name;
  process.stdout.write(`\n== ${name}\n`);
}
function check(cond, label, detail) {
  if (cond) {
    process.stdout.write(`  ✅ ${label}\n`);
  } else {
    const extra = detail === undefined ? '' : ` —— 实际值：${JSON.stringify(detail)}`;
    process.stdout.write(`  ❌ ${label}${extra}\n`);
    failures.push(`[${current}] ${label}${extra}`);
  }
}

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应（如 bookmarklet.js / 204） */
  }
  return { status: res.status, headers: res.headers, text, json };
}

// ---------------- Windows 进程树清理：taskkill /T /F 连子进程一起杀 ----------------
function killTree(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const tk = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      tk.on('close', () => resolve());
      tk.on('error', () => {
        child.kill('SIGKILL');
        resolve();
      });
    });
  }
  child.kill('SIGTERM');
  return new Promise((resolve) => setTimeout(resolve, 200));
}

// ---------------- 临时数据文件清理（含 store.save 可能遗留的同名 .tmp 残片） ----------------
function cleanTmpData() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  for (const f of fs.readdirSync(TMP_DIR)) {
    if (f === DATA_NAME || f.startsWith(`.${DATA_NAME}.`)) {
      fs.rmSync(path.join(TMP_DIR, f), { force: true });
    }
  }
}

// ---------------- 就绪轮询：/api/health 通了且子进程没死 ----------------
function waitForServer(child, serverLog, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const onExit = (code) => {
      cleanup();
      reject(new Error(`server 子进程提前退出（code=${code}）\n--- server log ---\n${serverLog()}`));
    };
    child.once('exit', onExit);
    function cleanup() {
      clearInterval(timer);
      child.removeListener('exit', onExit);
    }
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/health`);
        if (res.ok) {
          const body = await res.json();
          cleanup();
          resolve(body);
        }
      } catch {
        /* 未就绪，继续轮询 */
      }
      if (Date.now() > deadline) {
        cleanup();
        reject(new Error(`等待 /api/health 就绪超时（${timeoutMs}ms）\n--- server log ---\n${serverLog()}`));
      }
    }, 200);
  });
}

// ---------------- 冒烟用例 ----------------
async function assertHealth() {
  step('GET /api/health 就绪探活');
  const health = await req('GET', `${BASE}/api/health`);
  check(health.status === 200 && health.json?.ok === true, 'health 返回 200 {ok:true}', health.json);
}

async function assertTodosLoop() {
  step('todos POST→GET→PATCH→DELETE 闭环');
  const post = await req('POST', `${BASE}/api/todos`, { text: 'e2e 冒烟待办', due: '今天', tag: 'xhs' });
  check(post.status === 201, 'POST /api/todos 返回 201', post.status);
  const todo = post.json;
  const id = typeof todo?.id === 'string' ? todo.id : '';
  check(!!id, '新建 todo 返回 id', todo);
  check(
    todo?.text === 'e2e 冒烟待办' && todo?.done === false && todo?.tag === 'xhs' && todo?.due === '今天',
    '新建 todo 字段完整（text/done:false/tag/due）',
    todo
  );

  const list = await req('GET', `${BASE}/api/todos`);
  check(
    Array.isArray(list.json) && list.json.some((t) => t.id === id),
    'GET /api/todos 能看到新建的 todo',
    { listLen: Array.isArray(list.json) ? list.json.length : null }
  );

  const patch = await req('PATCH', `${BASE}/api/todos/${id}`, { done: true, due: '17:00' });
  check(patch.status === 200 && patch.json?.done === true && patch.json?.due === '17:00', 'PATCH {done:true,due} 生效', patch.json);

  const del = await req('DELETE', `${BASE}/api/todos/${id}`);
  check(del.status === 204, 'DELETE /api/todos/:id 返回 204', del.status);

  const list2 = await req('GET', `${BASE}/api/todos`);
  check(
    Array.isArray(list2.json) && !list2.json.some((t) => t.id === id),
    'DELETE 后 GET 不再包含该 todo',
    null
  );
}

async function assertQuickMaterial() {
  step('materials/quick 一键收藏补默认字段');
  const quick = await req('POST', `${BASE}/api/materials/quick`, {
    url: 'https://example.com/smoke',
    title: 'e2e 冒烟收藏',
    body: '',
  });
  check(quick.status === 201, 'POST /api/materials/quick 返回 201', quick.status);
  const mat = quick.json;
  check(typeof mat?.id === 'string' && !!mat.id, '返回素材带 id', mat);
  check(mat?.source === '书签 · example.com', 'source 自动补成「书签 · 域名」', mat?.source);
  check(Array.isArray(mat?.tags) && mat.tags.includes('#收藏'), 'tags 默认含 #收藏', mat?.tags);
  check(mat?.fav === 3, 'fav 默认 3', mat?.fav);
  check(typeof mat?.date === 'string' && !!mat.date, 'date 自动补当天（M/D 格式）', mat?.date);
  check(mat?.body === 'e2e 冒烟收藏' && mat?.url === 'https://example.com/smoke', 'body 取 title、url 原样保存', mat);
}

async function assertBookmarklet() {
  step('GET /bookmarklet.js');
  const bm = await req('GET', `${BASE}/bookmarklet.js`);
  check(bm.status === 200, '返回 200', bm.status);
  const ct = bm.headers.get('content-type') || '';
  check(ct.toLowerCase().startsWith('text/javascript'), `Content-Type 为 text/javascript（实际：${ct || '空'}）`, ct);
  check(bm.text.includes('/api/materials/quick'), '脚本体内容会 POST 到 /api/materials/quick', null);
}

async function assertAi503() {
  step('AI 未配置时 /api/ai/generate 返回 503');
  const ai = await req('POST', `${BASE}/api/ai/generate`, { line: 'xhs', type: 'script', prompt: 'e2e 冒烟' });
  check(ai.status === 503, 'AI_API_KEY 置空时返回 503', ai.status);
  check(ai.json?.error === 'AI 未配置', '错误信息为「AI 未配置」', ai.json);
}

async function assert404() {
  step('未知路由 404');
  const nf = await req('GET', `${BASE}/api/__e2e_no_such_route__`);
  check(nf.status === 404, '未知路由返回 404', nf.status);
  check(!!nf.json?.error && String(nf.json.error).includes('Not Found'), '404 返回 JSON 错误体', nf.json);
}

// ---------------- 主流程 ----------------
async function main() {
  console.log(`[e2e] 启动冒烟：PORT=${PORT}，DATA_FILE=.tmp/${DATA_NAME}`);
  cleanTmpData();
  // 空配置文件隔离本机真实 server/config.json，保证「AI 未配置 → 503」断言确定性
  const emptyCfg = path.join(ROOT, '.tmp', 'e2e-empty-config.json');
  fs.mkdirSync(path.dirname(emptyCfg), { recursive: true });
  fs.writeFileSync(emptyCfg, '{}');

  const child = spawn(process.execPath, [path.join('server', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_FILE: `.tmp/${DATA_NAME}`,
      AI_CONFIG_FILE: path.join('.tmp', 'e2e-empty-config.json'),
      AI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  try {
    await waitForServer(child, () => log);
    await assertHealth();
    await assertTodosLoop();
    await assertQuickMaterial();
    await assertBookmarklet();
    await assertAi503();
    await assert404();
  } catch (err) {
    failures.push(`[setup] ${err.message}`);
  } finally {
    await killTree(child);
    cleanTmpData();
    console.log('\n[e2e] 子进程已清理，临时数据文件已删除');
  }

  if (failures.length) {
    console.error(`\n[e2e] ❌ 冒烟失败，共 ${failures.length} 处：`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\n[e2e] ✅ 全部冒烟断言通过');
  process.exit(0);
}

main().catch((err) => {
  console.error('[e2e] 脚本自身异常：', err);
  process.exit(1);
});
