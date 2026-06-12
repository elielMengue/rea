import { normalizeText } from './normalize-text';
import type { Block } from './types';

export const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figcaption, dd, dt, td, div';

const EXCLUDED_ZONES =
  'nav, header, footer, aside, form, [role="navigation"], [role="banner"], [role="contentinfo"], [role="search"], [aria-hidden="true"]';

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME']);
const NON_CONTENT_SELECTOR = 'script, style, noscript, template, svg, iframe';

export const MIN_BLOCK_LENGTH = 20;

function contentText(element: Element): string {
  if (!element.querySelector(NON_CONTENT_SELECTOR)) {
    return element.textContent ?? '';
  }
  const clone = element.cloneNode(true) as Element;
  for (const junk of clone.querySelectorAll(NON_CONTENT_SELECTOR)) junk.remove();
  return clone.textContent ?? '';
}

export function collectBlocks(root: Document | Element): Block[] {
  const scope = 'querySelectorAll' in root ? root : null;
  if (!scope) return [];

  const blocks: Block[] = [];
  for (const element of scope.querySelectorAll(BLOCK_SELECTOR)) {
    if (SKIPPED_TAGS.has(element.tagName)) continue;
    if (element.querySelector(BLOCK_SELECTOR)) continue;
    if (element.closest(EXCLUDED_ZONES)) continue;
    if ((element as HTMLElement).hidden) continue;
    if ((element as HTMLElement).style?.display === 'none') continue;

    const text = normalizeText(contentText(element));
    if (text.length < MIN_BLOCK_LENGTH) continue;

    blocks.push({ text, element });
  }
  return blocks;
}
