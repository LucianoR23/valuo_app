import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirm } from "@/lib/confirm";
import { API, requests, server, signIn } from "@/test/msw";
import { WithSWR } from "@/test/spaces";
import { ConnectConsent, connectNotice } from "./connect-consent";
import { ConnectionsCard } from "./connections-card";

// Connecting your own AI assistant (plan 8.6): the consent screen and the
// list in Ajustes.

vi.mock("@/lib/confirm", () => ({ confirm: vi.fn() }));

const REQ = {
  id: "req-1",
  clientName: "Claude",
  redirectHost: "claude.ai",
  scopes: ["finance:read"],
  expiresAt: "2026-11-16T20:10:00Z",
};

const assign = vi.fn();

beforeEach(() => {
  signIn();
  vi.mocked(confirm).mockReset();
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => vi.unstubAllGlobals());

describe("ConnectConsent (plan 8.6)", () => {
  it("shows what the assistant asks for and where it goes back", async () => {
    server.use(http.get(`${API}/connection-requests/req-1`, () => HttpResponse.json(REQ)));
    render(<ConnectConsent requestId="req-1" />, { wrapper: WithSWR });
    expect(await screen.findByText("Claude quiere conectarse")).toBeInTheDocument();
    expect(screen.getByText(/Ver tus gastos, ingresos, tarjetas/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(connectNotice("Claude"));
    expect(screen.getByText("claude.ai")).toBeInTheDocument();
  });

  it("allows and sends the browser back to the assistant", async () => {
    server.use(
      http.get(`${API}/connection-requests/req-1`, () => HttpResponse.json(REQ)),
      http.post(`${API}/connection-requests/req-1`, () => HttpResponse.json({ redirectTo: "https://claude.ai/cb?code=x&state=s" })),
    );
    render(<ConnectConsent requestId="req-1" />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Permitir" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?code=x&state=s"));
    const post = requests().find((r) => r.method === "POST");
    expect(JSON.parse(post!.body)).toEqual({ approve: true });
    expect(post!.headers.get("X-Household-ID")).toBeNull();
  });

  it("cancels with approve false", async () => {
    server.use(
      http.get(`${API}/connection-requests/req-1`, () => HttpResponse.json(REQ)),
      http.post(`${API}/connection-requests/req-1`, () => HttpResponse.json({ redirectTo: "https://claude.ai/cb?error=access_denied" })),
    );
    render(<ConnectConsent requestId="req-1" />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?error=access_denied"));
    expect(JSON.parse(requests().find((r) => r.method === "POST")!.body)).toEqual({ approve: false });
  });

  it("explains an expired or used request", async () => {
    server.use(http.get(`${API}/connection-requests/req-1`, () => HttpResponse.json({ code: "not_found", message: "x" }, { status: 404 })));
    render(<ConnectConsent requestId="req-1" />, { wrapper: WithSWR });
    expect(await screen.findByText("Este pedido ya no sirve")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Permitir" })).not.toBeInTheDocument();
  });

  it("explains a link without a request", () => {
    render(<ConnectConsent requestId={null} />, { wrapper: WithSWR });
    expect(screen.getByText("Este pedido ya no sirve")).toBeInTheDocument();
  });

  it("stays on the screen when the email is not verified", async () => {
    server.use(
      http.get(`${API}/connection-requests/req-1`, () => HttpResponse.json(REQ)),
      http.post(`${API}/connection-requests/req-1`, () => HttpResponse.json({ code: "email_unverified", message: "x" }, { status: 403 })),
    );
    render(<ConnectConsent requestId="req-1" />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Permitir" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Permitir" })).toBeEnabled());
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("ConnectionsCard (plan 8.6)", () => {
  it("shows the empty state", async () => {
    server.use(http.get(`${API}/connections`, () => HttpResponse.json({ items: [] })));
    render(<ConnectionsCard />, { wrapper: WithSWR });
    expect(await screen.findByText("No conectaste ningún asistente")).toBeInTheDocument();
  });

  it("lists connections and disconnects after confirming", async () => {
    let items = [
      { id: "c1", clientName: "Claude", scopes: ["finance:read"], createdAt: "2026-11-14T18:00:00Z", lastUsedAt: "2026-11-15T18:00:00Z" },
    ];
    server.use(
      http.get(`${API}/connections`, () => HttpResponse.json({ items })),
      http.delete(`${API}/connections/c1`, () => {
        items = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.mocked(confirm).mockResolvedValue(true);
    render(<ConnectionsCard />, { wrapper: WithSWR });
    expect(await screen.findByText("Claude")).toBeInTheDocument();
    expect(screen.getByText(/Conectado el 14 nov.*Último uso el 15 nov/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(vi.mocked(confirm).mock.calls[0][0].destructive).toBe(true);
    expect(await screen.findByText("No conectaste ningún asistente")).toBeInTheDocument();
  });

  it("keeps the connection when the confirm is declined", async () => {
    server.use(
      http.get(`${API}/connections`, () =>
        HttpResponse.json({ items: [{ id: "c1", clientName: "Claude", scopes: [], createdAt: "2026-11-14T18:00:00Z", lastUsedAt: null }] }),
      ),
    );
    vi.mocked(confirm).mockResolvedValue(false);
    render(<ConnectionsCard />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    expect(requests().some((r) => r.method === "DELETE")).toBe(false);
    expect(screen.getByText(/Todavía no lo usó/)).toBeInTheDocument();
  });
});
