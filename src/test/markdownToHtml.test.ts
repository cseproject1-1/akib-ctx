import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '@/components/tiptap/NoteEditor';

describe('markdownToHtml', () => {
  it('renders a heading', () => {
    const result = markdownToHtml('## Test Heading');
    expect(result).toContain('<h2>Test Heading</h2>');
  });

  it('renders a table with header and body', () => {
    const md = `| A | B | Output |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |`;
    const result = markdownToHtml(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<thead>');
    expect(result).toContain('<th>A</th>');
    expect(result).toContain('<th>B</th>');
    expect(result).toContain('<th>Output</th>');
    expect(result).toContain('<tbody>');
    expect(result).toContain('<td>0</td>');
    expect(result).toContain('<td>1</td>');
    expect(result).toContain('</table>');
  });

  it('renders heading + table together', () => {
    const md = `## Test
| A | B | Output |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |`;
    const result = markdownToHtml(md);
    expect(result).toContain('<h2>Test</h2>');
    expect(result).toContain('<table>');
    expect(result).toContain('<th>A</th>');
    expect(result).toContain('<td>1</td>');
  });

  it('renders bold and italic inline', () => {
    const result = markdownToHtml('This is **bold** and *italic*');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('renders bullet lists', () => {
    const md = `- Item 1\n- Item 2\n- Item 3`;
    const result = markdownToHtml(md);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 3</li>');
  });

  it('renders blockquotes', () => {
    const result = markdownToHtml('> This is a quote');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('This is a quote');
  });

  it('protects inline code from bold/italic processing', () => {
    const result = markdownToHtml('Use `**not bold**` in code');
    expect(result).toContain('<code>**not bold**</code>');
    expect(result).not.toContain('<strong>');
  });

  it('renders task lists', () => {
    const md = `- [ ] Todo item\n- [x] Done item`;
    const result = markdownToHtml(md);
    expect(result).toContain('taskList');
    expect(result).toContain('taskItem');
  });

  it('renders nested unordered lists', () => {
    const md = `- Parent\n  - Child\n  - Child 2\n- Parent 2`;
    const result = markdownToHtml(md);
    const ulCount = (result.match(/<ul>/g) || []).length;
    expect(ulCount).toBeGreaterThanOrEqual(2);
  });

  it('merges consecutive blockquote lines', () => {
    const md = `> Line 1\n> Line 2\n> Line 3`;
    const result = markdownToHtml(md);
    const bqCount = (result.match(/<blockquote>/g) || []).length;
    expect(bqCount).toBe(1);
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 3');
  });

  it('adds language class to code blocks', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const result = markdownToHtml(md);
    expect(result).toContain('language-javascript');
    expect(result).toContain('<pre>');
  });

  it('handles code block without language', () => {
    const md = '```\nplain code\n```';
    const result = markdownToHtml(md);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });

  it('renders ordered lists', () => {
    const md = `1. First\n2. Second\n3. Third`;
    const result = markdownToHtml(md);
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>First</li>');
    expect(result).toContain('<li>Third</li>');
  });

  it('handles mixed inline: bold code and links', () => {
    const md = 'See `code` and **bold** with [link](http://example.com)';
    const result = markdownToHtml(md);
    expect(result).toContain('<code>code</code>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('http://example.com');
    expect(result).toContain('link');
  });

  it('renders strikethrough', () => {
    const result = markdownToHtml('This is ~~deleted~~ text');
    expect(result).toContain('<del>deleted</del>');
  });

  it('renders images', () => {
    const result = markdownToHtml('![alt text](https://example.com/img.png)');
    expect(result).toContain('<img');
    expect(result).toContain('src="https://example.com/img.png"');
  });

  it('renders horizontal rules', () => {
    const result = markdownToHtml('---');
    expect(result).toContain('<hr');
  });
});
