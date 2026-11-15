import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAmount, RulesManager } from "./rules-manager";
import { API, requests, server, signIn } from "@/test/msw";
import { confirm } from "@/lib/confirm";
import { hogarSpace, personalSpace, WithSWR } from "@/test/spaces";

vi.mock("@/lib/confirm", () => ({ confirm: vi.fn() }));

const category = (id: string, name: string) => ({
  id, householdId: personalSpace.id, parentId: null, name, icon: "tag", color: "#E76F51",
  createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
});
const method = (id: string, name: string) => ({
  id, ownerUserId: "u1", name, kind: "cash", allowsInstallments: false, isActive: true, createdAt: "2026-01-01T00:00:00Z",
});
const rule = (over: Record<string, unknown>) => ({
  id: "r1", householdId: personalSpace.id, createdBy: "u1", matchText: "Carrefour",
  paymentMethodId: null, minAmount: null, maxAmount: null, setCategoryId: null, setPaymentMethodId: null,
  createdAt: "2026-11-14T12:00:00Z", updatedAt: "2026-11-14T12:00:00Z", ...over,
});

function api(rules: unknown[], households: unknown[] = [personalSpace]) {
  server.use(
    http.get(`${API}/households`, () => HttpResponse.json(households)),
    http.get(`${API}/categories`, () => HttpResponse.json([category("super", "Súper"), category("taxi", "Taxi y apps")])),
    http.get(`${API}/payment-methods`, () => HttpResponse.json([method("cash", "Efectivo"), method("visa", "Visa Galicia")])),
    http.get(`${API}/rules`, ({ request }) =>
      HttpResponse.json(request.headers.get("x-household-id") === personalSpace.id ? rules : []),
    ),
    http.post(`${API}/rules`, () => HttpResponse.json(rule({}), { status: 201 })),
    http.patch(`${API}/rules/:id`, () => HttpResponse.json(rule({}))),
    http.delete(`${API}/rules/:id`, () => new HttpResponse(null, { status: 204 })),
  );
}

const lastBody = (method: string) => {
  const req = requests().filter((r) => r.method === method && r.path.startsWith("/rules")).at(-1);
  return req ? JSON.parse(req.body || "{}") : undefined;
};

beforeEach(() => signIn({ householdId: personalSpace.id }));

// The screen waits for the spaces, then for the rules: give the first load
// time under a busy CI runner, as telegram-card.test does.
const LOAD = { timeout: 5000 };

describe("parseAmount", () => {
  it("reads es-AR amounts", () => {
    expect(parseAmount("20.000")).toBe(20000);
    expect(parseAmount("$ 1.500,50")).toBe(1500.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("RulesManager (plan 3.8)", () => {
  it("lists the rules with what they fill and when", async () => {
    api([
      rule({ setCategoryId: "super", setPaymentMethodId: "visa" }),
      rule({ id: "r2", matchText: "Uber", paymentMethodId: "other", minAmount: 20000, setCategoryId: "taxi" }),
    ]);
    render(<RulesManager />, { wrapper: WithSWR });
    expect(await screen.findByText("«Carrefour» → Súper · Visa Galicia", {}, LOAD)).toBeInTheDocument();
    expect(screen.getByText("«Uber» → Taxi y apps")).toBeInTheDocument();
    expect(screen.getByText("solo con un medio de otro miembro · desde $ 20.000")).toBeInTheDocument();
  });

  it("shows an empty state and creates a rule", async () => {
    api([]);
    render(<RulesManager />, { wrapper: WithSWR });
    await screen.findByText("Todavía no tenés reglas", {}, LOAD);
    await userEvent.click(screen.getByRole("button", { name: "Crear regla" }));
    await userEvent.type(screen.getByLabelText("Si la descripción dice"), "Uber");
    await userEvent.click(screen.getByRole("button", { name: "Crear regla" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí una categoría o un medio de pago");

    await userEvent.click(screen.getByLabelText("Poner la categoría"));
    await userEvent.click(await screen.findByRole("option", { name: "Taxi y apps" }));
    await userEvent.type(screen.getByLabelText("Monto desde"), "20.000");
    await userEvent.click(screen.getByRole("button", { name: "Crear regla" }));
    await waitFor(() =>
      expect(lastBody("POST")).toEqual({
        matchText: "Uber", paymentMethodId: null, minAmount: 20000, maxAmount: null, setCategoryId: "taxi", setPaymentMethodId: null,
      }),
    );
    const post = requests().find((r) => r.method === "POST" && r.path === "/rules")!;
    expect(post.headers.get("x-household-id")).toBe(personalSpace.id);
  });

  it("rejects a minimum over the maximum", async () => {
    api([]);
    render(<RulesManager />, { wrapper: WithSWR });
    await screen.findByText("Todavía no tenés reglas", {}, LOAD);
    await userEvent.click(screen.getByRole("button", { name: "Nueva regla" }));
    await userEvent.type(screen.getByLabelText("Si la descripción dice"), "Uber");
    await userEvent.click(screen.getByLabelText("Poner la categoría"));
    await userEvent.click(await screen.findByRole("option", { name: "Taxi y apps" }));
    await userEvent.type(screen.getByLabelText("Monto desde"), "500");
    await userEvent.type(screen.getByLabelText("Hasta"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Crear regla" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("mayor o igual al mínimo");
    expect(lastBody("POST")).toBeUndefined();
  });

  it("edits and deletes a rule", async () => {
    api([rule({ setCategoryId: "super" })]);
    vi.mocked(confirm).mockResolvedValue(true);
    render(<RulesManager />, { wrapper: WithSWR });
    await userEvent.click(await screen.findByRole("button", { name: "Editar la regla Carrefour" }, LOAD));
    await userEvent.click(screen.getByLabelText("Poner el medio de pago"));
    await userEvent.click(await screen.findByRole("option", { name: "Efectivo" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(lastBody("PATCH")).toMatchObject({ matchText: "Carrefour", setCategoryId: "super", setPaymentMethodId: "cash" }));

    await userEvent.click(await screen.findByRole("button", { name: "Editar la regla Carrefour" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar regla" }));
    await waitFor(() => expect(requests().some((r) => r.method === "DELETE" && r.path === "/rules/r1")).toBe(true));
  });

  it("with a hogar, each space has its rules", async () => {
    api([rule({ setCategoryId: "super" })], [personalSpace, hogarSpace]);
    render(<RulesManager />, { wrapper: WithSWR });
    expect(await screen.findByText(/«Carrefour»/, {}, LOAD)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Hogar" }));
    expect(await screen.findByText("Todavía no tenés reglas")).toBeInTheDocument();
  });
});
