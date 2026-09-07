import { describe, expect, it } from 'vitest';
import { buildAskPrompt, buildDigestPrompt } from '../src/core/aiPrompts';

describe('AI 提示词构建（铁律内建）', () => {
  it('速览：含页码与原文', () => {
    const { system, user } = buildDigestPrompt(12, '营业收入 2,345,678,901.23 元');
    expect(user).toContain('【第12页原文】');
    expect(user).toContain('2,345,678,901.23');
    expect(system).toContain('严禁编造');
    expect(system).toContain('不做任何投资建议');
  });

  it('问答：上下文带页码标记，拒答规则内建', () => {
    const { system, user } = buildAskPrompt(
      [
        { page: 10, text: '第十页内容' },
        { page: 11, text: '第十一页内容' },
      ],
      '合同负债为什么增加？',
    );
    expect(user).toContain('【第10页】');
    expect(user).toContain('【第11页】');
    expect(user).toContain('【问题】合同负债为什么增加？');
    expect(system).toContain('原文中没有找到依据');
    expect(system).toContain('[P12]');
  });

  it('问答：空页被过滤', () => {
    const { user } = buildAskPrompt(
      [
        { page: 10, text: '   ' },
        { page: 11, text: '有内容' },
      ],
      'q',
    );
    expect(user).not.toContain('【第10页】');
    expect(user).toContain('【第11页】');
  });
});
