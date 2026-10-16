export type TextBlock = {
  start: number;
  end: number;
  text: string;
};

export type BlockSegment<T> =
  | { kind: "text"; value: string }
  | { kind: "token"; token: T };

/**
 * Splits the annotated text into line blocks so paragraphs keep their original
 * blank lines without losing the global UTF-16 offsets the tokens carry.
 */
export function splitTextBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let start = 0;

  for (let index = 0; index <= text.length; index += 1) {
    const isBreak = index === text.length || text[index] === "\n";

    if (!isBreak) {
      continue;
    }

    blocks.push({ start, end: index, text: text.slice(start, index) });
    start = index + 1;
  }

  return blocks;
}

/**
 * The rendered DOM only contains the block texts, while the source text also
 * contains the newline that separates two blocks. `Range.toString()` therefore
 * counts fewer characters than the source, and each line break has to be added
 * back when a DOM offset (from a user selection) is translated into an offset
 * into the original text.
 *
 * A caret that sits exactly on a block boundary maps to the start of the
 * following block.
 */
export function domOffsetToSourceOffset(
  blocks: readonly TextBlock[],
  domOffset: number,
): number {
  if (blocks.length === 0) {
    return domOffset;
  }

  let consumed = 0;

  for (const block of blocks) {
    const length = block.text.length;

    if (domOffset < consumed + length) {
      return block.start + (domOffset - consumed);
    }

    consumed += length;
  }

  return blocks[blocks.length - 1].end;
}

/**
 * Emits the alternating plain-text / token segments of one block. `fromIndex`
 * is the first token that may still belong to the block, so a full pass over
 * the text stays linear in the number of tokens.
 */
export function segmentBlock<T extends { start: number; end: number }>(
  text: string,
  block: TextBlock,
  tokens: readonly T[],
  fromIndex: number,
): { segments: Array<BlockSegment<T>>; nextIndex: number } {
  const segments: Array<BlockSegment<T>> = [];
  let cursor = block.start;
  let index = fromIndex;

  while (index < tokens.length && tokens[index].start < block.end) {
    const token = tokens[index];

    if (token.end <= block.start) {
      index += 1;
      continue;
    }

    if (token.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, token.start) });
    }

    segments.push({ kind: "token", token });
    cursor = Math.max(cursor, token.end);
    index += 1;
  }

  if (cursor < block.end) {
    segments.push({ kind: "text", value: text.slice(cursor, block.end) });
  }

  return { segments, nextIndex: index };
}

export type RenderedBlock<T> = {
  block: TextBlock;
  segments: Array<BlockSegment<T>>;
};

/**
 * Runs `segmentBlock` over every line of the text in one pass, so rendering
 * never has to mutate a cursor while mapping.
 */
export function segmentText<T extends { start: number; end: number }>(
  text: string,
  tokens: readonly T[],
): Array<RenderedBlock<T>> {
  const blocks = splitTextBlocks(text);
  const rendered: Array<RenderedBlock<T>> = [];
  let cursor = 0;

  for (const block of blocks) {
    const { segments, nextIndex } = segmentBlock(text, block, tokens, cursor);
    cursor = nextIndex;
    rendered.push({ block, segments });
  }

  return rendered;
}
