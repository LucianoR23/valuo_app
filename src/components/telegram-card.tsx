"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuGroup, MenuRow } from "@/components/ui/menu-list";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { useTelegramLink } from "@/lib/api/hooks";
import { createTelegramLink, unlinkTelegram } from "@/lib/api/mutations";
import { confirm } from "@/lib/confirm";
import { fmtDateShort } from "@/lib/format";
import { toast, toastError } from "@/lib/toast";

/** Shown before linking (plan §13: bots linking notice). */
export const TELEGRAM_NOTICE =
  "Los mensajes, audios y fotos que le mandes al bot pasan por los servidores de Telegram y no tienen cifrado de punta a punta. Los usamos solo para cargar tus gastos y no los guardamos.";

const FOOTER = "Mandale un gasto escrito, una nota de voz o la foto de un ticket. Te lo muestra antes de guardarlo.";

/** "14 nov 2026", on the device's calendar day, like the rest of the app. */
function linkedSince(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmtDateShort(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

/**
 * Telegram bot (plan 3.6): link the chat with a one-time link, or unlink
 * it. Hidden while the bot is off on the server.
 */
export function TelegramCard() {
  // While a link is open, check every few seconds until the chat is linked.
  const [pending, setPending] = useState<{ url: string; expiresAt: string } | null>(null);
  const { data, error, isLoading, mutate } = useTelegramLink({
    poll: pending !== null,
    onSuccess: (d) => {
      if (d.linked && pending) {
        setPending(null);
        toast.success("Telegram conectado");
      }
    },
  });
  const [busy, setBusy] = useState(false);

  if (error) return null;
  if (isLoading || !data) {
    return (
      <MenuGroup title="Telegram">
        <MenuRow>
          <Skeleton className="h-9 w-full" />
        </MenuRow>
      </MenuGroup>
    );
  }

  async function connect() {
    const ok = await confirm({ title: "Antes de conectar Telegram", description: TELEGRAM_NOTICE, confirmLabel: "Entendido, conectar" });
    if (!ok) return;
    setBusy(true);
    try {
      setPending(await createTelegramLink());
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toastError(err, "Verificá tu email para conectar Telegram.");
      } else {
        toastError(err, "No pudimos crear el link. Probá de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: "¿Desconectar Telegram?",
      description: "El bot deja de cargar tus gastos. Podés volver a conectarlo cuando quieras.",
      confirmLabel: "Desconectar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await unlinkTelegram();
      await mutate({ linked: false, linkedAt: null }, { revalidate: true });
      toast.success("Telegram desconectado");
    } catch (err) {
      toastError(err, "No pudimos desconectarlo. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (data.linked) {
    return (
      <MenuGroup title="Telegram" footer={FOOTER}>
        <MenuRow className="justify-between">
          <span className="min-w-0">
            Conectado
            {data.linkedAt ? <span className="block text-caption text-ink-muted">Desde el {linkedSince(data.linkedAt)}</span> : null}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void disconnect()}>
            Desconectar
          </Button>
        </MenuRow>
      </MenuGroup>
    );
  }

  if (pending && !data.linked) {
    return (
      <MenuGroup title="Telegram" footer="El link vence en 10 minutos. Si se vence, pedí otro.">
        <MenuRow className="flex-col items-stretch gap-3">
          <p className="text-body text-ink">Abrí Telegram y tocá «Iniciar». Esta pantalla se actualiza sola.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton={false} render={<a href={pending.url} target="_blank" rel="noopener noreferrer" />}>
              <Send className="size-4" />
              Abrir Telegram
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <span className="inline-flex items-center gap-2 text-caption text-ink-muted" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Esperando la conexión
            </span>
          </div>
        </MenuRow>
      </MenuGroup>
    );
  }

  return (
    <MenuGroup title="Telegram" footer={FOOTER}>
      <MenuRow className="justify-between">
        <span className="min-w-0">Cargá gastos desde Telegram</span>
        <Button type="button" size="sm" disabled={busy} onClick={() => void connect()}>
          Conectar
        </Button>
      </MenuRow>
    </MenuGroup>
  );
}
