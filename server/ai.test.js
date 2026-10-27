// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createAiClient,
  buildSystemPrompt,
  loadAiConfig,
  DEFAULT_CONFIG_FILE,
  LINE_PERSONAS,
} from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = path.resolve(__dirname, '..', '.tmp', 'ai');

function writeTmpConfig(obj) {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const file = path.join(TMP_ROOT, `config-${randomUUID().slice(0, 8)}.json`);
  fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
  return file;
}

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function okFetch(content = '生成的草稿') {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

describe('createAiClient · 请求体组装与响应解析', () => {
  it('generate 拼好 endpoint/头/请求体，并解析 choices[0].message.content 返回 {text}', async () => {
    const calls = [];
    const client = createAiClient({
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/', // 尾斜杠：拼接不能出现 //
      apiKey: 'sk-abc',
      model: 'glm-4-flash',
      fetchImpl: async (url, opts) => {
        calls.push({ url, opts });
        return okFetch('【小红书图文 · 草稿】……')();
      },
    });

    const out = await client.generate('xhs', 'script', '写一条「上班族副业」图文');
    expect(out).toEqual({ text: '【小红书图文 · 草稿】……' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');
    expect(calls[0].opts.method).toBe('POST');
    expect(calls[0].opts.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-abc',
    });

    const body = JSON.parse(calls[0].opts.body);
    expect(body.model).toBe('glm-4-flash');
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('小红书');
    expect(body.messages[1]).toEqual({ role: 'user', content: '写一条「上班族副业」图文' });
  });

  it('三条业务线的系统提示词各成风格，type 改变任务指令', () => {
    for (const [line, word] of [['xhs', '小红书'], ['xy', '闲鱼'], ['sph', '视频号']]) {
      expect(LINE_PERSONAS[line]).toContain(word);
      expect(buildSystemPrompt(line, 'script')).toContain(word);
    }
    expect(buildSystemPrompt('xhs', 'script')).not.toBe(buildSystemPrompt('xhs', 'reply'));
    expect(buildSystemPrompt('xhs', 'reply')).toContain('回复');
    expect(() => buildSystemPrompt('douyin', 'script')).toThrow(/业务线/);
    expect(() => buildSystemPrompt('xhs', 'video')).toThrow(/生成类型/);
  });

  it('上游返回非 2xx -> 抛错并带上状态码与上游信息', async () => {
    const client = createAiClient({
      baseUrl: 'https://x/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Insufficient balance' } }),
      }),
    });
    await expect(client.generate('xy', 'copy', '写详情页')).rejects.toThrow(/429/);
    await expect(client.generate('xy', 'copy', '写详情页')).rejects.toThrow(/Insufficient balance/);
  });

  it('上游响应缺 choices/message.content -> 抛格式错误', async () => {
    const malformed = createAiClient({
      baseUrl: 'https://x/v1', apiKey: 'k', model: 'm',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }),
    });
    await expect(malformed.generate('sph', 'reply', '回复评论')).rejects.toThrow(/格式/);

    const empty = createAiClient({
      baseUrl: 'https://x/v1', apiKey: 'k', model: 'm',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '   ' } }] }) }),
    });
    await expect(empty.generate('sph', 'reply', '回复评论')).rejects.toThrow(/格式/);
  });

  it('未配置时 configured=false，generate 直接拒绝', async () => {
    const client = createAiClient({});
    expect(client.configured).toBe(false);
    await expect(client.generate('xhs', 'script', 'x')).rejects.toThrow('AI 未配置');
  });

  it('fetchImpl 缺省用全局 fetch（临时替换全局 fetch 验证确实走它）', async () => {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    };
    try {
      const client = createAiClient({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
      const out = await client.generate('sph', 'copy', '写文案');
      expect(out).toEqual({ text: 'ok' });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('https://x/v1/chat/completions');
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('loadAiConfig · 配置优先级 环境变量 > config.json > 未配置', () => {
  it('仅 config.json：读文件并 configured', () => {
    const file = writeTmpConfig({
      AI_BASE_URL: 'https://file.example/v4/',
      AI_API_KEY: 'file-key',
      AI_MODEL: 'file-model',
    });
    const cfg = loadAiConfig({ env: {}, configFile: file });
    expect(cfg).toMatchObject({
      baseUrl: 'https://file.example/v4/',
      apiKey: 'file-key',
      model: 'file-model',
    });
    expect(cfg.configured).toBe(true);
  });

  it('环境变量逐项覆盖 config.json（env 优先）', () => {
    const file = writeTmpConfig({
      AI_BASE_URL: 'https://file.example/v4/',
      AI_API_KEY: 'file-key',
      AI_MODEL: 'file-model',
    });
    const cfg = loadAiConfig({ env: { AI_API_KEY: 'env-key' }, configFile: file });
    expect(cfg.apiKey).toBe('env-key');
    expect(cfg.baseUrl).toBe('https://file.example/v4/'); // env 没给的部分回落文件
    expect(cfg.model).toBe('file-model');
    expect(cfg.configured).toBe(true);

    const all = loadAiConfig({
      env: { AI_BASE_URL: 'https://env.example/v4/', AI_API_KEY: 'env-key', AI_MODEL: 'env-model' },
      configFile: file,
    });
    expect(all).toMatchObject({ baseUrl: 'https://env.example/v4/', apiKey: 'env-key', model: 'env-model' });
  });

  it('都没有 -> 未配置；config.json 损坏按未配置文件处理', () => {
    const none = loadAiConfig({ env: {}, configFile: path.join(TMP_ROOT, 'no-such-file.json') });
    expect(none).toMatchObject({ baseUrl: '', apiKey: '', model: '' });
    expect(none.configured).toBe(false);

    const broken = path.join(TMP_ROOT, `broken-${randomUUID().slice(0, 8)}.json`);
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(broken, '{oops', 'utf8');
    const fromBroken = loadAiConfig({ env: {}, configFile: broken });
    expect(fromBroken.configured).toBe(false);
  });

  it('默认调用（真实 env + server/config.json）不抛错且给出布尔 configured', () => {
    const cfg = loadAiConfig();
    expect(typeof cfg.baseUrl).toBe('string');
    expect(typeof cfg.configured).toBe('boolean');
    expect(DEFAULT_CONFIG_FILE.endsWith(path.join('server', 'config.json'))).toBe(true);
  });
});
