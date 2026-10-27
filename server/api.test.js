// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { app, createApp, DEFAULT_DATA_FILE } from './index.js';
import { Store } from './store.js';
import { createAiClient } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = path.resolve(__dirname, '..', '.tmp', 'api');

// 契约示例里的用法：直接 import { app }。这里同时确认 import 默认实例不会顺带建出 data/db.json
const defaultDbExistedAtStart = fs.existsSync(DEFAULT_DATA_FILE);

let dbFile;
let api; // 未配置 AI 的测试实例，数据指到 .tmp 下

beforeAll(() => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  dbFile = path.join(TMP_ROOT, `db-${randomUUID().slice(0, 8)}.json`);
  api = createApp(new Store(dbFile), createAiClient({}));
});

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  // 全程没碰默认数据文件（别污染 data/db.json）
  expect(fs.existsSync(DEFAULT_DATA_FILE)).toBe(defaultDbExistedAtStart);
});

describe('GET /api/health', () => {
  it('默认导出的 app 返回 {ok:true}（契约示例用法）', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('createApp 出来的实例同样返回 {ok:true}', async () => {
    const res = await request(api).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('todos', () => {
  it('GET 返回 seed 的 4 条，字段形状符合契约', async () => {
    const res = await request(api).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    for (const t of res.body) {
      expect(Object.keys(t).sort()).toEqual(['done', 'due', 'id', 'tag', 'text']);
      expect(['xhs', 'xy', 'sph']).toContain(t.tag);
      expect(typeof t.done).toBe('boolean');
    }
  });

  it('POST 创建（201），done 默认 false，随后 GET 可见', async () => {
    const res = await request(api)
      .post('/api/todos')
      .send({ text: '写回归测试', due: '明天', tag: 'xy' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ text: '写回归测试', due: '明天', tag: 'xy', done: false });
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);

    const list = await request(api).get('/api/todos');
    expect(list.body).toHaveLength(5);
    expect(list.body.some((t) => t.id === res.body.id)).toBe(true);
  });

  it('POST 缺 text / tag 非法 -> 400', async () => {
    expect((await request(api).post('/api/todos').send({ due: '今天', tag: 'xhs' })).status).toBe(400);
    expect((await request(api).post('/api/todos').send({ text: 'x', tag: 'douyin' })).status).toBe(400);
    expect((await request(api).post('/api/todos').send({ text: '   ', tag: 'xhs' })).status).toBe(400);
    expect((await request(api).post('/api/todos').send({ text: 'no tag' })).status).toBe(400);
  });

  it('PATCH 部分更新（含 done），未知 id -> 404，非法字段 -> 400', async () => {
    const created = (await request(api).post('/api/todos').send({ text: '待勾掉', due: '', tag: 'sph' })).body;

    const patched = await request(api).patch(`/api/todos/${created.id}`).send({ done: true });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: created.id, done: true, text: '待勾掉' }); // 未传字段不动

    const rePatched = await request(api).patch(`/api/todos/${created.id}`).send({ due: '周五' });
    expect(rePatched.body).toMatchObject({ done: true, due: '周五' }); // 之前的 done 保留

    expect((await request(api).patch('/api/todos/t-nope').send({ done: true })).status).toBe(404);
    expect((await request(api).patch(`/api/todos/${created.id}`).send({ done: 'yes' })).status).toBe(400);
    expect((await request(api).patch(`/api/todos/${created.id}`).send({ tag: 'weibo' })).status).toBe(400);
    expect((await request(api).patch(`/api/todos/${created.id}`).send({ text: '' })).status).toBe(400);
  });

  it('DELETE 204 后列表减少；重复删 -> 404', async () => {
    const created = (await request(api).post('/api/todos').send({ text: '待删除', due: '', tag: 'xhs' })).body;
    const before = (await request(api).get('/api/todos')).body.length;

    const del = await request(api).delete(`/api/todos/${created.id}`);
    expect(del.status).toBe(204);

    const after = (await request(api).get('/api/todos')).body;
    expect(after).toHaveLength(before - 1);
    expect((await request(api).delete(`/api/todos/${created.id}`)).status).toBe(404);
  });
});

describe('schedule', () => {
  it('GET 返回 seed 的 5 条，字段形状符合契约', async () => {
    const res = await request(api).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    for (const it of res.body) {
      expect(Object.keys(it).sort()).toEqual(['id', 'note', 'time', 'title']);
    }
  });

  it('POST 创建（201）+ DELETE 删除；缺 time/title -> 400，未知 id -> 404', async () => {
    const created = await request(api).post('/api/schedule').send({ time: '07:30', title: '晨间复盘', note: '过一遍昨天数据' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ time: '07:30', title: '晨间复盘', note: '过一遍昨天数据' });

    expect((await request(api).get('/api/schedule')).body).toHaveLength(6);

    expect((await request(api).post('/api/schedule').send({ time: '', title: 'x' })).status).toBe(400);
    expect((await request(api).post('/api/schedule').send({ time: '08:00' })).status).toBe(400);

    expect((await request(api).delete('/api/schedule/s-nope')).status).toBe(404);
    expect((await request(api).delete(`/api/schedule/${created.body.id}`)).status).toBe(204);
    expect((await request(api).get('/api/schedule')).body).toHaveLength(5);
  });
});

describe('lines', () => {
  it('GET 返回三条业务线 xhs/xy/sph，stats/spark/pubs/cms 形状符合契约', async () => {
    const res = await request(api).get('/api/lines');
    expect(res.status).toBe(200);
    expect(res.body.map((l) => l.id).sort()).toEqual(['sph', 'xhs', 'xy']);

    const xhs = res.body.find((l) => l.id === 'xhs');
    expect(xhs.name).toBeTruthy();
    expect(xhs.sub).toBeTruthy();
    for (const v of Object.values(xhs.stats)) {
      expect(v).toHaveLength(2);
      expect(v.every(Number.isFinite)).toBe(true); // [当前值, 环比%]
    }
    expect(xhs.spark.every(Number.isFinite)).toBe(true);
    expect(xhs.pubs).toHaveLength(3);
    for (const p of xhs.pubs) expect(Object.keys(p).sort()).toEqual(['id', 'st', 'tt', 'when']);
    expect(xhs.cms).toHaveLength(3);
    for (const c of xhs.cms) expect(Object.keys(c).sort()).toEqual(['handled', 'id', 'txt', 'who']);
  });

  it('POST /api/lines/:id/pubs 新增排期（201）；业务线不存在 -> 404；缺字段 -> 400', async () => {
    const created = await request(api).post('/api/lines/xhs/pubs').send({ when: '周六 10:00', tt: '《AI 工具横评》图文', st: '选题' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ when: '周六 10:00', tt: '《AI 工具横评》图文', st: '选题' });
    expect(typeof created.body.id).toBe('string');

    const lines = (await request(api).get('/api/lines')).body;
    expect(lines.find((l) => l.id === 'xhs').pubs).toHaveLength(4);

    expect((await request(api).post('/api/lines/nope/pubs').send({ when: 'x', tt: 'y' })).status).toBe(404);
    expect((await request(api).post('/api/lines/xhs/pubs').send({ when: 'x' })).status).toBe(400);
    expect((await request(api).post('/api/lines/xhs/pubs').send({ tt: 'y' })).status).toBe(400);
  });

  it('PATCH /api/lines/:lid/pubs/:pid 改状态；未知 pid/lid -> 404', async () => {
    const pubs = (await request(api).get('/api/lines')).body.find((l) => l.id === 'xhs').pubs;
    const pid = pubs[0].id;

    const patched = await request(api).patch(`/api/lines/xhs/pubs/${pid}`).send({ st: '已发' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: pid, st: '已发', tt: pubs[0].tt }); // 未传字段不动

    expect((await request(api).patch('/api/lines/xhs/pubs/pub-nope').send({ st: '已发' })).status).toBe(404);
    expect((await request(api).patch('/api/lines/nope/pubs/pub-nope').send({ st: '已发' })).status).toBe(404);
    expect((await request(api).patch(`/api/lines/xhs/pubs/${pid}`).send({ st: 123 })).status).toBe(400);
  });

  it('PATCH /api/lines/:lid/cms/:cid 勾 handled；缺 handled -> 400；未知 -> 404', async () => {
    const cms = (await request(api).get('/api/lines')).body.find((l) => l.id === 'sph').cms;
    const cid = cms[0].id;

    const patched = await request(api).patch(`/api/lines/sph/cms/${cid}`).send({ handled: true });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: cid, handled: true, who: cms[0].who });

    expect((await request(api).patch(`/api/lines/sph/cms/${cid}`).send({})).status).toBe(400);
    expect((await request(api).patch(`/api/lines/sph/cms/${cid}`).send({ handled: 'true' })).status).toBe(400);
    expect((await request(api).patch('/api/lines/sph/cms/cm-nope').send({ handled: true })).status).toBe(404);
    expect((await request(api).patch('/api/lines/nope/cms/cm-nope').send({ handled: true })).status).toBe(404);
  });
});

