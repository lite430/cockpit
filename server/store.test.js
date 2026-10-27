// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store, seedData, newId, today } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = path.resolve(__dirname, '..', '.tmp', 'store');
const created = [];

function tmpPath(name) {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const p = path.join(TMP_ROOT, `${name}-${randomUUID().slice(0, 8)}.json`);
  created.push(p);
  return p;
}

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('Store · 首次初始化', () => {
  it('无数据文件时 load 用 seed 初始化并落盘（内容风格来自 cockpit-demo 假数据）', () => {
    const file = tmpPath('seed');
    expect(fs.existsSync(file)).toBe(false);

    const s = new Store(file);
    const data = s.load();

    // 三条业务线各带 stats/spark/pubs/cms；4 待办、5 日程、6 素材、速记一段
    expect(data.todos).toHaveLength(4);
    expect(data.schedule).toHaveLength(5);
    expect(data.lines.map((l) => l.id).sort()).toEqual(['sph', 'xhs', 'xy']);
    expect(data.materials).toHaveLength(6);
    expect(typeof data.scratch.text).toBe('string');
    expect(data.scratch.text.length).toBeGreaterThan(0);

    // 字段形状
    for (const t of data.todos) {
      expect(t).toMatchObject({ id: expect.any(String), text: expect.any(String), due: expect.any(String) });
      expect(typeof t.done).toBe('boolean');
      expect(['xhs', 'xy', 'sph']).toContain(t.tag);
    }
    for (const it of data.schedule) {
      expect(it).toMatchObject({ id: expect.any(String), time: expect.any(String), title: expect.any(String), note: expect.any(String) });
    }
    for (const line of data.lines) {
      expect(line).toMatchObject({ id: expect.any(String), name: expect.any(String), sub: expect.any(String) });
      // stats 值按 [当前值, 环比%] 处理（契约笔误 valeur -> value）
      for (const v of Object.values(line.stats)) {
        expect(v).toHaveLength(2);
        expect(v.every(Number.isFinite)).toBe(true);
      }
      expect(line.spark.length).toBeGreaterThan(5);
      expect(line.spark.every(Number.isFinite)).toBe(true);
      for (const p of line.pubs) {
        expect(p).toMatchObject({ id: expect.any(String), when: expect.any(String), tt: expect.any(String), st: expect.any(String) });
      }
      for (const c of line.cms) {
        expect(c).toMatchObject({ id: expect.any(String), who: expect.any(String), txt: expect.any(String) });
        expect(typeof c.handled).toBe('boolean');
      }
    }
    for (const m of data.materials) {
      expect(m).toMatchObject({ id: expect.any(String), source: expect.any(String), body: expect.any(String), summary: expect.any(String) });
      expect(Array.isArray(m.tags)).toBe(true);
      expect(m.fav).toBeGreaterThanOrEqual(1);
      expect(m.fav).toBeLessThanOrEqual(5);
    }

    // seed 已写入磁盘
    expect(fs.existsSync(file)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(onDisk.todos).toHaveLength(4);
  });

  it('已有数据文件时 load 读原文件，不覆盖成 seed', () => {
    const file = tmpPath('reload');
    const a = new Store(file);
    a.load();
    const added = a.addTodo({ text: '原数据', due: '今天', tag: 'xy' });

    const b = new Store(file);
    const data = b.load();
    expect(data.todos).toHaveLength(5); // 4 条 seed + 1 条新增，而不是重新 seed 成 4 条
    expect(data.todos.some((t) => t.id === added.id && t.text === '原数据')).toBe(true);
  });
});

describe('Store · 读写与持久化', () => {
  it('add/update/delete Todo 后新实例 load 能读到同样的结果（重载持久化）', () => {
    const file = tmpPath('persist');
    const a = new Store(file);
    a.load();

    const added = a.addTodo({ text: '持久化验证', due: '明天', tag: 'sph' });
    expect(added).toMatchObject({ text: '持久化验证', due: '明天', done: false, tag: 'sph' });
    expect(added.id).toMatch(/^t-/);

    const patched = a.updateTodo(added.id, { done: true, due: '17:00' });
    expect(patched).toMatchObject({ id: added.id, done: true, due: '17:00' });

    const b = new Store(file);
    b.load();
    expect(b.getTodos()).toHaveLength(5);
    const reloaded = b.getTodos().find((t) => t.id === added.id);
    expect(reloaded).toMatchObject({ done: true, due: '17:00', text: '持久化验证' });

    expect(a.deleteTodo(added.id)).toBe(true);
    expect(a.deleteTodo(added.id)).toBe(false); // 再删同 id 失败
    const c = new Store(file);
    expect(c.getTodos()).toHaveLength(4);
    expect(c.getTodos().some((t) => t.id === added.id)).toBe(false);
  });

  it('schedule / scratch 的增删改同样持久化', () => {
    const file = tmpPath('mix');
    const a = new Store(file);
    a.load();

    const item = a.addSchedule({ time: '08:00', title: '晨会', note: '' });
    expect(item).toMatchObject({ time: '08:00', title: '晨会', note: '' });
    a.setScratch('新速记内容');

    const b = new Store(file);
    expect(b.getSchedule()).toHaveLength(6);
    expect(b.getSchedule().some((x) => x.id === item.id)).toBe(true);
    expect(b.getScratch()).toBe('新速记内容');
    expect(b.deleteSchedule(item.id)).toBe(true);
    expect(b.getSchedule()).toHaveLength(5);
  });

  it('lines 的 pubs/cms 可增量修改，materials 支持标签过滤', () => {
    const file = tmpPath('lines');
    const a = new Store(file);
    a.load();

    const pub = a.addPub('xhs', { when: '周六 10:00', tt: '新排期', st: '待办' });
    expect(pub).toMatchObject({ when: '周六 10:00', tt: '新排期', st: '待办' });
    expect(a.updatePub('xhs', pub.id, { st: '已发' }).st).toBe('已发');
    expect(a.updatePub('xhs', 'pub-不存在', { st: 'x' })).toBeNull();

    const cm = a.updateCm('xy', 'cm-xy-1', { handled: true });
    expect(cm.handled).toBe(true);
    expect(a.updateCm('xy', 'cm-不存在', { handled: true })).toBeNull();

    const mat = a.addMaterial({ source: 'X · @test', body: '素材正文', summary: '摘要', tags: ['#测试'], fav: 4 });
    expect(mat).toMatchObject({ source: 'X · @test', body: '素材正文', fav: 4 });
    expect(mat.date).toBe(today()); // 缺省日期按当天
    expect(a.getMaterials('#测试')).toHaveLength(1);
    expect(a.getMaterials('#不存在的标签')).toHaveLength(0);
    expect(a.getMaterials()).toHaveLength(7); // 不过滤给全量

    const b = new Store(file);
    const xhs = b.getLines().find((l) => l.id === 'xhs');
    expect(xhs.pubs.some((p) => p.id === pub.id && p.st === '已发')).toBe(true);
    expect(b.getLines().find((l) => l.id === 'xy').cms.find((c) => c.id === 'cm-xy-1').handled).toBe(true);
    expect(b.getMaterials('#测试')).toHaveLength(1);
  });

  it('集合返回的是拷贝，改返回值不会污染存储', () => {
    const file = tmpPath('clone');
    const s = new Store(file);
    s.load();
    s.getTodos()[0].text = '被篡改';
    expect(s.getTodos()[0].text).not.toBe('被篡改');
  });

  it('newId 生成的 id 稳定且不重复', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId('t')));
    expect(ids.size).toBe(200);
  });
});

