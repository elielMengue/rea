import { describe, expect, it } from 'vitest';
import { collectBlocks } from './collect-blocks';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const LONG = 'This sentence is long enough to pass the minimum block length filter.';

describe('collectBlocks', () => {
  it('collects paragraphs in document order with normalized text', () => {
    const doc = parse(`<article><p>First ${LONG}</p><p>Second ${LONG}</p></article>`);
    const blocks = collectBlocks(doc);
    expect(blocks.map((b) => b.text)).toEqual([
      `first ${LONG.toLowerCase()}`,
      `second ${LONG.toLowerCase()}`,
    ]);
  });

  it('keeps only leaf blocks when blocks nest', () => {
    const doc = parse(`<blockquote><p>${LONG}</p></blockquote>`);
    const blocks = collectBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.element?.tagName).toBe('P');
  });

  it('collects leaf divs with substantial text (div soup)', () => {
    const doc = parse(`<div><div>${LONG}</div><div>${LONG} again</div></div>`);
    expect(collectBlocks(doc)).toHaveLength(2);
  });

  it('skips blocks inside excluded zones', () => {
    const doc = parse(
      `<nav><p>${LONG}</p></nav><footer><p>${LONG}</p></footer><main><p>${LONG}</p></main>`,
    );
    expect(collectBlocks(doc)).toHaveLength(1);
  });

  it('skips aria-hidden subtrees and hidden elements', () => {
    const doc = parse(
      `<div aria-hidden="true"><p>${LONG}</p></div><p hidden>${LONG}</p><p style="display: none">${LONG}</p><p>${LONG}</p>`,
    );
    expect(collectBlocks(doc)).toHaveLength(1);
  });

  it('filters out blocks below the minimum length', () => {
    const doc = parse(`<p>too short</p><p>${LONG}</p>`);
    expect(collectBlocks(doc)).toHaveLength(1);
  });

  it('ignores script and style content', () => {
    const doc = parse(`<div><script>const x = 'not content, but long enough';</script></div>`);
    expect(collectBlocks(doc)).toHaveLength(0);
  });
});
