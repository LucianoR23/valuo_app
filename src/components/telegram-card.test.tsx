import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirm } from "@/lib/confirm";
import { API, requests, server, signIn } from "@/test/msw";
import { WithSWR } from "@/test/spaces";
import { TELEGRAM_NOTICE, TelegramCard } from "./telegram-card";

// Telegram bot card in Ajustes (plan 3.6).

vi.mock("@/lib/confirm", () => ({ confirm: vi.fn() }));

const LINK = "https://t.me/test_bot?start=abc";

beforeEach(() => {
  signIn();
  vi.mocked(confirm).mockReset();
});

describe("TelegramCard (plan 3.6)", () => {
  it("is hidden while the bot is off", async () => {
    server.use(http.get(`${API}/telegram/link`, () => HttpResponse.json({ code: "telegram_off", message: "x" }, { status: 503 })));
    const { container } = render(<TelegramCard />, { wrapper: WithSWR });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("links after the notice and waits for Telegram", async () => {
    let linked = false;
    server.use(
      http.get(`${API}/telegram/link`, () =>
        HttpResponse.json(linked ? { linked: true, linkedAt: "2026-11-14T18:00:00Z" } : { linked: false, linkedAt: null }),
      ),
      http.post(`${API}/telegram/link`, () => HttpResponse.json({ url: LINK, expiresAt: "2026-11-14T18:10:00Z" }, { status: 201 })),
    );
    vi.mocked(confirm).mockResolvedValue(true);
    render(<TelegramCard />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Conectar" }));
    expect(vi.mocked(confirm).mock.calls[0][0].description).toBe(TELEGRAM_NOTICE);
    const open = await screen.findByRole("link", { name: /Abrir Telegram/ });
    expect(open).toHaveAttribute("href", LINK);
    expect(open).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("status")).toHaveTextContent("Esperando la conexión");

    linked = true;
    expect(await screen.findByText("Conectado", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/^Desde el 14 nov/)).toBeInTheDocument();
  });

  it("cancels a link that was not used", async () => {
    server.use(
      http.get(`${API}/telegram/link`, () => HttpResponse.json({ linked: false, linkedAt: null })),
      http.post(`${API}/telegram/link`, () => HttpResponse.json({ url: LINK, expiresAt: "2026-11-14T18:10:00Z" }, { status: 201 })),
    );
    vi.mocked(confirm).mockResolvedValue(true);
    render(<TelegramCard />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Conectar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Conectar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir Telegram/ })).not.toBeInTheDocument();
  });

  it("does nothing when the notice is declined", async () => {
    server.use(http.get(`${API}/telegram/link`, () => HttpResponse.json({ linked: false, linkedAt: null })));
    vi.mocked(confirm).mockResolvedValue(false);
    render(<TelegramCard />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Conectar" }));
    expect(requests().some((r) => r.method === "POST" && r.path.endsWith("/telegram/link"))).toBe(false);
    expect(screen.getByRole("button", { name: "Conectar" })).toBeInTheDocument();
  });

  it("asks to verify the email first", async () => {
    server.use(
      http.get(`${API}/telegram/link`, () => HttpResponse.json({ linked: false, linkedAt: null })),
      http.post(`${API}/telegram/link`, () => HttpResponse.json({ code: "email_not_verified", message: "verificá" }, { status: 403 })),
    );
    vi.mocked(confirm).mockResolvedValue(true);
    render(<TelegramCard />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Conectar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar" })).toBeEnabled());
    expect(screen.queryByRole("link", { name: /Abrir Telegram/ })).not.toBeInTheDocument();
  });

  it("unlinks after confirming", async () => {
    let linked = true;
    server.use(
      http.get(`${API}/telegram/link`, () =>
        HttpResponse.json(linked ? { linked: true, linkedAt: "2026-11-14T18:00:00Z" } : { linked: false, linkedAt: null }),
      ),
      http.delete(`${API}/telegram/link`, () => {
        linked = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.mocked(confirm).mockResolvedValue(true);
    render(<TelegramCard />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    expect(vi.mocked(confirm).mock.calls[0][0].destructive).toBe(true);
    expect(await screen.findByRole("button", { name: "Conectar" })).toBeInTheDocument();
  });
});
