import React from "react";

/**
 * Lightweight Markdown → HTML renderer.
 * Supports: headings, bold, italic, links, images, lists, blockquotes, code, hr.
 * No external dependencies required.
 */

function parseMarkdown(md: string): string {
  let html = md;

  // Normalize line endings
  html = html.replace(/\r\n/g, "\n");

  // Code blocks (fenced)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) =>
      `<pre class="blog-pre"><code>${escapeHtml(code.trimEnd())}</code></pre>`
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="blog-inline-code">$1</code>'
  );

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="blog-img" loading="lazy" />'
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="blog-link" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Headings (## → h2, ### → h3, #### → h4)
  html = html.replace(/^#### (.+)$/gm, '<h4 class="blog-h4">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="blog-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="blog-h2">$1</h2>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="blog-hr" />');

  // Blockquotes
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote class="blog-blockquote">$1</blockquote>'
  );

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li class="blog-li">$1</li>');
  html = html.replace(
    /(<li class="blog-li">[\s\S]*?<\/li>(\n|$))+/g,
    (match) => `<ul class="blog-ul">${match}</ul>`
  );

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="blog-oli">$1</li>');
  html = html.replace(
    /(<li class="blog-oli">[\s\S]*?<\/li>(\n|$))+/g,
    (match) => `<ol class="blog-ol">${match}</ol>`
  );

  // Paragraphs — wrap remaining text blocks
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Skip blocks already wrapped in HTML tags
      if (/^<(h[2-4]|ul|ol|pre|blockquote|hr|img|div)/.test(trimmed)) {
        return trimmed;
      }
      return `<p class="blog-p">${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function BlogMarkdown({ content }: { content: string }) {
  const html = parseMarkdown(content);

  return (
    <div
      className="blog-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}