import { describe, expect, it } from "vitest";
import { matchRules, offerText, ruleMatches, textKey, type Rule } from "./rules";

function rule(over: Partial<Rule>): Rule {
  return {
    id: crypto.randomUUID(),
    householdId: "h",
    createdBy: "u",
    matchText: "uber",
    paymentMethodId: null,
    minAmount: null,
    maxAmount: null,
    setCategoryId: null,
    setPaymentMethodId: null,
    createdAt: "2026-11-14T12:00:00Z",
    updatedAt: "2026-11-14T12:00:00Z",
    ...over,
  };
}

const none = { description: "", paymentMethodId: "", amount: 0, currency: "" };

describe("textKey", () => {
  it("is the API's textnorm.Key", () => {
    expect(textKey("Súper")).toBe("super");
    expect(textKey("  SUPER ")).toBe("super");
    expect(textKey("Servicios/Luz")).toBe("servicios luz");
    expect(textKey("Pingüino Café!!")).toBe("pinguino cafe");
    expect(textKey("Año")).toBe("año");
    expect(textKey("")).toBe("");
  });
});

describe("ruleMatches", () => {
  const cases: [string, Partial<Rule>, string, Partial<typeof none>, boolean][] = [
    ["whole word", { matchText: "Carrefour" }, "Carrefour Palermo", {}, true],
    ["accents and case", { matchText: "pingüino" }, "PINGUINO!", {}, true],
    ["not part of a word", { matchText: "carrefour" }, "Carrefourcito", {}, false],
    ["words out of order", { matchText: "uber eats" }, "eats uber", {}, false],
    ["payment method required", { paymentMethodId: "visa" }, "Uber", {}, false],
    ["payment method given", { paymentMethodId: "visa" }, "Uber", { paymentMethodId: "visa" }, true],
    ["amount unknown", { minAmount: 20000 }, "Uber", {}, false],
    ["amount at min", { minAmount: 20000 }, "Uber", { amount: 20000 }, true],
    ["amount under min", { minAmount: 20000 }, "Uber", { amount: 19999.99 }, false],
    ["amount at max", { maxAmount: 5000 }, "Uber", { amount: 5000, currency: "ARS" }, true],
    ["amount over max", { maxAmount: 5000 }, "Uber", { amount: 5000.01 }, false],
    ["other currency", { minAmount: 10 }, "Uber", { amount: 50, currency: "USD" }, false],
  ];
  it.each(cases)("%s", (_, r, desc, input, want) => {
    expect(ruleMatches(rule(r), textKey(desc), { ...none, description: desc, ...input }, "ARS")).toBe(want);
  });
});

describe("matchRules", () => {
  const opts = { baseCurrency: "ARS", categoryIds: ["super", "taxi", "salud"], myMethods: ["cash", "visa"] };

  it("orders by conditions, then text length, then newest", () => {
    const plain = rule({ setCategoryId: "taxi" });
    const longer = rule({ matchText: "uber eats", setCategoryId: "super" });
    const withPM = rule({ paymentMethodId: "visa", setCategoryId: "salud" });
    const newer = rule({ setCategoryId: "super", createdAt: "2026-11-14T13:00:00Z" });
    expect(matchRules([plain, longer], { ...none, description: "uber eats pizza" }, opts).categoryId).toBe("super");
    expect(matchRules([longer, withPM], { ...none, description: "uber eats", paymentMethodId: "visa" }, opts).categoryId).toBe(
      "salud",
    );
    expect(matchRules([plain, newer], { ...none, description: "uber" }, opts).categoryId).toBe("super");
    expect(matchRules([rule({ setCategoryId: "gone" }), plain], { ...none, description: "uber" }, opts).categoryId).toBe("taxi");
  });

  it("fills only my active payment method, never over a chosen one", () => {
    const fills = rule({ setPaymentMethodId: "cash" });
    expect(matchRules([fills], { ...none, description: "uber" }, opts).paymentMethodId).toBe("cash");
    expect(matchRules([fills], { ...none, description: "uber", paymentMethodId: "visa" }, opts).paymentMethodId).toBeNull();
    expect(matchRules([rule({ setPaymentMethodId: "theirs" })], { ...none, description: "uber" }, opts).paymentMethodId).toBeNull();
  });

  it("finds nothing without rules or description", () => {
    expect(matchRules(undefined, { ...none, description: "uber" }, opts)).toEqual({ categoryId: null, paymentMethodId: null });
    expect(matchRules([rule({ setCategoryId: "taxi" })], none, opts).categoryId).toBeNull();
  });
});

describe("offerText", () => {
  it("is the description cut to 60 characters, or null when too short", () => {
    expect(offerText("  Carrefour   Palermo ")).toBe("Carrefour Palermo");
    expect([...(offerText("x".repeat(80)) ?? "")].length).toBe(60);
    expect(offerText("!")).toBeNull();
  });
});
