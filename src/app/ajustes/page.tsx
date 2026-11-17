import { AppShell } from "@/components/app-shell";
import { AppearanceCard } from "@/components/appearance-card";
import { PersonalFxSource } from "@/components/personal-fx-source";
import { ProfileConfig } from "@/components/profile-config";
import { TelegramCard } from "@/components/telegram-card";
import { Bell, Bot } from "lucide-react";
import { InfoHelp, type InfoHelpContent } from "@/components/ui/info-help";
import { MenuGroup, MenuItem } from "@/components/ui/menu-list";
import { PageHeader } from "@/components/ui/page-header";

const AJUSTES_HELP: InfoHelpContent = {
  titulo: "Ajustes",
  acciones: [
    "Tocá tu nombre o tu email para editarlos.",
    "Elegí con qué dólar se pasan a pesos tus gastos e ingresos en otra moneda (MEP por defecto).",
    "Elegí el tema: por defecto sigue el de tu dispositivo.",
    "En Notificaciones elegís qué avisos te llegan y tu horario de silencio.",
    "En Telegram conectás el bot para cargar gastos con un mensaje, una nota de voz o una foto.",
    "En Asistentes de IA ves y desconectás el Claude o ChatGPT que conectaste para preguntarle por tu plata.",
  ],
  consideraciones: [
    "Las tarjetas y medios de pago están en Tarjetas; el hogar y sus miembros, en Hogar.",
  ],
  relacionado: [
    { label: "Tarjetas", href: "/tarjetas" },
    { label: "Hogar", href: "/hogar" },
    { label: "Seguridad y privacidad", href: "/seguridad" },
  ],
};

export default function Page() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-4">
        <PageHeader
          title="Ajustes"
          description="Tu perfil, tu cotización y cómo se ve la app."
          back={{ href: "/mas", label: "Volver a Más" }}
          action={<InfoHelp content={AJUSTES_HELP} size="icon" />}
          className="mb-0"
        />
        <ProfileConfig />
        <PersonalFxSource />
        <AppearanceCard />
        <TelegramCard />
        <MenuGroup title="Avisos">
          <MenuItem icon={Bell} label="Notificaciones" href="/ajustes/notificaciones" />
        </MenuGroup>
        <MenuGroup title="Conexiones">
          <MenuItem icon={Bot} label="Asistentes de IA" href="/ajustes/conexiones" />
        </MenuGroup>
      </div>
    </AppShell>
  );
}
