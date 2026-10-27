// JSON 文件存储层：单文件多集合，启动时 load，写盘走原子写（先写同目录临时文件再 rename）。
// 首次无数据文件时用 seed 数据初始化（风格参考 cockpit-demo/index.html 的假数据）。
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const clone = (v) => JSON.parse(JSON.stringify(v));

// 稳定的随机短 id：落盘后不变
export function newId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

// 日期风格与 demo 一致：M/D（如 9/28）
export function today() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ---------------- seed（内容取自 cockpit-demo/index.html 的演示假数据） ----------------
export function seedData() {
  return {
    todos: [
      { id: 't1', text: '回复小红书评论区 12 条待回', due: '今天', done: false, tag: 'xhs' },
      { id: 't2', text: '闲鱼上架《AI 剪映速成》第 3 节', due: '今天', done: false, tag: 'xy' },
      { id: 't3', text: '视频号：本周带货选品清单过一遍', due: '今天', done: false, tag: 'sph' },
      { id: 't4', text: '给微课学员群发本周作业提醒', due: '17:00', done: true, tag: 'xhs' },
    ],
    schedule: [
      { id: 's1', time: '09:30', title: '视频号数据周复盘', note: '和上周对比完播率' },
      { id: 's2', time: '11:00', title: '微课直播准备会', note: '第 5 讲 · 拍摄清单核对' },
      { id: 's3', time: '14:00', title: '推特素材回顾 15 分钟', note: '素材库里 #带货 标签' },
      { id: 's4', time: '19:00', title: '小红书图文发布', note: '《AI 副业微课 · 选题篇》' },
      { id: 's5', time: '21:30', title: '闲鱼订单发货 + 差评跟进', note: '' },
    ],
    lines: [
      {
        id: 'xhs',
        name: '小红书',
        sub: 'AI 微课 · 图文+直播',
        stats: { 粉丝: [2341, 86], '近7日曝光': [48200, 12.4], 本月成交: [23, 4] },
        spark: [12, 18, 15, 24, 22, 30, 28, 36, 33, 42, 39, 48, 46, 55],
        pubs: [
          { id: 'pub-xhs-1', when: '今天 19:00', tt: '《AI 副业微课 · 选题篇》图文', st: '待发' },
          { id: 'pub-xhs-2', when: '周四 20:00', tt: '直播：学员作品连麦点评', st: '待发' },
          { id: 'pub-xhs-3', when: '昨天', tt: '《用 GLM 写儿童绘本》图文', st: '已发' },
        ],
        cms: [
          { id: 'cm-xhs-1', who: '@卷心菜不菜 · 昨天', txt: '第 2 讲的资料包能发我一份吗？想跟着做', handled: false },
          { id: 'cm-xhs-2', who: '@momo · 2天前', txt: '上班族真的来得及做副业吗，求真实反馈', handled: false },
          { id: 'cm-xhs-3', who: '@老张头 · 3天前', txt: '已下单，蹲一个进阶课', handled: false },
        ],
      },
      {
        id: 'xy',
        name: '闲鱼',
        sub: 'AI 微课 · 虚拟商品',
        stats: { 在售宝贝: [8, 1], '近7日咨询': [156, 22], 本月成交: [19, 5] },
        spark: [5, 7, 6, 9, 11, 10, 14, 13, 16, 18, 17, 21, 20, 24],
        pubs: [
          { id: 'pub-xy-1', when: '今天', tt: '上架《AI 剪映速成》第 3 节', st: '待办' },
          { id: 'pub-xy-2', when: '周三', tt: '5 个老宝贝降价 10% 促活', st: '待办' },
          { id: 'pub-xy-3', when: '昨天', tt: '第 2 节上架 + 自动回复话术更新', st: '完成' },
        ],
        cms: [
          { id: 'cm-xy-1', who: '买家 · 今早', txt: '能便宜点吗？连带 4 讲一起', handled: false },
          { id: 'cm-xy-2', who: '买家 · 昨天', txt: '发货后在哪里看课程？', handled: false },
        ],
      },
      {
        id: 'sph',
        name: '视频号',
        sub: '带货短视频',
        stats: { 粉丝: [5120, 143], '近7日播放': [96400, 8.1], 橱窗成交: [41, 6] },
        spark: [20, 26, 24, 31, 35, 33, 40, 44, 41, 50, 48, 57, 54, 62],
        pubs: [
          { id: 'pub-sph-1', when: '今天 12:00', tt: '带货口播：桌面收纳架（已拍好）', st: '待剪' },
          { id: 'pub-sph-2', when: '周五', tt: '选题：3 个 AI 学习神器', st: '选题' },
          { id: 'pub-sph-3', when: '昨天', tt: '口播：办公颈椎枕（数据最好的一条）', st: '已发' },
        ],
        cms: [
          { id: 'cm-sph-1', who: '微信用户 · 昨天', txt: '求链接，颈椎枕还有货吗', handled: false },
          { id: 'cm-sph-2', who: '微信用户 · 2天前', txt: '视频同款 BGM 叫什么', handled: false },
          { id: 'cm-sph-3', who: '微信用户 · 3天前', txt: '已拍，讲得很实在', handled: false },
        ],
      },
    ],
    materials: [
      {
        id: 'm1', source: 'X · @op7415', fav: 5, date: '9/28', tags: ['#AI工作流', '#选题'],
        body: 'MCP 工作流实战：把本地文件系统接给大模型当工具，个人知识库的另一种做法……',
        summary: '可转化为微课案例：讲 MCP 时用「让 AI 直接读你的课程素材文件夹」做演示，比讲概念抓人。',
      },
      {
        id: 'm2', source: 'X · @sundyme', fav: 4, date: '9/27', tags: ['#带货', '#脚本'],
        body: '带货视频的黄金 3 秒：不要介绍产品，先制造一个「认领瞬间」——观众觉得说的是自己……',
        summary: '直接可用于视频号：颈椎枕那条可以改成「你是不是也这样歪头看手机」开场，A/B 测试对比完播率。',
      },
      {
        id: 'm3', source: 'X · @dotey', fav: 3, date: '9/26', tags: ['#AI工具', '#课程素材'],
        body: 'GLM 新版本的长上下文测评：100K 文档问答的召回率数据，附测试集……',
        summary: '课程素材：第 5 讲「怎么让 AI 读懂你的一整个文件夹」可以引用这组对比数据。',
      },
      {
        id: 'm4', source: '网页 · 收藏', fav: 4, date: '9/25', tags: ['#闲鱼', '#运维'],
        body: '闲鱼虚拟商品防封指南：标题敏感词、发布时间段、自动回复话术的三条红线……',
        summary: '风险提醒要进 SOP：把敏感词清单贴进每条宝贝上架前的检查项。',
      },
      {
        id: 'm5', source: 'X · @barretlee', fav: 3, date: '9/24', tags: ['#选题', '#小红书'],
        body: '普通人做知识付费的正确姿势：先卖再录，用 9.9 元验证选题再投入制作……',
        summary: '和我的路线一致，可以截图做小红书图文：「为什么我的课先上架再录制」。',
      },
      {
        id: 'm6', source: '网页 · 粘贴', fav: 2, date: '9/22', tags: ['#视频号', '#合规'],
        body: '视频号 2026 带货新规：虚拟商品类目调整，橱窗分佣比例变化……',
        summary: '合规事项：核对在售橱窗类目是否受影响，周五前过一遍。',
      },
    ],
    scratch: { text: '微课选题——用 GLM 给闲鱼客服写自动回复' },
  };
}

