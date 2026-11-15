"use client";

import { useState } from "react";
import { mutate as swrMutate } from "swr";
import { ChevronRight, Plus, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRowSkeleton } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/category-select";
import { useCategories, usePaymentMethods, useRules } from "@/lib/api/hooks";
import { createRule, deleteRule, updateRule, type RuleInput } from "@/lib/api/mutations";
import type { Category, PaymentMethod } from "@/lib/api/schemas";
import { ApiError } from "@/lib/api/errors";
import { confirm } from "@/lib/confirm";
import type { Rule } from "@/lib/rules";
import { useSpaces } from "@/lib/spaces";
import { useFormatAmount } from "@/stores/discreet";
import { toast } from "@/lib/toast";

const OTHER_METHOD = "un medio de otro miembro";

function invalidateRules() {
  swrMutate((k) => Array.isArray(k) && k[0] === "/rules", undefined, { revalidate: true });
}

/** "15.000,50" or "15000" as a number; null when empty or not a positive amount. */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function amountText(n: number | null): string {
  return n == null ? "" : String(n).replace(".", ",");
}

/** "Súper · Visa Galicia", and the conditions: "solo con Visa · desde $ 20.000". */
export function ruleSummary(
  rule: Rule,
  categories: readonly Category[] | undefined,
  methods: readonly PaymentMethod[] | undefined,
  money: (amount: number) => string,
): { fills: string; when: string | null } {
  const methodName = (id: string) => methods?.find((m) => m.id === id)?.name ?? OTHER_METHOD;
  const fills = [
    rule.setCategoryId ? (categories?.find((c) => c.id === rule.setCategoryId)?.name ?? "Categoría") : null,
    rule.setPaymentMethodId ? methodName(rule.setPaymentMethodId) : null,
  ].filter(Boolean);
  const when = [
    rule.paymentMethodId ? `solo con ${methodName(rule.paymentMethodId)}` : null,
    rule.minAmount != null && rule.maxAmount != null
      ? `de ${money(rule.minAmount)} a ${money(rule.maxAmount)}`
      : rule.minAmount != null
        ? `desde ${money(rule.minAmount)}`
        : rule.maxAmount != null
          ? `hasta ${money(rule.maxAmount)}`
          : null,
  ].filter(Boolean);
  return { fills: fills.join(" · "), when: when.length ? when.join(" · ") : null };
}

/**
 * Reglas (plan 3.8, no design: the `Categorías` list and its sheet). A
 * rule fills the category and the payment method of a new expense whose
 * description says its text. Each space has its own rules.
 */
