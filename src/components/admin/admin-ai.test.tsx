import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirm } from "@/lib/confirm";
import type { AdminAI as Panel } from "@/lib/api/hooks";
import { API, requests, server, signIn } from "@/test/msw";
import { WithSWR } from "@/test/spaces";
import { useAuthStore } from "@/stores/auth";
import { AdminAI, usd } from "./admin-ai";

// AI spend section of the superadmin panel (plan 8.1, §8.6).

vi.mock("@/lib/confirm", () => ({ confirm: vi.fn() }));

function panel(over: Partial<Panel> = {}): Panel {
  return {
    enabled: true,
    limits: { dailyBudgetMicroUsd: 3_000_000, userDailyMicroUsd: 50_000, perMinute: 10, perDay: 100 },
    today: { costMicroUsd: 1_500_000, calls: 42, errors: 2, blocked: 3, avgLatencyMs: 950 },
    month: { costMicroUsd: 12_340_000, calls: 900 },
    byTask: [
      { task: "parse_audio", calls: 10, errors: 1, blocked: 0, costMicroUsd: 4300 },
      { task: "parse_expense", calls: 30, errors: 0, blocked: 3, costMicroUsd: 3750 },
    ],
    topUsers: [{ userId: "u2", email: "ana.perez@example.test", calls: 25, blocked: 3, offTopic: 0, costMicroUsd: 3125 }],
    suspended: [],
    ...over,
  };
}

function serve(p: Panel) {
  server.use(http.get(`${API}/admin/ai`, () => HttpResponse.json(p)));
}

beforeEach(() => {
  signIn();
  const user = useAuthStore.getState().user!;
  useAuthStore.setState({ user: { ...user, isSuperadmin: true } });
});

describe("AdminAI (plan 8.1)", () => {
  it("formats millionths of a dollar", () => {
    expect(usd(3_000_000)).toMatch(/^US\$\s3,00$/);
    expect(usd(125)).toMatch(/^US\$\s0,0001$/);
    expect(usd(12_340_000)).toMatch(/^US\$\s12,34$/);
  });

  it("shows today's spend against the budget, by task and by person", async () => {
    serve(panel());
    render(<AdminAI />, { wrapper: WithSWR });
    const stats = await screen.findByRole("region", { name: "Gasto en IA" });
    expect(within(stats).getByText(/50% de US\$\s3,00 por día/)).toBeInTheDocument();
    expect(within(stats).getByRole("progressbar", { name: "Presupuesto de hoy usado" })).toHaveAttribute("aria-valuenow", "50");
    expect(within(stats).getByText("2 con error · 3 frenados por los topes")).toBeInTheDocument();
    expect(screen.getByText("Voz")).toBeInTheDocument();
    expect(screen.getByText("Carga en una frase")).toBeInTheDocument();
    expect(screen.getByText(/30 pedidos · 3 frenados/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ana.perez@example.test" })).toHaveAttribute("href", "/admin/cuentas/u2");
    expect(screen.getByText(/Topes por persona: US\$\s0,05 por día, 10 pedidos por minuto y 100 por día\./)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says when AI is off and when the budget ran out", async () => {
    serve(panel({ enabled: false, byTask: [], topUsers: [] }));
    const { unmount } = render(<AdminAI />, { wrapper: WithSWR });
    expect(await screen.findByText(/La IA está apagada/)).toBeInTheDocument();
    expect(screen.getByText("Todavía no hubo pedidos a la IA este mes.")).toBeInTheDocument();
    unmount();

    serve(panel({ today: { costMicroUsd: 3_200_000, calls: 1, errors: 0, blocked: 0, avgLatencyMs: 1 } }));
    render(<AdminAI />, { wrapper: WithSWR });
    expect(await screen.findByText(/Se llegó al presupuesto de hoy/)).toBeInTheDocument();
  });

  it("lists accounts with the AI paused and reactivates one", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    serve(
      panel({
        topUsers: [{ userId: "u3", email: "bot.abuse@example.test", calls: 6, blocked: 1, offTopic: 5, costMicroUsd: 600 }],
        suspended: [{ userId: "u3", email: "bot.abuse@example.test", until: "2026-11-15T18:00:00Z" }],
      }),
    );
    server.use(http.post(`${API}/admin/ai/users/u3/resume`, () => new HttpResponse(null, { status: 204 })));
    render(<AdminAI />, { wrapper: WithSWR });
    expect(await screen.findByText(/6 pedidos · 1 frenados · 5 fuera de tema/)).toBeInTheDocument();
    const paused = screen.getByRole("region", { name: "IA pausada" });
    expect(within(paused).getByRole("link", { name: "bot.abuse@example.test" })).toHaveAttribute("href", "/admin/cuentas/u3");
    expect(within(paused).getByText(/^Hasta el 15 nov/)).toBeInTheDocument();
    await userEvent.click(within(paused).getByRole("button", { name: "Reactivar" }));
    expect(vi.mocked(confirm).mock.calls[0][0].description).toMatch(/bot.abuse@example.test vuelve a poder usar la IA/);
    await waitFor(() => expect(requests().some((r) => r.method === "POST" && r.path.endsWith("/admin/ai/users/u3/resume"))).toBe(true));
  });

  it("says when no account has the AI paused", async () => {
    serve(panel());
    render(<AdminAI />, { wrapper: WithSWR });
    expect(await screen.findByText(/Ninguna cuenta tiene la IA pausada/)).toBeInTheDocument();
  });
});
