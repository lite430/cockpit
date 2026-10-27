# 个人运营驾驶舱 · 接口契约

前后端工程师均以本文件为准。后端空壳已提供 `GET /api/health`（`server/index.js`），其余路由由后端工程师按本契约补齐。

## 契约原文

```
GET /api/health -> {ok:true}
GET /api/todos -> Todo[]；POST /api/todos {text,due,tag} -> Todo；PATCH /api/todos/:id（部分字段，含 done）-> Todo；DELETE /api/todos/:id
Todo 字段：id,text,due,done,tag（tag 取 xhs|xy|sph）
GET /api/schedule -> Item[]；POST {time,title,note}；DELETE /api/schedule/:id。Item 字段：id,time,title,note
GET /api/lines -> Line[]（三条：xhs=小红书AI微课、xy=闲鱼AI微课、sph=视频号带货）。Line 字段：id,name,sub,stats(对象，键为指标名值为[valeur,deltaPct]),spark(数字数组),pubs[],cms[]
pub 字段：id,when,tt,st（待发/已发/待办/待剪/选题/完成等自由文本）；POST /api/lines/:id/pubs {when,tt,st}；PATCH /api/lines/:lid/pubs/:pid
cm（评论）字段：id,who,txt,handled(bool)；PATCH /api/lines/:lid/cms/:cid {handled}
GET /api/materials（可选 ?tag= 过滤）-> Mat[]；POST /api/materials {source,body,summary,tags[],fav?,url?}；PATCH /api/materials/:id；DELETE /api/materials/:id。Mat 字段：id,source,body,summary,tags[],fav(1-5),date
POST /api/materials/quick {url,title,body}（bookmarklet 一键收藏入口，服务端补默认字段）-> Mat
GET /bookmarklet.js -> text/javascript，一段可直接拖进书签栏的 JS：抓当前页 location.href/title/选中文本，POST 到本源 /api/materials/quick
GET /api/scratch -> {text}；PUT /api/scratch {text}
POST /api/ai/generate {line,type,prompt} -> {text}；未配置 key 时返回 503 {error:"AI 未配置"}。line 取 xhs|xy|sph，type 取 script|copy|reply
环境变量覆盖：PORT（默认 5175）、DATA_FILE（默认 data/db.json）、AI_BASE_URL、AI_API_KEY、AI_MODEL；AI 也可用 server/config.json 配置（gitignore），示例写进 config.example.json，默认指向智谱 https://open.bigmodel.cn/api/paas/v4/
```

> 注：stats 值 `[valeur,deltaPct]` 疑为 `[value,deltaPct]`（当前值 + 环比百分比）的法文笔误，实现按 `[当前值, 环比%]` 处理即可。

## 测试环境约定（vitest）

- vitest 全局 `environment: 'jsdom'`（见 `vite.config.ts` 的 `test` 字段），`include` 覆盖 `server/**/*.test.js` 与 `src/**/*.spec.ts`。
- **服务端测试文件**（走 supertest、碰 fs/Express 的）**必须在文件第一行加注释切换到 node 环境**，否则会跑在 jsdom 里：

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

describe('GET /api/health', () => {
  it('returns {ok:true}', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- 前端组件测试（`src/**/*.spec.ts`）无需注释，默认 jsdom。
