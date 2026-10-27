# 个人运营驾驶舱（cockpit）

单人自媒体运营的一站式工作台：把「小红书 AI 微课、闲鱼虚拟商品、视频号带货」三条业务线的待办、日程、排期、评论、素材和 AI 写稿收进一个本地网页。前端 Vue 3 + Vite，后端 Node.js（Express）+ 单 JSON 文件存储，零外部依赖服务，`npm install` 即用，数据完全在自己手里。

## 功能清单

- **待办**：按业务线打标（xhs 小红书 / xy 闲鱼 / sph 视频号），可勾选完成、改期、删除。
- **日程**：当天时间轴，新增/删除排期项。
- **速记**：一块自动保存的草稿板（输入防抖 600ms 落盘），随手记选题。
- **运营看板**：三条业务线的核心指标（粉丝/曝光/成交 + 环比）、14 点走势迷你图、发布排期（待发/待剪/已发状态流转）、待回评论（一键标记已处理）。
- **AI 草稿助手**：选业务线 × 生成类型（微课脚本 / 带货文案 / 评论回复），接智谱等 OpenAI 兼容接口，打字机效果出稿；待回评论点「回」会自动预填上下文。
- **素材库**：收藏推文/网页摘录，带标签过滤、星级、摘要；支持手动录入。
- **一键收藏书签（bookmarklet）**：一段由后端下发的收藏脚本，装进浏览器书签栏后在页面上点击即可把 URL/标题/选中文字收进素材库（安装方法与当前限制见下方「一键收藏书签」一节）。

## 快速开始

**环境要求**：Node.js **22.12 或更高**（22.12+ / 24+ / 26+ 都行）。这是依赖的硬性交集：vitest 5 要求 `^22.12.0 || ^24.0.0 || >=26.0.0`，vite 8 与 @vitejs/plugin-vue 6 要求 `^20.19.0 || >=22.12.0`，Express 5 要求 `>=18`。Node 16/18/20 装依赖或跑测试会报引擎不兼容。查看本机版本：`node --version`。

```bash
npm install
npm run dev
```

`npm run dev` 会同时起两个服务（concurrently）：

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| 前端 Vite | http://localhost:5173 | 浏览器开这个；`/api` 与 `/bookmarklet.js` 自动反向代理到 5175 |
| 后端 API | http://localhost:5175 | `node server/index.js`，Express |

改了代码两边都会热更新。接口契约见 [docs/api-contract.md](docs/api-contract.md)。

**改后端端口要同步改代理**：后端端口可用环境变量 `PORT` 覆盖（默认 5175），但前端 Vite 的代理目标写死在 `vite.config.ts` 的 `server.proxy` 里（`'/api'` 与 `'/bookmarklet.js'` 两处均指向 `http://localhost:5175`）。改了 `PORT` 后必须把这两处一起改成新端口，否则页面所有请求仍发往旧端口、报连接失败。

## 日常自用怎么长期跑

当前版本的推荐跑法就是开发模式 `npm run dev`——开着（终端窗口最小化即可），关掉终端或 Ctrl+C 即停。数据实时落盘在 `data/db.json`，中途关掉不丢数据。

- **想后台常驻**：用 pm2 守护（`npm i -g pm2` 后执行 `pm2 start npm --name cockpit -- run dev`，`pm2 logs cockpit` 看日志，`pm2 delete cockpit` 停掉）。
- **想开机自启**：Windows 用「任务计划程序」建一个登录时运行 `npm run dev` 的任务（起始于填本目录）；macOS/Linux 用 pm2 的 `pm2 save` + `pm2 startup`。
- **关于 `dist/` 构建产物**：`npm run build` 会产出 `dist/`，但**后端目前没有托管静态文件的逻辑**（`server/index.js` 只有 API 路由），所以「单进程生产部署：后端直接 serve dist + API」目前还不支持，属于后续待补项。若想拿 dist 配 Nginx 等静态服务器自用，需要自己把 `/api` 与 `/bookmarklet.js` 反代到 5175 后端，比较绕，不建议——现阶段请直接用 dev 模式。

## AI 配置（可选，不配也能用）

AI 功能走 OpenAI 兼容的 chat/completions 接口，默认示例指向智谱（bigmodel）。两种配置方式，**环境变量优先于配置文件**。

