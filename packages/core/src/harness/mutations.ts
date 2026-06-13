import { normalizeText } from '../normalize-text';
import type { Block } from '../types';

export interface MutationContext {
  centerIndex: number;
}

export type BlockMutation = (blocks: Block[], ctx: MutationContext) => Block[];

const RIGHT_SQ = String.fromCharCode(0x2019);
const LEFT_DQ = String.fromCharCode(0x201c);
const EM_DASH = String.fromCharCode(0x2014);

const dropChar = (text: string) => text.replace(/([a-z]{4})([a-z])/, '$1');

const curlify = (text: string) =>
  text.replace(/'/g, RIGHT_SQ).replace(/"/g, LEFT_DQ).replace(/ - /g, ` ${EM_DASH} `);

/**
 * Block-level mutations simulate page changes between capture and
 * restoration. divSoup is the exception: it rewrites the DOM itself, so it
 * lives in the harness next to the single per-fixture parse.
 */
export const mutations: Record<string, BlockMutation> = {
  identity: (blocks) => blocks,

  insertAd: (blocks) =>
    blocks.flatMap((block, i) =>
      i % 8 === 4
        ? [
            {
              text: normalizeText(
                `Sponsored: subscribe now to our premium newsletter, limited offer ${i}`,
              ),
            },
            block,
          ]
        : [block],
    ),

  fixTypo: (blocks, ctx) =>
    blocks.map((block, i) =>
      i % 4 === 0 || i === ctx.centerIndex ? { text: dropChar(block.text) } : block,
    ),

  removeParagraph: (blocks, ctx) =>
    blocks.filter((_, i) => !(i % 9 === 3 && Math.abs(i - ctx.centerIndex) > 2)),

  rewriteAll: (blocks) =>
    blocks.map((_, i) => ({
      text: `entirely rewritten content segment ${i} bearing no resemblance to the source material`,
    })),

  smartQuotes: (blocks) => blocks.map((block) => ({ text: normalizeText(curlify(block.text)) })),

  duplicateText: (blocks, ctx) => [blocks[ctx.centerIndex]!, ...blocks],

  truncatePaywall: (blocks) => blocks.slice(0, Math.ceil(blocks.length * 0.4)),
};
