/**
 * Rules that fill a new expense (plan 3.8). The API applies them to a
 * sentence and to the bot; Cargar gasto applies them here as the person
 * types, so a rule with an amount or payment method condition works
 * without asking the server again. Mirrors `internal/categorize/rules.go`.
 */

export type Rule = {
  id: string;
  householdId: string;
  createdBy: string;
  matchText: string;
  paymentMethodId: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  setCategoryId: string | null;
  setPaymentMethodId: string | null;
  createdAt: string;
  updatedAt: string;
};

const ACCENTS: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a",
  é: "e", è: "e", ë: "e", ê: "e",
  í: "i", ì: "i", ï: "i", î: "i",
  ó: "o", ò: "o", ö: "o", ô: "o",
  ú: "u", ù: "u", ü: "u", û: "u",
};

/**
 * Lower case, without accents, only letters and digits separated by single
 * spaces: "Súper!!" and "super" are the same (textnorm.Key in the API).
 */
export function textKey(s: string): string {
  const plain = [...s.toLowerCase()].map((c) => ACCENTS[c] ?? c).join("");
  return (plain.match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");
}

/** What is known of the new expense. */
export type RuleInput = {
  description: string;
  /** "" when not chosen. */
  paymentMethodId: string;
  /** 0 when not known. */
  amount: number;
  currency: string;
};

/** The rule's text is in the description as whole words, and its conditions hold. */
export function ruleMatches(rule: Rule, key: string, input: RuleInput, baseCurrency: string): boolean {
  const text = textKey(rule.matchText);
  if (!text || !` ${key} `.includes(` ${text} `)) return false;
  if (rule.paymentMethodId && rule.paymentMethodId !== input.paymentMethodId) return false;
  if (rule.minAmount == null && rule.maxAmount == null) return true;
  if (!(input.amount > 0) || (input.currency || baseCurrency) !== baseCurrency) return false;
  if (rule.minAmount != null && input.amount < rule.minAmount) return false;
  return rule.maxAmount == null || input.amount <= rule.maxAmount;
}

function conditions(r: Rule): number {
  return (r.paymentMethodId ? 1 : 0) + (r.minAmount != null || r.maxAmount != null ? 1 : 0);
}

export type RuleMatch = {
  categoryId: string | null;
  paymentMethodId: string | null;
};

/**
 * What the space's rules fill. The rule with more conditions wins, then the
 * longer text, then the newest; each field comes from the first rule that
 * can fill it. The payment method only when none is chosen, and only one of
 * `myMethods` (the person's active ones).
 */
export function matchRules(
  rules: readonly Rule[] | undefined,
  input: RuleInput,
  opts: { baseCurrency: string; categoryIds: readonly string[]; myMethods: readonly string[] },
): RuleMatch {
  const out: RuleMatch = { categoryId: null, paymentMethodId: null };
  const key = textKey(input.description);
  if (!rules || !key) return out;
  const matching = rules
    .filter((r) => ruleMatches(r, key, input, opts.baseCurrency))
    .sort(
      (a, b) =>
        conditions(b) - conditions(a) ||
        [...textKey(b.matchText)].length - [...textKey(a.matchText)].length ||
        b.createdAt.localeCompare(a.createdAt),
    );
  for (const r of matching) {
    if (!out.categoryId && r.setCategoryId && opts.categoryIds.includes(r.setCategoryId)) {
      out.categoryId = r.setCategoryId;
    }
    if (
      !out.paymentMethodId &&
      !input.paymentMethodId &&
      r.setPaymentMethodId &&
      opts.myMethods.includes(r.setPaymentMethodId)
    ) {
      out.paymentMethodId = r.setPaymentMethodId;
    }
  }
  return out;
}

/** The text a rule offered after a correction looks for: the description, cut to 60 characters. */
export function offerText(description: string): string | null {
  const text = description.trim().replace(/\s+/g, " ");
  const cut = [...text].slice(0, 60).join("").trim();
  return [...textKey(cut)].length >= 2 ? cut : null;
}