describe('materials', () => {
  it('GET 返回 seed 的 6 条；?tag= 精确过滤（# 需编码）', async () => {
    const all = await request(api).get('/api/materials');
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(6);
    for (const m of all.body) {
      expect(m).toMatchObject({ source: expect.any(String), body: expect.any(String), summary: expect.any(String) });
      expect(Array.isArray(m.tags)).toBe(true);
      expect(m.fav).toBeGreaterThanOrEqual(1);
      expect(m.fav).toBeLessThanOrEqual(5);
      expect(typeof m.date).toBe('string');
    }

    const filtered = await request(api).get('/api/materials?tag=' + encodeURIComponent('#带货'));
    expect(filtered.status).toBe(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].tags).toContain('#带货');

    const none = await request(api).get('/api/materials?tag=' + encodeURIComponent('#不存在'));
    expect(none.body).toEqual([]);
  });

  it('POST 创建（201）：tags/fav/summary/url/date 有默认值；缺 body / fav 越界 -> 400', async () => {
    const created = await request(api)
      .post('/api/materials')
      .send({ source: 'X · @someone', body: '素材正文', summary: '我的总结', tags: ['#测试'], fav: 5, url: 'https://x.com/1' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      source: 'X · @someone', body: '素材正文', summary: '我的总结', tags: ['#测试'], fav: 5, url: 'https://x.com/1',
    });
    expect(created.body.date).toMatch(/^\d{1,2}\/\d{1,2}$/);

    const defaults = await request(api).post('/api/materials').send({ body: '只有正文' });
    expect(defaults.status).toBe(201);
    expect(defaults.body).toMatchObject({ source: '网页 · 手动', summary: '', tags: [], fav: 3, url: '' });

    expect((await request(api).post('/api/materials').send({})).status).toBe(400);
    expect((await request(api).post('/api/materials').send({ body: 'x', fav: 6 })).status).toBe(400);
    expect((await request(api).post('/api/materials').send({ body: 'x', fav: 0 })).status).toBe(400);
    expect((await request(api).post('/api/materials').send({ body: 'x', tags: '不是数组' })).status).toBe(400);
  });

  it('PATCH 改 fav/summary/tags；未知 id -> 404；fav 越界 -> 400', async () => {
    const created = (await request(api).post('/api/materials').send({ body: '待改' })).body;

    const patched = await request(api).patch(`/api/materials/${created.id}`).send({ fav: 4, summary: '改过的总结' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: created.id, fav: 4, summary: '改过的总结', body: '待改' });

    expect((await request(api).patch('/api/materials/m-nope').send({ fav: 3 })).status).toBe(404);
    expect((await request(api).patch(`/api/materials/${created.id}`).send({ fav: 9 })).status).toBe(400);
  });

  it('DELETE 204；未知 id -> 404', async () => {
    const created = (await request(api).post('/api/materials').send({ body: '待删' })).body;
    expect((await request(api).delete(`/api/materials/${created.id}`)).status).toBe(204);
    expect((await request(api).delete(`/api/materials/${created.id}`)).status).toBe(404);
  });
});