describe('Store · 原子写', () => {
  it('save 走「同目录临时文件 + rename」：不残留 .tmp，目标文件始终是完整 JSON', () => {
    const file = tmpPath('atomic');
    const s = new Store(file);
    s.load();
    const dir = path.dirname(file);

    const origWrite = fs.writeFileSync;
    const tmpFiles = [];
    fs.writeFileSync = function (p, ...rest) {
      tmpFiles.push(String(p));
      return origWrite.call(fs, p, ...rest);
    };

    try {
      // 连续多次写盘（每次 addTodo 都 save）
      for (let i = 0; i < 5; i++) {
        s.addTodo({ text: `第${i}条`, due: '', tag: 'xhs' });
        // 任意时刻检查：目录里要么没有数据文件（还在临时文件阶段），要么是能完整解析的 JSON
        const names = fs.readdirSync(dir);
        for (const n of names) {
          if (n === path.basename(file)) {
            expect(() => JSON.parse(fs.readFileSync(file, 'utf8'))).not.toThrow();
          }
        }
      }
    } finally {
      fs.writeFileSync = origWrite;
    }

    // 1) 确实先写了临时文件，且与目标文件同目录（同目录 rename 才是原子的）
    expect(tmpFiles.length).toBeGreaterThanOrEqual(5);
    for (const p of tmpFiles) {
      expect(path.dirname(p)).toBe(dir);
      expect(p.endsWith('.tmp')).toBe(true);
      expect(fs.existsSync(p)).toBe(false); // 都已被 rename 顶替，没剩下
    }
    // 2) 目录里除了数据文件没有别的残留
    expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    // 3) 最终文件是完整合法 JSON，内容与内存一致
    const final = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(final.todos).toHaveLength(9); // seed 4 + 新 5
  });
});
