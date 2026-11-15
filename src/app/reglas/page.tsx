import { AppShell } from "@/components/app-shell";
import { RulesManager } from "@/components/rules-manager";
import { InfoHelp, type InfoHelpContent } from "@/components/ui/info-help";

const REGLAS_HELP: InfoHelpContent = {
  titulo: "Reglas",
  acciones: [
    "Creá una regla con el botón +: qué tiene que decir la descripción y qué completar.",
    "Tocá una regla para cambiarla o eliminarla.",
    "Si cambiás una categoría que te sugerimos, al guardar te ofrecemos crear la regla.",
  ],
  consideraciones: [
    "Funcionan en Cargar gasto, en «Contalo como te salga» y en el bot de Telegram.",
    "Busca palabras enteras: «Carrefour» encuentra «Carrefour Palermo», no «Carrefourcito».",
    "El medio de pago solo se completa si no elegiste otro.",
    "Cada espacio tiene sus reglas. Las del Hogar las comparten sus miembros; el medio de pago de una regla solo se usa para quien es dueño de ese medio.",
    "Si varias reglas coinciden, gana la que tiene más condiciones.",
  ],
  relacionado: [
    { label: "Agregar gasto", href: "/agregar" },
    { label: "Categorías", href: "/categorias" },
  ],
};

export default function Page() {
  return (
    <AppShell>
      <RulesManager help={<InfoHelp content={REGLAS_HELP} size="icon" />} />
    </AppShell>
  );
}
