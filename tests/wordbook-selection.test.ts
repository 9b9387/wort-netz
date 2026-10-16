import { describe, expect, it } from "vitest";
import { selectWordBookEntry } from "../lib/wordbook/selection";

describe("selectWordBookEntry", () => {
  const ids = ["newest", "middle", "oldest"];

  it("defaults to the newest word", () => {
    expect(selectWordBookEntry(ids, null)).toBe("newest");
  });

  it("keeps an explicitly selected word", () => {
    expect(selectWordBookEntry(ids, "oldest")).toBe("oldest");
  });

  it("falls back to the newest word when the selection is gone", () => {
    expect(selectWordBookEntry(ids, "deleted")).toBe("newest");
  });

  it("returns null for an empty book", () => {
    expect(selectWordBookEntry([], null)).toBeNull();
  });
});
