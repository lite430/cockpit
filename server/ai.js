// OpenAI 兼容聊天补全客户端（默认指向智谱 open.bigmodel.cn 的 OpenAI 兼容接口）。
// 工厂函数收 { baseUrl, apiKey, model, fetchImpl }；fetchImpl 缺省用全局 fetch，测试可注入假实现。
// 配置优先级：环境变量（AI_BASE_URL/AI_API_KEY/AI_MODEL） > server/config.json > 未配置。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_FILE = path.join(__dirname, 'config.json');

// 三条业务线的系统提示词风格
export const LINE_PERSONAS = {
  xhs: '你是小红书图文微课的资深操盘手，深谙小红书内容生态：标题要带钩子、正文口语化分段、善用 emoji 和小标题、结尾埋互动评论与私域转化钩子，整体真诚种草、不油腻不夸大。',
  xy: '你是闲鱼 AI 微课（虚拟商品）的运营专家，擅长写闲鱼商品详情页与买家咨询回复：直击买家痛点、讲清交付方式（拍下自动发货、永久有效）、给价格锚点与凑单技巧，语气亲切实惠、促成下单又不违规。',
  sph: '你是视频号带货的资深编导，擅长带货短视频口播文案与评论区回复：黄金 3 秒开场抓人、卖点分段节奏紧凑、结尾促单并给明确的橱窗购买路径，回复评论热情具体、避免绝对化用词。',
};

// 三种生成类型的任务指令
export const TYPE_TASKS = {
  script: '本次任务：写一份结构完整的脚本/内容稿，包含标题、开头钩子、分点正文、结尾 CTA，以及标签或关键词建议。',
  copy: '本次任务：写一份短转化文案（口播或详情页），包含开场、卖点、价格锚点与促单话术；注意平台合规，不使用「最」「第一」等绝对化用词。',
  reply: '本次任务：针对用户给出的评论/咨询逐条写回复，每条先给可直接发送的回复正文，再用括号注明一句回复策略。',
};

export function buildSystemPrompt(line, type) {
  const persona = LINE_PERSONAS[line];
  if (!persona) throw new Error(`未知业务线：${line}（可选 xhs|xy|sph）`);
  const task = TYPE_TASKS[type];
  if (!task) throw new Error(`未知生成类型：${type}（可选 script|copy|reply）`);
  return `${persona}\n${task}\n直接输出可用的成稿，不要解释你的思路。`;
}

/**
 * 读取 AI 配置：env（可注入，便于测试）逐项覆盖 config.json，均无则视为未配置。
 * @returns {{baseUrl:string, apiKey:string, model:string, configured:boolean}}
 */
export function loadAiConfig({ env = process.env, configFile = DEFAULT_CONFIG_FILE } = {}) {
  let fileCfg = {};
  try {
    if (fs.existsSync(configFile)) fileCfg = JSON.parse(fs.readFileSync(configFile, 'utf8')) || {};
  } catch (_err) {
    fileCfg = {}; // config.json 坏了就当没配置文件，交给 env
  }
  const pick = (envKey, fileKey) => {
    const fromEnv = typeof env?.[envKey] === 'string' ? env[envKey].trim() : '';
    const fromFile = typeof fileCfg?.[fileKey] === 'string' ? fileCfg[fileKey].trim() : '';
    return fromEnv || fromFile;
  };
  const baseUrl = pick('AI_BASE_URL', 'AI_BASE_URL');
  const apiKey = pick('AI_API_KEY', 'AI_API_KEY');
  const model = pick('AI_MODEL', 'AI_MODEL');
  return { baseUrl, apiKey, model, configured: Boolean(baseUrl && apiKey && model) };
}

/**
 * @param {{baseUrl?:string, apiKey?:string, model?:string, fetchImpl?:Function}} opts
 */
export function createAiClient({ baseUrl = '', apiKey = '', model = '', fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  const configured = Boolean(baseUrl && apiKey && model);
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';

  return {
    configured,
    config: { baseUrl, apiKey, model },
    async generate(line, type, prompt) {
      if (!configured) throw new Error('AI 未配置');
      let res;
      try {
        res = await doFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            // 营销文案不需要深度推理；glm-5.3 默认开思考会多等约 100 秒
            thinking: { type: 'disabled' },
            messages: [
              { role: 'system', content: buildSystemPrompt(line, type) },
              { role: 'user', content: prompt },
            ],
          }),
        });
      } catch (err) {
        const e = new Error(`AI 请求失败：${err?.message || err}`);
        e.status = 502;
        throw e;
      }

      let data = null;
      try {
        data = await res.json();
      } catch (_err) {
        data = null;
      }

      if (!res.ok) {
        const upstream =
          data?.error?.message || (data ? JSON.stringify(data).slice(0, 200) : '') || '无响应体';
        const e = new Error(`AI 上游返回 HTTP ${res.status}：${upstream}`);
        e.status = 502;
        throw e;
      }

      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        const e = new Error('AI 上游返回格式异常：缺少 choices[0].message.content');
        e.status = 502;
        throw e;
      }
      return { text };
    },
  };
}