**方式一：配置文件**（推荐，已 gitignore 不会误提交）

复制模板（按你的终端选一条）：

```bash
# macOS / Linux
cp server/config.example.json server/config.json
```

```bat
:: Windows cmd
copy server\config.example.json server\config.json
```

```powershell
# Windows PowerShell
Copy-Item server/config.example.json server/config.json
```

然后编辑 `server/config.json`，填入 AI_API_KEY：

```json
{
  "AI_BASE_URL": "https://open.bigmodel.cn/api/paas/v4/",
  "AI_API_KEY": "你的 key",
  "AI_MODEL": "glm-4-flash"
}
```

**方式二：环境变量**（按你的终端选写法）

```bash
# macOS / Linux（bash/zsh：变量只对这一条命令生效）
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/ AI_API_KEY=xxx AI_MODEL=glm-4-flash npm run dev
```

```bat
:: Windows cmd（set 对当前 cmd 窗口持续生效，设完再起）
set AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
set AI_API_KEY=xxx
set AI_MODEL=glm-4-flash
npm run dev
```

```powershell
# Windows PowerShell（$env: 对当前窗口持续生效）
$env:AI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/"
$env:AI_API_KEY = "xxx"
$env:AI_MODEL = "glm-4-flash"
npm run dev
```

- **key 从哪拿**：智谱开放平台 https://open.bigmodel.cn/ 注册后在「API Keys」页面创建。
- **想换模型**：只改 `AI_MODEL` 这一项即可（config.json 第三项或对应环境变量），比如 `glm-4-plus`。可用模型名与命名规则在智谱开放平台的「模型广场」/文档里查，照页面上的模型 ID 原样填（区分大小写）。换其他 OpenAI 兼容服务（OpenRouter、DeepSeek 等）同理，改 `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` 三项。
- baseUrl 记得带结尾 `/`（代码会拼 `/chat/completions`）。
- 三项（baseUrl / apiKey / model）缺任何一项都视为「未配置」，此时 AI 面板调用 `/api/ai/generate` 会返回 503 并在前端给出配置指引，其余功能不受影响。
- **改完配置必须重启才生效**：AI 配置在后端进程启动时读一次（`server/index.js` 加载时创建 AI 客户端），不是每个请求都读。填好 `server/config.json` 后要先 Ctrl+C 停掉 `npm run dev` 再重新启动；如果一直对着 503「AI 未配置」排查，先确认是不是改完没重启。

## 一键收藏书签（bookmarklet）

后端在 http://localhost:5175/bookmarklet.js 下发收藏脚本（dev 模式下 5173 也能访问，走 Vite 代理）。**安装方法**（直接把这个 URL 拖进书签栏得到的只是普通书签，不会执行，正确做法是）：

1. 浏览器打开 `http://localhost:5175/bookmarklet.js`，全选复制页面上的脚本全文；
2. 打开书签管理器，新建书签：名称随意（如「收进驾驶舱」），**URL 栏先填 `javascript:` 再紧贴着粘贴脚本全文**，保存；
3. 以后在任意页面上选中一段文字（可不选）后点击这个书签即可收藏。

**点击后的预期行为**：弹窗提示「已收进素材库：<标题或 URL>」，素材库新增一条记录（来源显示「书签 · 域名」、标签 #收藏）；失败则弹「收藏失败：<原因>」。

**当前限制（重要）**：脚本里提交地址是相对路径 `fetch('/api/materials/quick')`，请求会发到**你当前所在页面**的域名。所以现在它只在 `localhost:5173` / `localhost:5175` 自己的页面上点击才会真正入库；在任意外部网站上点击会请求到那个网站而失败。想在任意网页使用：按上面第 2 步粘贴后，把脚本里的 `fetch('/api/materials/quick'` 手动改成 `fetch('http://localhost:5175/api/materials/quick'`（注意：在 https 页面上向 http://localhost 发请求，部分浏览器会按混合内容策略拦截，属已知限制）。

## 数据在哪、怎么搬家

所有数据（待办/日程/看板/素材/速记）都在**一个文件**里：`data/db.json`（相对 cockpit 根目录）。