describe('POST /api/materials/quick（bookmarklet 一键收藏）', () => {
  it('服务端补默认字段：source 取域名、body 兜底、tags/#收藏、fav=3、date 当天', async () => {
    const before = (await request(api).get('/api/materials')).body.length;

    const res = await request(api)
      .post('/api/materials/quick')
      .send({ url: 'https://x.com/op7415/status/123', title: '一条很好的推文', body: '' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      source: '书签 · x.com',
      body: '一条很好的推文', // body 空则用 title 兜底
      summary: '',
      tags: ['#收藏'],
      fav: 3,
      url: 'https://x.com/op7415/status/123',
    });
    expect(res.body.date).toMatch(/^\d{1,2}\/\d{1,2}$/);
    expect(typeof res.body.id).toBe('string');

    expect((await request(api).get('/api/materials')).body).toHaveLength(before + 1);
  });

  it('给了 body 用 body；url 非法也能收藏（source 兜底）；全空 -> 400', async () => {
    const res = await request(api)
      .post('/api/materials/quick')
      .send({ url: 'not-a-url', title: 't', body: '选中的正文' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ source: '书签收藏', body: '选中的正文', url: 'not-a-url' });

    expect((await request(api).post('/api/materials/quick').send({})).status).toBe(400);
    expect((await request(api).post('/api/materials/quick').send({ title: '' })).status).toBe(400);
  });
});