export class Store {
  /**
   * @param {string} file 数据文件绝对路径（如 cockpit/data/db.json）
   */
  constructor(file) {
    this.file = file;
    this.data = null; // 未 load 前不碰磁盘
  }

  /** 启动时读；文件不存在则用 seed 初始化并落盘。 */
  load() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        this.data = seedData();
        this.save();
        return this.data;
      }
      throw err;
    }
    this.data = JSON.parse(raw); // 文件损坏（如半文件）直接抛错，不静默丢数据
    return this.data;
  }

  /** 所有读写在未 load 时兜底触发一次 load。 */
  ensure() {
    return this.data ?? this.load();
  }

  /** 原子写：同目录临时文件写完再 rename 顶替，读方任何时刻看到的都是完整 JSON。 */
  save() {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(this.file)}.${randomUUID().replace(/-/g, '').slice(0, 8)}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
    try {
      fs.renameSync(tmp, this.file);
    } catch (_err) {
      // 极少数平台 rename 顶替失败（目标被短暂占用）：退而求其次删目标再改名
      try { fs.unlinkSync(this.file); } catch { /* ignore */ }
      fs.renameSync(tmp, this.file);
    }
    return this.data;
  }

  // ---------------- todos ----------------
  getTodos() {
    return clone(this.ensure().todos);
  }
  addTodo({ text, due = '', tag }) {
    const todo = { id: newId('t'), text, due, done: false, tag };
    this.ensure().todos.push(todo);
    this.save();
    return clone(todo);
  }
  updateTodo(id, patch = {}) {
    const t = this.ensure().todos.find((x) => x.id === id);
    if (!t) return null;
    if (patch.text !== undefined) t.text = patch.text;
    if (patch.due !== undefined) t.due = patch.due;
    if (patch.tag !== undefined) t.tag = patch.tag;
    if (patch.done !== undefined) t.done = patch.done;
    this.save();
    return clone(t);
  }
  deleteTodo(id) {
    const list = this.ensure().todos;
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return false;
    list.splice(i, 1);
    this.save();
    return true;
  }

  // ---------------- schedule ----------------
  getSchedule() {
    return clone(this.ensure().schedule);
  }
  addSchedule({ time, title, note = '' }) {
    const item = { id: newId('s'), time, title, note };
    this.ensure().schedule.push(item);
    this.save();
    return clone(item);
  }
  deleteSchedule(id) {
    const list = this.ensure().schedule;
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return false;
    list.splice(i, 1);
    this.save();
    return true;
  }

  // ---------------- lines（含 pubs / cms） ----------------
  getLines() {
    return clone(this.ensure().lines);
  }
  getLine(id) {
    return this.ensure().lines.find((l) => l.id === id) || null;
  }
  addPub(lineId, { when, tt, st = '待办' }) {
    const line = this.getLine(lineId);
    if (!line) return null;
    const pub = { id: newId('pub'), when, tt, st };
    line.pubs.push(pub);
    this.save();
    return clone(pub);
  }
  updatePub(lineId, pubId, patch = {}) {
    const pub = this.getLine(lineId)?.pubs.find((p) => p.id === pubId);
    if (!pub) return null;
    if (patch.when !== undefined) pub.when = patch.when;
    if (patch.tt !== undefined) pub.tt = patch.tt;
    if (patch.st !== undefined) pub.st = patch.st;
    this.save();
    return clone(pub);
  }
  updateCm(lineId, cmId, { handled }) {
    const cm = this.getLine(lineId)?.cms.find((c) => c.id === cmId);
    if (!cm) return null;
    cm.handled = handled;
    this.save();
    return clone(cm);
  }

  // ---------------- materials ----------------
  getMaterials(tag) {
    const all = clone(this.ensure().materials);
    return tag ? all.filter((m) => Array.isArray(m.tags) && m.tags.includes(tag)) : all;
  }
  addMaterial({ source = '网页 · 手动', body, summary = '', tags = [], fav = 3, url = '', date = today() }) {
    const mat = { id: newId('m'), source, body, summary, tags: [...tags], fav, url, date };
    this.ensure().materials.push(mat);
    this.save();
    return clone(mat);
  }
  updateMaterial(id, patch = {}) {
    const m = this.ensure().materials.find((x) => x.id === id);
    if (!m) return null;
    for (const key of ['source', 'body', 'summary', 'tags', 'fav', 'url', 'date']) {
      if (patch[key] !== undefined) m[key] = patch[key];
    }
    this.save();
    return clone(m);
  }
  deleteMaterial(id) {
    const list = this.ensure().materials;
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return false;
    list.splice(i, 1);
    this.save();
    return true;
  }

  // ---------------- scratch ----------------
  getScratch() {
    return this.ensure().scratch.text;
  }
  setScratch(text) {
    this.ensure().scratch.text = text;
    this.save();
    return { text };
  }
}
