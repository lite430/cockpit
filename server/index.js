// 个人运营驾驶舱 —— API 服务（契约见 docs/api-contract.md）
// 直接 `node server/index.js` 启动时监听端口；被测试 import 时不监听。
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { createAiClient, loadAiConfig } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const COCKPIT_ROOT = path.resolve(__dirname, '..');
// DATA_FILE 相对路径锚定在 cockpit 根，避免受启动 cwd 影响
export const DEFAULT_DATA_FILE = path.resolve(COCKPIT_ROOT, process.env.DATA_FILE || 'data/db.json');

export const defaultStore = new Store(DEFAULT_DATA_FILE);
// AI_CONFIG_FILE 指定其他配置文件（相对路径锚定 cockpit 根），测试用它隔离本机真实 config.json
const aiConfigOverride = process.env.AI_CONFIG_FILE
  ? path.resolve(COCKPIT_ROOT, process.env.AI_CONFIG_FILE)
  : undefined;
export const defaultAi = createAiClient(
  aiConfigOverride ? loadAiConfig({ configFile: aiConfigOverride }) : loadAiConfig(),
);

const TAGS = ['xhs', 'xy', 'sph'];
const AI_LINES = ['xhs', 'xy', 'sph'];
const AI_TYPES = ['script', 'copy', 'reply'];

const isStr = (v) => typeof v === 'string';
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

// GET /bookmarklet.js 的内容：抓当前页 url/title/选中文本，POST 到同源 /api/materials/quick
const BOOKMARKLET_JS = `// 一键收藏书签脚本：把本文件（或下面整段函数）拖进书签栏，在任意页面点击即可收藏
// 抓取当前页 location.href / document.title / 选中文本，POST 到同源 /api/materials/quick
(function () {
  var sel = '';
  try {
    sel = window.getSelection ? String(window.getSelection()) :
      (document.selection ? document.selection.createRange().text : '');
  } catch (e) { sel = ''; }
  var payload = {
    url: location.href,
    title: document.title || '',
    body: (sel || '').trim()
  };
  fetch('/api/materials/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (r) {
    return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t); });
  }).then(function (m) {
    alert('已收进素材库：' + ((m && m.summary) || payload.title || payload.url));
  }).catch(function (e) {
    alert('收藏失败：' + (e && e.message ? e.message : e));
  });
})();
`;

function quickSource(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host ? `书签 · ${host}` : '书签收藏';
  } catch (_err) {
    return '书签收藏';
  }
}

