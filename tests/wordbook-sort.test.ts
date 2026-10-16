import { describe, expect, it } from "vitest";
import {
  parseWordBookFavorites,
  parseWordBookQuery,
  parseWordBookStatus,
  parseWordBookSort,
  wordBookHref,
} from "../lib/wordbook/sort";

describe("parseWordBookSort", () => {
  it("accepts the supported orders", () => {
    expect(parseWordBookSort("alphabet")).toBe("alphabet");
    expect(parseWordBookSort("encounters")).toBe("encounters");
    expect(parseWordBookSort("due")).toBe("due");
    expect(parseWordBookSort(["recent", "alphabet"])).toBe("recent");
  });

  it("falls back to the newest-first order", () => {
    expect(parseWordBookSort(undefined)).toBe("recent");
    expect(parseWordBookSort("")).toBe("recent");
    expect(parseWordBookSort("nonsense")).toBe("recent");
  });
});

describe("wordBookHref", () => {
  it("omits the default sort and keeps the selected word", () => {
    expect(wordBookHref({ sort: "recent", w: "abc" })).toBe("/words?w=abc");
    expect(wordBookHref({})).toBe("/words");
  });

  it("keeps the selection when only the order changes", () => {
    expect(wordBookHref({ w: "abc" }, { sort: "alphabet" })).toBe(
      "/words?sort=alphabet&w=abc",
    );
  });

  it("can drop the selection", () => {
    expect(wordBookHref({ w: "abc" }, { w: null })).toBe("/words");
    expect(wordBookHref({ sort: "due", w: "abc" }, { w: null })).toBe(
      "/words?sort=due",
    );
  });

  it("carries the search term", () => {
    expect(wordBookHref({ sort: "recent", q: null }, { q: "Haus" })).toBe(
      "/words?q=Haus",
    );
    expect(
      wordBookHref({ sort: "due", w: "abc", q: "Haus" }, { q: null }),
    ).toBe("/words?sort=due&w=abc");
  });

  it("carries the filters", () => {
    expect(
      wordBookHref(
        { sort: "recent" },
        { status: "MASTERED", favorites: true },
      ),
    ).toBe("/words?status=MASTERED&fav=1");
    expect(
      wordBookHref({ status: "SUSPENDED", favorites: true }, { favorites: false }),
    ).toBe("/words?status=SUSPENDED");
  });
});

describe("filter parsing", () => {
  it("accepts known statuses and the favourites flag", () => {
    expect(parseWordBookStatus("MASTERED")).toBe("MASTERED");
    expect(parseWordBookStatus("SUSPENDED")).toBe("SUSPENDED");
    expect(parseWordBookFavorites("1")).toBe(true);
    expect(parseWordBookFavorites("true")).toBe(true);
  });

  it("ignores unknown values", () => {
    expect(parseWordBookStatus("ALL")).toBeNull();
    expect(parseWordBookStatus(undefined)).toBeNull();
    expect(parseWordBookFavorites(undefined)).toBe(false);
    expect(parseWordBookFavorites("0")).toBe(false);
  });
});

describe("parseWordBookQuery", () => {
  it("trims and caps the search term", () => {
    expect(parseWordBookQuery("  Haus  ")).toBe("Haus");
    expect(parseWordBookQuery(["Baum", "ignored"])).toBe("Baum");
    expect(parseWordBookQuery("a".repeat(80))).toHaveLength(60);
  });

  it("ignores empty values", () => {
    expect(parseWordBookQuery(undefined)).toBeNull();
    expect(parseWordBookQuery("   ")).toBeNull();
  });
});
