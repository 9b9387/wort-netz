import { describe, expect, it } from "vitest";
import { parseSurfaceForm } from "../lib/word-surface";

describe("parseSurfaceForm", () => {
  it("accepts the forms a user actually typed", () => {
    expect(parseSurfaceForm("ist")).toBe("ist");
    expect(parseSurfaceForm("  Häusern  ")).toBe("Häusern");
    expect(parseSurfaceForm("zur Verfügung")).toBe("zur Verfügung");
    expect(parseSurfaceForm("Fußball-Platz")).toBe("Fußball-Platz");
    expect(parseSurfaceForm(["willst", "ignored"])).toBe("willst");
  });

  it("rejects missing, empty and unsafe values", () => {
    expect(parseSurfaceForm(undefined)).toBeNull();
    expect(parseSurfaceForm("")).toBeNull();
    expect(parseSurfaceForm("   ")).toBeNull();
    expect(parseSurfaceForm("a".repeat(49))).toBeNull();
    expect(parseSurfaceForm("a".repeat(48))).toBe("a".repeat(48));
    expect(parseSurfaceForm("<script>")).toBeNull();
    expect(parseSurfaceForm("haus;drop")).toBeNull();
    expect(parseSurfaceForm("3D")).toBeNull();
  });
});
