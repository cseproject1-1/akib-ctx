import { marked } from 'marked';

/**
 * Sanitize pasted KaTeX HTML by extracting original LaTeX from annotation tags
 * and converting to math-block divs the KaTeXExtension can parse.
 */
export function sanitizeKatexHtml(html: string): string {
  // Extract LaTeX from <annotation encoding="application/x-tex"> inside KaTeX spans
  let result = html.replace(
    /<span[^>]*class="katex-display"[^>]*>[\s\S]*?<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>\s*<\/span>\s*<\/span>/g,
    (_match, latex: string) => {
      const decoded = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const escaped = decoded.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
    }
  );

  result = result.replace(
    /<span[^>]*class="katex"[^>]*>[\s\S]*?<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>\s*<\/span>\s*<\/span>/g,
    (_match, latex: string) => {
      const decoded = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const escaped = decoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<code class="math-inline" data-math-inline="${escaped}">${escaped}</code>`;
    }
  );

  result = result.replace(/<span[^>]*class="katex[^"]*"[^>]*>[\s\S]*?<\/span>/g, (match) => {
    const annMatch = match.match(/<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/);
    if (annMatch) {
      const decoded = annMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const escaped = decoded.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
    }
    return '';
  });

  return result;
}

// Configure marked
const renderer = new marked.Renderer();
renderer.code = function(codeOrOptions: any, infostring?: string) {
  let lang = '';
  let code = '';
  if (typeof codeOrOptions === 'string') {
    code = codeOrOptions;
    lang = infostring || '';
  } else if (typeof codeOrOptions === 'object' && codeOrOptions !== null) {
    code = codeOrOptions.text || '';
    lang = codeOrOptions.lang || '';
  }
  const languageClass = lang ? `language-${lang}` : 'language-plaintext';
  const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<pre><code class="${languageClass}">${escapedCode}</code></pre>`;
};

marked.use({ renderer });

/**
 * Pre-process LaTeX math delimiters
 */
export function preprocessMath(md: string): string {
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    const escaped = latex.trim().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div data-math-block data-latex="${escaped}">${escaped}</div>`;
  });

  md = md.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_match, latex: string) => {
    const escaped = latex.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<code class="math-inline" data-math-inline="${escaped}">${escaped}</code>`;
  });

  return md;
}

/**
 * Markdown to HTML
 */
export function markdownToHtml(md: string): string {
  const processed = preprocessMath(md);
  let html = '';
  if (typeof (marked as any).parseSync === 'function') {
    html = (marked as any).parseSync(processed) as string;
  } else {
    html = (marked.parse(processed, { async: false }) as string);
  }

  html = html
    .replace(/<ul>\s*<li><input\s/g, '<ul data-type="taskList"><li data-type="taskItem" data-checked="')
    .replace(/<li><input\s+checked=""\s+disabled=""\s+type="checkbox"\s*>\s*/g, '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked />')
    .replace(/<li><input\s+disabled=""\s+type="checkbox"\s*>\s*/g, '<li data-type="taskItem" data-checked="false"><label><input type="checkbox" />')
    .replace(/(<li data-type="taskItem"[^>]*><label><input[^/]*\/>)([^<]*)<\/li>/g, '$1$2</label></li>');

  return html;
}