export function createApp(store = defaultStore, ai = defaultAi) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const bad = (res, msg) => res.status(400).json({ error: msg });
  const notFound = (res, what) => res.status(404).json({ error: `${what}不存在` });

  // ---------- health ----------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---------- todos ----------
  app.get('/api/todos', (_req, res) => {
    res.json(store.getTodos());
  });

  app.post('/api/todos', (req, res) => {
    const { text, due = '', tag } = req.body ?? {};
    if (!nonEmpty(text)) return bad(res, 'text 必填且不能为空');
    if (!TAGS.includes(tag)) return bad(res, 'tag 必须是 xhs|xy|sph');
    if (!isStr(due)) return bad(res, 'due 必须是字符串');
    res.status(201).json(store.addTodo({ text: text.trim(), due, tag }));
  });

  app.patch('/api/todos/:id', (req, res) => {
    const patch = req.body ?? {};
    if (patch.text !== undefined && !nonEmpty(patch.text)) return bad(res, 'text 不能为空');
    if (patch.tag !== undefined && !TAGS.includes(patch.tag)) return bad(res, 'tag 必须是 xhs|xy|sph');
    if (patch.done !== undefined && typeof patch.done !== 'boolean') return bad(res, 'done 必须是布尔值');
    if (patch.due !== undefined && !isStr(patch.due)) return bad(res, 'due 必须是字符串');
    const todo = store.updateTodo(req.params.id, patch);
    return todo ? res.json(todo) : notFound(res, 'todo ');
  });

  app.delete('/api/todos/:id', (req, res) => {
    store.deleteTodo(req.params.id) ? res.status(204).end() : notFound(res, 'todo ');
  });

  // ---------- schedule ----------
  app.get('/api/schedule', (_req, res) => {
    res.json(store.getSchedule());
  });

  app.post('/api/schedule', (req, res) => {
    const { time, title, note = '' } = req.body ?? {};
    if (!nonEmpty(time)) return bad(res, 'time 必填且不能为空');
    if (!nonEmpty(title)) return bad(res, 'title 必填且不能为空');
    if (!isStr(note)) return bad(res, 'note 必须是字符串');
    res.status(201).json(store.addSchedule({ time: time.trim(), title: title.trim(), note }));
  });

  app.delete('/api/schedule/:id', (req, res) => {
    store.deleteSchedule(req.params.id) ? res.status(204).end() : notFound(res, '日程 ');
  });

  // ---------- lines（运营看板：pubs / cms） ----------
  app.get('/api/lines', (_req, res) => {
    res.json(store.getLines());
  });

  app.post('/api/lines/:id/pubs', (req, res) => {
    if (!store.getLine(req.params.id)) return notFound(res, '业务线 ');
    const { when, tt, st = '待办' } = req.body ?? {};
    if (!nonEmpty(when)) return bad(res, 'when 必填且不能为空');
    if (!nonEmpty(tt)) return bad(res, 'tt 必填且不能为空');
    if (!isStr(st)) return bad(res, 'st 必须是字符串');
    res.status(201).json(store.addPub(req.params.id, { when: when.trim(), tt: tt.trim(), st }));
  });

  app.patch('/api/lines/:lid/pubs/:pid', (req, res) => {
    if (!store.getLine(req.params.lid)) return notFound(res, '业务线 ');
    const patch = req.body ?? {};
    if (patch.when !== undefined && !nonEmpty(patch.when)) return bad(res, 'when 不能为空');
    if (patch.tt !== undefined && !nonEmpty(patch.tt)) return bad(res, 'tt 不能为空');
    if (patch.st !== undefined && !isStr(patch.st)) return bad(res, 'st 必须是字符串');
    const pub = store.updatePub(req.params.lid, req.params.pid, patch);
    return pub ? res.json(pub) : notFound(res, '排期 ');
  });

  app.patch('/api/lines/:lid/cms/:cid', (req, res) => {
    if (!store.getLine(req.params.lid)) return notFound(res, '业务线 ');
    const { handled } = req.body ?? {};
    if (typeof handled !== 'boolean') return bad(res, 'handled 必须是布尔值');
    const cm = store.updateCm(req.params.lid, req.params.cid, { handled });
    return cm ? res.json(cm) : notFound(res, '评论 ');
  });

  // ---------- materials ----------
  app.get('/api/materials', (req, res) => {
    const tag = typeof req.query.tag === 'string' && req.query.tag ? req.query.tag : undefined;
    res.json(store.getMaterials(tag));
  });

  const validateMaterial = (res, fields, { partial = false } = {}) => {
    const has = (k) => fields[k] !== undefined;
    if ((!partial && !nonEmpty(fields.body)) || (partial && has('body') && !nonEmpty(fields.body)))
      return 'body 必填且不能为空';
    if (has('source') && !isStr(fields.source)) return 'source 必须是字符串';
    if (has('summary') && !isStr(fields.summary)) return 'summary 必须是字符串';
    if (has('tags') && (!Array.isArray(fields.tags) || fields.tags.some((t) => !isStr(t))))
      return 'tags 必须是字符串数组';
    if (has('fav') && (!Number.isInteger(fields.fav) || fields.fav < 1 || fields.fav > 5))
      return 'fav 必须是 1-5 的整数';
    if (has('url') && !isStr(fields.url)) return 'url 必须是字符串';
    if (has('date') && !isStr(fields.date)) return 'date 必须是字符串';
    return null;
  };

  app.post('/api/materials', (req, res) => {
    const body = req.body ?? {};
    const err = validateMaterial(res, body);
    if (err) return bad(res, err);
    const { source = '网页 · 手动', body: text, summary = '', tags = [], fav = 3, url = '' } = body;
    res.status(201).json(store.addMaterial({ source, body: text.trim(), summary, tags, fav, url }));
  });

  // bookmarklet 一键收藏入口：服务端补默认字段
  app.post('/api/materials/quick', (req, res) => {
    const { url = '', title = '', body = '' } = req.body ?? {};
    if (!nonEmpty(url) && !nonEmpty(title) && !nonEmpty(body))
      return bad(res, 'url/title/body 至少提供一个');
    res.status(201).json(
      store.addMaterial({
        source: quickSource(url),
        body: [body, title, url].find(nonEmpty) || '',
        summary: '',
        tags: ['#收藏'],
        fav: 3,
        url,
      })
    );
  });

  app.patch('/api/materials/:id', (req, res) => {
    const patch = req.body ?? {};
    const err = validateMaterial(res, patch, { partial: true });
    if (err) return bad(res, err);
    const mat = store.updateMaterial(req.params.id, patch);
    return mat ? res.json(mat) : notFound(res, '素材 ');
  });

  app.delete('/api/materials/:id', (req, res) => {
    store.deleteMaterial(req.params.id) ? res.status(204).end() : notFound(res, '素材 ');
  });

  // ---------- bookmarklet ----------
  app.get('/bookmarklet.js', (_req, res) => {
    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.send(BOOKMARKLET_JS);
  });

  // ---------- scratch ----------
  app.get('/api/scratch', (_req, res) => {
    res.json({ text: store.getScratch() });
  });

  app.put('/api/scratch', (req, res) => {
    const { text } = req.body ?? {};
    if (!isStr(text)) return bad(res, 'text 必须是字符串');
    res.json(store.setScratch(text));
  });

  // ---------- ai ----------
  app.post('/api/ai/generate', async (req, res) => {
    const { line, type, prompt } = req.body ?? {};
    if (!AI_LINES.includes(line)) return bad(res, 'line 必须是 xhs|xy|sph');
    if (!AI_TYPES.includes(type)) return bad(res, 'type 必须是 script|copy|reply');
    if (!nonEmpty(prompt)) return bad(res, 'prompt 必填且不能为空');
    if (!ai.configured) return res.status(503).json({ error: 'AI 未配置' });
    try {
      const out = await ai.generate(line, type, prompt.trim());
      res.json(out);
    } catch (err) {
      res.status(err?.status || 502).json({ error: err?.message || 'AI 生成失败' });
    }
  });

  // ---------- 兜底：未匹配路由 404（JSON），其余异常转错误响应 ----------
  app.use((req, res) => {
    res.status(404).json({ error: `Not Found: ${req.method} ${req.path}` });
  });

  app.use((err, _req, res, _next) => {
    // express.json 解析失败（如非法 JSON）带 status=400 / type=entity.parse.failed
    const status = err?.status || (err?.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('[cockpit] unhandled error:', err);
    res.status(status).json({ error: err?.message || 'Internal Server Error' });
  });

  return app;
}

export const app = createApp();

// 只有「直接 node server/index.js 启动」时才监听端口；
// 被 vitest/supertest import 时不监听，避免端口占用冲突。
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const port = Number(process.env.PORT) || 5175;
  if (!fs.existsSync(path.dirname(DEFAULT_DATA_FILE))) {
    fs.mkdirSync(path.dirname(DEFAULT_DATA_FILE), { recursive: true });
  }
  defaultStore.load(); // 启动即读盘（无文件则 seed 初始化）
  const server = app.listen(port, () => {
    console.log(`[cockpit] API server listening on http://localhost:${port}`);
    console.log(`[cockpit] data file: ${DEFAULT_DATA_FILE}`);
    console.log(`[cockpit] ai: ${defaultAi.configured ? `configured (${defaultAi.config.model})` : '未配置（/api/ai/generate 将返回 503）'}`);
  });
  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`[cockpit] 端口 ${port} 已被占用（${err.code}）`);
      process.exitCode = 1;
    } else {
      console.error('[cockpit] server error:', err);
    }
  });
}