export function RulesManager({ help }: { help?: React.ReactNode }) {
  const { personal, hogar, current } = useSpaces();
  const [picked, setPicked] = useState<string | null>(null);
  const spaceId = picked ?? current?.id ?? personal?.id ?? null;
  const space = spaceId === hogar?.id ? hogar : personal;
  const { data: rules, isLoading } = useRules(spaceId);
  const { data: categories } = useCategories(spaceId);
  const { data: methods } = usePaymentMethods();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const currency = space?.baseCurrency ?? "ARS";
  const fmt = useFormatAmount();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-4">
      <PageHeader
        title="Reglas"
        description="Completan solas la categoría y el medio de pago cuando cargás un gasto."
        className="mb-0"
        action={
          <div className="flex items-center gap-2">
            {help}
            <Button size="icon" aria-label="Nueva regla" onClick={() => setCreating(true)} disabled={!spaceId}>
              <Plus aria-hidden strokeWidth={2} />
            </Button>
          </div>
        }
      />

      {hogar && personal && (
        <Segmented
          aria-label="Espacio"
          value={spaceId === hogar.id ? "hogar" : "personal"}
          onValueChange={(v) => setPicked(v === "hogar" ? hogar.id : personal.id)}
          options={[
            { value: "personal", label: "Mi plata" },
            { value: "hogar", label: "Hogar" },
          ]}
        />
      )}

      {isLoading || !spaceId ? (
        <Card className="py-1">
          <CardContent>
            {[0, 1, 2].map((i) => (
              <ListRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
      ) : !rules || rules.length === 0 ? (
        <EmptyState
          icon={Wand2}
          title="Todavía no tenés reglas"
          description="Por ejemplo: si la descripción dice «Carrefour», categoría Súper."
          action={
            <Button variant="outline" onClick={() => setCreating(true)}>
              Crear regla
            </Button>
          }
        />
      ) : (
        <Card className="py-1">
          <CardContent>
            <ul className="divide-y divide-border">
              {rules.map((r) => {
                const s = ruleSummary(r, categories, methods, (n) => fmt(n, currency));
                return (
                  <li key={r.id}>
                    <ListRow
                      onClick={() => setEditing(r)}
                      aria-label={`Editar la regla ${r.matchText}`}
                      title={`«${r.matchText}» → ${s.fills}`}
                      subtitle={s.when ?? undefined}
                      trailing={<ChevronRight aria-hidden className="size-5 text-ink-muted" strokeWidth={1.75} />}
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {spaceId && creating && (
        <RuleSheet
          spaceId={spaceId}
          categories={categories}
          methods={methods}
          onOpenChange={setCreating}
        />
      )}
      {spaceId && editing && (
        <RuleSheet
          key={editing.id}
          rule={editing}
          spaceId={spaceId}
          categories={categories}
          methods={methods}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  );
}

const NONE = "";

function MethodSelect({
  id,
  value,
  onValueChange,
  methods,
  emptyLabel,
}: {
  id: string;
  value: string;
  onValueChange: (v: string) => void;
  methods: readonly PaymentMethod[];
  emptyLabel: string;
}) {
  const mine = methods.filter((m) => m.isActive || m.id === value);
  const other = value && !mine.some((m) => m.id === value);
  const label = (v: string | null) =>
    !v ? emptyLabel : (mine.find((m) => m.id === v)?.name ?? (other ? "Medio de otro miembro" : emptyLabel));
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? NONE)}>
      <SelectTrigger id={id} className="mt-1.5 w-full">
        <SelectValue placeholder={emptyLabel}>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {other && <SelectItem value={value}>Medio de otro miembro</SelectItem>}
        {mine.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RuleSheet({
  rule,
  spaceId,
  categories,
  methods,
  onOpenChange,
}: {
  rule?: Rule;
  spaceId: string;
  categories: readonly Category[] | undefined;
  methods: readonly PaymentMethod[] | undefined;
  onOpenChange: (v: boolean) => void;
}) {
  const [text, setText] = useState(rule?.matchText ?? "");
  const [categoryId, setCategoryId] = useState(rule?.setCategoryId ?? NONE);
  const [setMethodId, setSetMethodId] = useState(rule?.setPaymentMethodId ?? NONE);
  const [onlyMethodId, setOnlyMethodId] = useState(rule?.paymentMethodId ?? NONE);
  const [minStr, setMinStr] = useState(amountText(rule?.minAmount ?? null));
  const [maxStr, setMaxStr] = useState(amountText(rule?.maxAmount ?? null));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const all = methods ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (text.trim().length < 2) return setErr("Escribí qué tiene que decir la descripción.");
    if (!categoryId && !setMethodId) return setErr("Elegí una categoría o un medio de pago para completar.");
    const minAmount = parseAmount(minStr);
    const maxAmount = parseAmount(maxStr);
    if ((minStr.trim() && minAmount == null) || (maxStr.trim() && maxAmount == null)) {
      return setErr("Los montos tienen que ser mayores a 0.");
    }
    if (minAmount != null && maxAmount != null && minAmount > maxAmount) {
      return setErr("El monto máximo tiene que ser mayor o igual al mínimo.");
    }
    const input: RuleInput = {
      matchText: text.trim(),
      paymentMethodId: onlyMethodId || null,
      minAmount,
      maxAmount,
      setCategoryId: categoryId || null,
      setPaymentMethodId: setMethodId || null,
    };
    setSaving(true);
    try {
      if (rule) await updateRule(rule.id, input, spaceId);
      else await createRule(input, spaceId);
      invalidateRules();
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!rule) return;
    const ok = await confirm({
      title: "¿Eliminar esta regla?",
      description: "Los gastos ya cargados no cambian.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteRule(rule.id, spaceId);
      invalidateRules();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar");
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regla" : "Nueva regla"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-text">Si la descripción dice</Label>
            <Input
              id="rule-text"
              value={text}
              maxLength={60}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej.: Carrefour"
              autoFocus
            />
            <p className="text-caption text-ink-muted">Busca palabras enteras, sin importar mayúsculas ni tildes.</p>
          </div>

          <div>
            <Label htmlFor="rule-category">Poner la categoría</Label>
            <CategorySelect
              id="rule-category"
              value={categoryId}
              onValueChange={(v) => setCategoryId(v)}
              categories={categories}
              emptyLabel="No cambiar la categoría"
              className="mt-1.5 w-full"
            />
          </div>

          <div>
            <Label htmlFor="rule-set-method">Poner el medio de pago</Label>
            <MethodSelect
              id="rule-set-method"
              value={setMethodId}
              onValueChange={setSetMethodId}
              methods={all}
              emptyLabel="No completar"
            />
            <p className="mt-1.5 text-caption text-ink-muted">Solo si no elegiste otro al cargar el gasto.</p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-caption font-semibold text-ink">Solo cuando (opcional)</legend>
            <div>
              <Label htmlFor="rule-only-method">Pagás con</Label>
              <MethodSelect
                id="rule-only-method"
                value={onlyMethodId}
                onValueChange={setOnlyMethodId}
                methods={all}
                emptyLabel="Cualquier medio"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rule-min">Monto desde</Label>
                <Input
                  id="rule-min"
                  inputMode="decimal"
                  value={minStr}
                  onChange={(e) => setMinStr(e.target.value)}
                  placeholder="Sin mínimo"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="rule-max">Hasta</Label>
                <Input
                  id="rule-max"
                  inputMode="decimal"
                  value={maxStr}
                  onChange={(e) => setMaxStr(e.target.value)}
                  placeholder="Sin máximo"
                  className="mt-1.5"
                />
              </div>
            </div>
          </fieldset>

          {err && (
            <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-caption text-negative">
              {err}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? "Guardando…" : rule ? "Guardar" : "Crear regla"}
          </Button>
          {rule && (
            <Button
              type="button"
              variant="ghost"
              className="self-center text-negative hover:bg-negative-soft hover:text-negative"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando…" : "Eliminar regla"}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
