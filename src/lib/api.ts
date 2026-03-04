const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const REQUEST_TIMEOUT_MS = 12000;

type RequestOptionsWithTimeout = RequestInit & {
  timeoutMs?: number;
};

async function fetchAPI<T>(
  path: string,
  options?: RequestOptionsWithTimeout
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const { timeoutMs = REQUEST_TIMEOUT_MS, ...requestOptions } = options ?? {};

  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(
    () => timeoutController.abort(),
    timeoutMs
  );

  let removeAbortBridge: (() => void) | undefined;
  if (requestOptions.signal) {
    const bridgeAbort = () => timeoutController.abort();
    requestOptions.signal.addEventListener("abort", bridgeAbort);
    removeAbortBridge = () => requestOptions.signal?.removeEventListener("abort", bridgeAbort);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers,
      ...requestOptions,
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tempo de resposta da API excedido");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    removeAbortBridge?.();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────
export interface Usuario {
  id: number;
  nome: string;
}

export interface CardapioData {
  id: number;
  data: string;
  items: string[];
  multiplos: Record<string, string[]>;
}

export interface PedidoPayload {
  items: string[];
  multiplos: Record<string, string>;
}

export interface Pedido {
  id: number;
  usuario: string;
  dataDoPedido: string;
  pedido: PedidoPayload;
}

export interface PedidoProcessado {
  usuario: string;
  removidos: string[];
  selecionados: string[];
  data: string;
}

export interface Estado {
  estado: "Aberto" | "Fechado";
}

export interface CardapioPayload {
  items: string[];
  multiplos: Record<string, string[]>;
}

// ─── API calls ─────────────────────────────────────────────

export const api = {
  // Usuarios
  getUsuarios: () => fetchAPI<Usuario[]>("/api/usuarios"),

  // Cardápio
  getCardapio: () => fetchAPI<CardapioData | null>("/api/cardapio"),
  setCardapio: (payload: CardapioPayload) =>
    fetchAPI<CardapioData>("/api/cardapio", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Estado
  getEstado: () => fetchAPI<Estado>("/api/estado"),
  abrirCardapio: () =>
    fetchAPI<Estado>("/api/estado/abrir", { method: "POST" }),
  fecharCardapio: () =>
    fetchAPI<Estado>("/api/estado/fechar", { method: "POST" }),

  // Pedidos
  getPedidos: () => fetchAPI<Pedido[]>("/api/pedidos"),
  criarPedido: (usuario_id: number, pedido: PedidoPayload, obs: string) =>
    fetchAPI<Pedido>("/api/pedidos", {
      method: "POST",
      body: JSON.stringify({ usuario_id, pedido, obs }),
    }),
  deletarPedido: (id: number) =>
    fetchAPI<void>(`/api/pedidos/${id}`, { method: "DELETE" }),
  getPedidosProcessados: () =>
    fetchAPI<PedidoProcessado[]>("/api/pedidos/processados"),

  // Email debug
  testEmail: () =>
    fetchAPI<{ status: string; message?: string }>("/api/mail/debug", {
      method: "POST",
      timeoutMs: 30000,
    }),
};

// ─── WebSocket ─────────────────────────────────────────────
export function createWS(onMessage: (msg: { tipo: string; dados: unknown }) => void) {
  let wsUrl = "";
  if (API_BASE) {
    wsUrl = API_BASE.replace(/^http/, "ws") + "/ws";
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = `${protocol}//${window.location.host}/ws`;
  }

  const ws = new WebSocket(wsUrl);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      onMessage(data);
    } catch { /* ignore */ }
  };
  ws.onerror = () => ws.close();
  return ws;
}
