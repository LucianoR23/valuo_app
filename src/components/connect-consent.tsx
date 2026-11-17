"use client";

import { useState } from "react";
import { Check, Link2Off, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuGroup, MenuRow } from "@/components/ui/menu-list";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { ApiError } from "@/lib/api/errors";
import { useConnectionRequest } from "@/lib/api/hooks";
import { decideConnectionRequest } from "@/lib/api/mutations";
import { toastError } from "@/lib/toast";

/** What each scope lets the assistant do, in the person's words. */
export const SCOPE_LABELS: Record<string, string> = {
  "finance:read": "Ver tus gastos, ingresos, tarjetas, presupuestos y resúmenes, de Mi plata y del Hogar.",
};

/** Plan 8.6: told before connecting (consent). */
export function connectNotice(clientName: string): string {
  return `Lo que ${clientName} lea de ${brand.name} va a ir a la empresa de ese asistente y queda bajo sus condiciones, no las nuestras. No puede borrar ni cambiar nada, y lo podés desconectar cuando quieras en Ajustes.`;
}

/**
 * Consent screen of an AI assistant connection (plan 8.6): what it asks
 * for, the notice, and Permitir / Cancelar. Either answer sends the browser
 * back to the assistant.
 */
export function ConnectConsent({ requestId }: { requestId: string | null }) {
  const { data, error, isLoading } = useConnectionRequest(requestId);
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);

  if (!requestId || error) {
    return (
      <EmptyState
        icon={Link2Off}
        title="Este pedido ya no sirve"
        description="Venció o ya se usó. Volvé a conectar desde tu asistente."
      />
    );
  }
  if (isLoading || !data) {
    return (
      <MenuGroup>
        <MenuRow>
          <Skeleton className="h-24 w-full" />
        </MenuRow>
      </MenuGroup>
    );
  }

  async function answer(approve: boolean) {
    if (!requestId) return;
    setBusy(approve ? "allow" : "deny");
    try {
      const { redirectTo } = await decideConnectionRequest(requestId, approve);
      window.location.assign(redirectTo);
    } catch (err) {
      setBusy(null);
      if (err instanceof ApiError && err.status === 403) {
        toastError(err, "Verificá tu email para conectar tu asistente.");
      } else if (err instanceof ApiError && err.status === 404) {
        toastError(err, "El pedido venció. Volvé a conectar desde tu asistente.");
      } else {
        toastError(err, "No pudimos responder. Probá de nuevo.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <MenuGroup title={`${data.clientName} quiere conectarse`}>
        {data.scopes.map((scope) => (
          <MenuRow key={scope} className="items-start gap-3">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
            <span>{SCOPE_LABELS[scope] ?? scope}</span>
          </MenuRow>
        ))}
      </MenuGroup>
      <Alert>{connectNotice(data.clientName)}</Alert>
      <p className="text-caption text-ink-muted">
        Después de responder volvés a <span className="font-semibold text-ink">{data.redirectHost}</span>. Si no
        reconocés ese sitio, cancelá.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy !== null} onClick={() => void answer(true)}>
          {busy === "allow" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Permitir
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void answer(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
