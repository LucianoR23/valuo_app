"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuGroup, MenuRow } from "@/components/ui/menu-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnections } from "@/lib/api/hooks";
import { deleteConnection } from "@/lib/api/mutations";
import { confirm } from "@/lib/confirm";
import { fmtDateShort } from "@/lib/format";
import { toast, toastError } from "@/lib/toast";

/** "14 nov 2026", on the device's calendar day. */
function day(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmtDateShort(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

/** Connected AI assistants (plan 8.6), each one revocable. */
export function ConnectionsCard() {
  const { data, error, isLoading, mutate } = useConnections();
  const [busy, setBusy] = useState<string | null>(null);

  if (error) {
    return (
      <MenuGroup title="Asistentes conectados">
        <MenuRow>No pudimos cargar tus conexiones. Probá de nuevo en un rato.</MenuRow>
      </MenuGroup>
    );
  }
  if (isLoading || !data) {
    return (
      <MenuGroup title="Asistentes conectados">
        <MenuRow>
          <Skeleton className="h-9 w-full" />
        </MenuRow>
      </MenuGroup>
    );
  }
  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No conectaste ningún asistente"
        description="Agregá este servicio como conector en Claude o ChatGPT y aprobalo acá cuando te lo pida."
      />
    );
  }

  async function disconnect(id: string, name: string) {
    const ok = await confirm({
      title: `¿Desconectar ${name}?`,
      description: "Deja de poder leer tu plata enseguida. Para volver a usarlo lo tenés que conectar de nuevo.",
      confirmLabel: "Desconectar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(id);
    try {
      await deleteConnection(id);
      await mutate();
      toast.success(`${name} desconectado`);
    } catch (err) {
      toastError(err, "No pudimos desconectarlo. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <MenuGroup title="Asistentes conectados" footer="Solo pueden leer. No pueden borrar ni cambiar nada.">
      {data.items.map((c) => (
        <MenuRow key={c.id} className="justify-between">
          <span className="min-w-0">
            {c.clientName}
            <span className="block text-caption text-ink-muted">
              Conectado el {day(c.createdAt)}
              {c.lastUsedAt ? ` · Último uso el ${day(c.lastUsedAt)}` : " · Todavía no lo usó"}
            </span>
          </span>
          <Button type="button" variant="outline" size="sm" disabled={busy === c.id} onClick={() => void disconnect(c.id, c.clientName)}>
            Desconectar
          </Button>
        </MenuRow>
      ))}
    </MenuGroup>
  );
}