describe('GET /bookmarklet.js', () => {
  it('返回 text/javascript，抓 url/title/选中文本并 POST 到 /api/materials/quick', async () => {
    const res = await request(api).get('/bookmarklet.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/javascript');
    expect(res.text).toContain('/api/materials/quick');
    expect(res.text).toContain('location.href');
    expect(res.text).toContain('document.title');
    expect(res.text.toLowerCase()).toContain('getselection'); // 选中文本
  });
});

describe('scratch', () => {
  it('GET 返回 seed 速记；PUT 更新后持久', async () => {
    const first = await request(api).get('/api/scratch');
    expect(first.status).toBe(200);
    expect(typeof first.body.text).toBe('string');
    expect(first.body.text.length).toBeGreaterThan(0);

    const put = await request(api).put('/api/scratch').send({ text: '新的一条速记' });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ text: '新的一条速记' });

    expect((await request(api).get('/api/scratch')).body).toEqual({ text: '新的一条速记' });
  });

  it('PUT 缺 text / 非字符串 -> 400', async () => {
    expect((await request(api).put('/api/scratch').send({})).status).toBe(400);
    expect((await request(api).put('/api/scratch').send({ text: 123 })).status).toBe(400);
  });
});

describe('POST /api/ai/generate', () => {
  it('未配置 key -> 503 {error:"AI 未配置"}（合法入参下）', async () => {
    const res = await request(api)
      .post('/api/ai/generate')
      .send({ line: 'xhs', type: 'script', prompt: '写一条选题图文' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'AI 未配置' });
  });

  it('line/type/prompt 非法 -> 400（在 503 判断之前）', async () => {
    expect((await request(api).post('/api/ai/generate').send({ type: 'script', prompt: 'x' })).status).toBe(400);
    expect((await request(api).post('/api/ai/generate').send({ line: 'douyin', type: 'script', prompt: 'x' })).status).toBe(400);
    expect((await request(api).post('/api/ai/generate').send({ line: 'xhs', type: 'video', prompt: 'x' })).status).toBe(400);
    expect((await request(api).post('/api/ai/generate').send({ line: 'xhs', type: 'script' })).status).toBe(400);
  });

  it('配置后走通：假 fetchImpl 收到拼好的请求，响应解析成 {text}', async () => {
    const calls = [];
    const aiApp = createApp(
      new Store(path.join(TMP_ROOT, `ai-${randomUUID().slice(0, 8)}.json`)),
      createAiClient({
        baseUrl: 'https://fake.test/v4/',
        apiKey: 'sk-test',
        model: 'test-model',
        fetchImpl: async (url, opts) => {
          calls.push({ url, opts });
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: 'AI 草稿内容' } }] }),
          };
        },
      })
    );

    const res = await request(aiApp)
      .post('/api/ai/generate')
      .send({ line: 'xhs', type: 'script', prompt: '写一条「上班族副业」图文' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'AI 草稿内容' });

    // 请求体组装：URL 拼接（尾斜杠不重复）、鉴权头、messages 结构
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://fake.test/v4/chat/completions');
    expect(calls[0].opts.method).toBe('POST');
    expect(calls[0].opts.headers.Authorization).toBe('Bearer sk-test');
    expect(calls[0].opts.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.model).toBe('test-model');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('小红书');
    expect(body.messages[1]).toEqual({ role: 'user', content: '写一条「上班族副业」图文' });
  });

  it('上游报错时透传为 502 错误信息', async () => {
    const aiApp = createApp(
      new Store(path.join(TMP_ROOT, `ai-err-${randomUUID().slice(0, 8)}.json`)),
      createAiClient({
        baseUrl: 'https://fake.test/v4/',
        apiKey: 'sk-test',
        model: 'test-model',
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'rate limited' } }),
        }),
      })
    );
    const res = await request(aiApp).post('/api/ai/generate').send({ line: 'xy', type: 'reply', prompt: '回复这条咨询' });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('429');
    expect(res.body.error).toContain('rate limited');
  });
});

describe('兜底行为', () => {
  it('未知 /api 路由 -> 404 JSON', async () => {
    const res = await request(api).get('/api/no-such-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('请求体是非法 JSON -> 400 JSON', async () => {
    const res = await request(api)
      .post('/api/todos')
      .set('Content-Type', 'application/json')
      .send('{"text": "没闭合');
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});
