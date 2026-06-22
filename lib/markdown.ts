/**
 * Markdown 工具库
 * HTML ↔ Markdown 双向转换
 */

import { marked } from 'marked';
import TurndownService from 'turndown';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Markdown → HTML
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/**
 * HTML → Markdown
 */
export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // 自定义规则：任务列表
  turndownService.addRule('taskList', {
    filter: (node) => {
      return (
        node.nodeName === 'LI' &&
        node.parentElement?.getAttribute('data-type') === 'taskList'
      );
    },
    replacement: (content, node) => {
      const element = node as HTMLElement;
      const checked = element.getAttribute('data-checked') === 'true';
      return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`;
    },
  });

  // 自定义规则：删除线
  turndownService.addRule('strikethrough', {
    filter: (node: HTMLElement) => {
      return node.nodeName === 'DEL' || node.nodeName === 'S' || node.nodeName === 'STRIKE';
    },
    replacement: (content) => `~~${content}~~`,
  });

  return turndownService.turndown(html);
}
