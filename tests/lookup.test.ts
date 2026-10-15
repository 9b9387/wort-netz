import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupDwds } from "../lib/server/dwds";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookupDwds", () => {
  it("maps an inflected form to its canonical lemma", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/frequency")) {
          return Response.json({ q: "ging", lemma: "gehen", frequency: 5 });
        }

        if (url.includes("/wb/snippet")) {
          return Response.json([
            {
              input: "gehen",
              wortart: "Verb",
              lemma: "gehen",
              url: "https://www.dwds.de/wb/gehen",
            },
          ]);
        }

        return Response.json([
          { ipa: "ˈɡeːən", status: "proved" },
        ]);
      }),
    );

    await expect(lookupDwds("ging")).resolves.toMatchObject({
      canonicalLemma: "gehen",
      wordType: "Verb",
      frequencyClass: 5,
      ipa: "ˈɡeːən",
      found: true,
    });
  });

  it("falls back to the surface form when DWDS returns a malformed lemma", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/frequency")) {
          return Response.json({
            q: "was",
            lemma: "was\twer",
            frequency: 0,
          });
        }

        if (url.includes("/wb/snippet")) {
          return Response.json([
            {
              input: "was",
              wortart: "Pronomen",
              lemma: "was",
              url: "https://www.dwds.de/wb/was",
            },
          ]);
        }

        return Response.json([]);
      }),
    );

    await expect(lookupDwds("was")).resolves.toMatchObject({
      canonicalLemma: "was",
      wordType: "Pronomen",
      found: true,
    });
  });

  it("prefers a capitalized noun when lowercase input is a weaker verb form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const query = url.searchParams.get("q");

        if (url.pathname.endsWith("/frequency")) {
          if (query === "Lampe") {
            return Response.json({
              q: "Lampe",
              lemma: "Lampe",
              frequency: 3,
            });
          }

          return Response.json({
            q: "lampe",
            lemma: "lampen",
            frequency: 1,
          });
        }

        if (url.pathname.endsWith("/wb/snippet")) {
          if (query === "Lampe") {
            return Response.json([
              {
                input: "Lampe",
                wortart: "Substantiv",
                lemma: "Lampe",
                url: "https://www.dwds.de/wb/Lampe",
              },
            ]);
          }

          return Response.json([
            {
              input: "lampen",
              wortart: "Verb",
              lemma: "lampen",
              url: "https://www.dwds.de/wb/lampen",
            },
          ]);
        }

        return Response.json([
          query === "Lampe"
            ? { ipa: "ˈlampə", status: "proved" }
            : { ipa: "ˈlampn̩", status: "auto" },
        ]);
      }),
    );

    await expect(lookupDwds("lampe")).resolves.toMatchObject({
      canonicalLemma: "Lampe",
      wordType: "Substantiv",
      frequencyClass: 3,
      found: true,
    });
  });
});
