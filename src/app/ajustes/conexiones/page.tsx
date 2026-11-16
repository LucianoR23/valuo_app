import { AppShell } from "@/components/app-shell";
import { ConnectionsCard } from "@/components/connections-card";
import { InfoHelp, type InfoHelpContent } from "@/components/ui/info-help";
import { PageHeader } from "@/components/ui/page-header";

const HELP: InfoHelpContent = {
  titulo: "Asistentes de IA",
  acciones: [
    "Conectá tu propio Claude o ChatGPT para preguntarle por tu plata, por ejemplo «¿cuánto gasté en súper este mes?» o «¿me conviene comprar en 6 cuotas?».",
    "En tu asistente agregá este servicio como conector. Te va a traer a una pantalla para aprobarlo.",
    "Desde acá ves qué asistentes conectaste y los podés desconectar.",
  ],
  consideraciones: [
    "Solo pueden leer: no pueden borrar ni cambiar nada.",
    "Lo que lean va a la empresa de ese asistente y queda bajo sus condiciones.",
    "Cada conexión puede hacer hasta 60 consultas por hora y 500 por día.",
  ],
  relacionado: [{ label: "Seguridad y privacidad", href: "/seguridad" }],
};

export default function Page() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-4">
        <PageHeader
          title="Asistentes de IA"
          description="Tu Claude o ChatGPT, conectados a tu plata."
          back={{ href: "/ajustes", label: "Volver a Ajustes" }}
          action={<InfoHelp content={HELP} size="icon" />}
          className="mb-0"
        />
        <ConnectionsCard />
      </div>
    </AppShell>
  );
}
