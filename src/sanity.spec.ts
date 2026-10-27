import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

describe('sanity', () => {
  it('App 组件可以在 jsdom 下挂载并渲染标题', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('个人运营驾驶舱');
  });

  it('vitest 默认环境是 jsdom（存在 document）', () => {
    expect(typeof document).toBe('object');
  });
});
