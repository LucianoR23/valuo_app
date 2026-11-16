import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("app shortcuts (plan 3.11)", () => {
  const shortcuts = manifest().shortcuts ?? [];

  it("offers Cargar gasto, Foto de ticket and Comprometido", () => {
    expect(shortcuts.map((s) => [s.name, s.url])).toEqual([
      ["Cargar gasto", "/agregar"],
      ["Foto de ticket", "/agregar?foto=1"],
      ["Comprometido", "/tarjetas"],
    ]);
  });

  it("gives each one a 96 px icon that exists, plus 192 px", () => {
    for (const s of shortcuts) {
      expect(s.icons?.map((i) => i.sizes)).toEqual(["96x96", "192x192"]);
      for (const icon of s.icons ?? []) {
        expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
      }
    }
  });
});
