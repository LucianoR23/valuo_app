import { AppShell } from "@/components/app-shell";
import { ConnectConsent } from "@/components/connect-consent";
import { PageHeader } from "@/components/ui/page-header";
import { brand } from "@/config/brand";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // /oauth/authorize sends the browser here with the pending request (plan 8.6).
  const params = await searchParams;
  const pedido = typeof params.pedido === "string" ? params.pedido : null;
  return (
    <AppShell focus>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-4">
        <PageHeader
          title="Conectar tu asistente"
          description={`Un asistente de IA pide leer tu plata en ${brand.name}.`}
          className="mb-0"
        />
        <ConnectConsent requestId={pedido} />
      </div>
    </AppShell>
  );
}