**首次启动会看到什么**：第一次 `npm run dev` 时 `data/db.json` 不存在，后端会自动生成一份**预置演示数据**（4 条待办、5 条日程、三条业务线的示例指标/排期/评论、6 条素材、1 条速记），打开不是空白页，方便先熟悉各面板。想清空从零开始：**停掉服务**，编辑 `data/db.json`，把 `todos`、`schedule`、`materials` 改成 `[]`，`lines` 各条里的 `pubs`、`cms` 清空，`scratch.text` 置空，保存后重启。注意：直接删除 `db.json` 再重启会重新载入一份演示数据，得到的不是空白库。

- 换电脑：把整个 `cockpit/` 目录拷走即可（`node_modules/` 不拷也行，新机器 `npm install` 重装）；想搬得更干净就只拷 `data/db.json` 放到新目录同名位置。
- 备份：定期复制 `data/db.json` 即可；写盘是原子写（先写临时文件再 rename），不会出现半个 JSON。
- 想换存储位置：起服务时设环境变量 `DATA_FILE=路径`（相对路径锚定在 cockpit 根目录）。Windows 下同样用 `set DATA_FILE=...`（cmd）或 `$env:DATA_FILE = "..."`（PowerShell）后再 `npm run dev`。
- 注意 `data/` 在 .gitignore 里，不会误提交到仓库。

## 测试与验证

```bash
npm run verify
```

一条命令串起三层检查，全绿才算过：

1. `npm run test` —— vitest 单元/组件测试：`server/*.test.js`（store 存储层、AI 客户端、supertest 接口测试）+ `src/**/*.spec.ts`（前端组件测试，jsdom 环境）。
2. `npm run build` —— vite 生产构建（TypeScript + Vue 编译打包到 `dist/`）。
3. `node scripts/e2e.mjs` —— 端到端冒烟：真实 spawn 一个 server 子进程（独立端口 5199、临时数据文件 `.tmp/e2e-数据.json`、AI 置空），轮询 `/api/health` 就绪后依次断言 todos 增改删闭环、一键收藏默认字段、bookmarklet 的 MIME、AI 未配置返回 503、未知路由 404；结束自动杀进程、清临时文件，失败给逐条断言信息并 exit 1。

单独跑某一层：`npm run test` / `npm run build` / `node scripts/e2e.mjs`。

## 目录结构

```
cockpit/
├── server/               # 后端（Node.js + Express）
│   ├── index.js          #   路由与中间件；直接 node 启动时监听 5175（PORT 可覆盖）
│   ├── store.js          #   JSON 文件存储层（原子写、首次无文件时 seed 演示数据）
│   ├── ai.js             #   OpenAI 兼容客户端 + 三条业务线的提示词；配置读取
│   ├── config.example.json  # AI 配置模板（复制为 server/config.json 使用）
│   └── *.test.js         #   服务端测试（vitest node 环境 + supertest）
├── src/                  # 前端（Vue 3 + TypeScript）
│   ├── App.vue           #   根组件：顶栏 + 总览/素材库两视图 + 状态栏
│   ├── api.ts            #   统一 fetch 封装（非 2xx 抛 ApiError）
│   ├── store.ts          #   前端共享状态
│   ├── components/       #   TodoPanel / SchedPanel / ScratchPanel / OpsBoard /
│   │                     #   AiAssistant / LibraryView / TopBar / StatusBar 等
│   └── *.spec.ts         #   组件测试（jsdom）
├── scripts/
│   └── e2e.mjs           # 端到端冒烟脚本（自起自灭子进程）
├── data/db.json          # 全部业务数据（gitignore）
├── docs/api-contract.md  # 前后端接口契约
├── dist/                 # 构建产物（gitignore；当前后端未托管，见「日常自用」）
└── vite.config.ts        # 前端端口/代理 + vitest 配置
```

## 二期路线

1. **安卓自动化**：AutoJS6 脚本跑在真机上，自动采集小红书/闲鱼的通知与私信、辅助发布图文，结果回传驾驶舱待办。
2. **推特时间线**：把 X/Twitter 关注流接成素材源，定时拉取、AI 预摘要后进素材库，替代手动刷推收藏。
3. **飞书同步**：待办/日程双向同步飞书任务与日历，运营周报一键推送飞书群。
4. **视频流水线**：视频号选题→脚本→待剪→已发的看板化流转，接剪辑 SOP 与素材归档。
