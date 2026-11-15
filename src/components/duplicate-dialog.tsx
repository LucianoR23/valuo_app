"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { dayMonth } from "@/lib/statements";
import type { ExpenseDuplicate } from "@/lib/api/mutations";

export type DuplicateChoice = "complete" | "save" | "cancel";

/**
 * Warns before saving an expense that looks already loaded (plan 3.9). A
 * pending bill of a variable recurring expense is offered to be completed
 * with the new amount instead; anything else asks to save it anyway.
 */
export function DuplicateDialog({
  duplicates,
  amount,
  currency,
  me,
  busy,
  onChoose,
}: {
  /** null while closed. */
  duplicates: ExpenseDuplicate[] | null;
  amount: number;
  currency: string;
  me: string | undefined;
  busy: boolean;
  onChoose: (choice: DuplicateChoice) => void;
}) {
  const first = duplicates?.[0];
  const pending = first?.status === "draft";
  return (
    <Dialog
      open={!!first}
      onOpenChange={(open) => {
        if (!open && !busy) onChoose("cancel");
      }}
    >
      {first && (
        <DialogContent layout="center" className="sm:max-w-sm">
          {pending ? (
            <DialogHeader>
              <DialogTitle>
                Tenés pendiente «{first.description}» del {dayMonth(first.spentAt)}
              </DialogTitle>
              <DialogDescription>
                ¿Es esa factura? La completamos con{" "}
                <Money amount={amount} currency={currency} /> en vez de cargar
                otro gasto.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <DialogHeader>
              <DialogTitle>¿Ya lo cargaste?</DialogTitle>
              <DialogDescription>
                {duplicates.length === 1
                  ? "Hay un gasto parecido:"
                  : "Hay gastos parecidos:"}
              </DialogDescription>
              <ul className="flex flex-col gap-1 text-sm">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {d.description} ·{" "}
                    <Money amount={d.amount} currency={d.currency} /> ·{" "}
                    {dayMonth(d.spentAt)}
                    {d.createdBy !== me && d.createdByName
                      ? ` · ${d.createdByName}`
                      : ""}
                  </li>
                ))}
              </ul>
            </DialogHeader>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onChoose(pending ? "save" : "cancel")}
            >
              {pending ? "Guardar aparte" : "No guardar"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => onChoose(pending ? "complete" : "save")}
            >
              {pending ? "Completar pendiente" : "Guardar igual"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
