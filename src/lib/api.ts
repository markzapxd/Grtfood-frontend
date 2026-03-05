const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const API_BASE = RAW_API_BASE
  ? (RAW_API_BASE.startsWith("http://") || RAW_API_BASE.startsWith("https://")
      ? RAW_API_BASE
      : `http://${RAW_API_BASE}`)
  : "";
const REQUEST_TIMEOUT_MS = 12000;
const ACCESS_TOKEN_KEY = "grt_access_token";
const REFRESH_TOKEN_KEY = "grt_refresh_token";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let refreshInFlight: Promise<void> | null = null;

type RequestOptionsWithTimeout = RequestInit & {
  timeoutMs?: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadTokensFromStorage() {
  if (!isBrowser()) return;
  accessTokenCache = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  refreshTokenCache = sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

function persistTokens(accessToken: string, refreshToken: string) {
  accessTokenCache = accessToken;
  refreshTokenCache = refreshToken;
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearPersistedTokens() {
  accessTokenCache = null;
  refreshTokenCache = null;
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken() {
  if (!refreshTokenCache) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshTokenCache }),
  });
  if (!res.ok) {
    clearPersistedTokens();
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  const data = await res.json() as AuthTokens;
  persistTokens(data.access_token, data.refresh_token);
}

async function fetchAPI<T>(
  path: string,
  options?: RequestOptionsWithTimeout,
  retryOnUnauthorized = true
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!accessTokenCache && isBrowser()) {
    loadTokensFromStorage();
  }
  if (accessTokenCache) {
    headers["Authorization"] = `Bearer ${accessTokenCache}`;
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
    if (
      res.status === 401 &&
      retryOnUnauthorized &&
      path !== "/api/auth/login" &&
      path !== "/api/auth/refresh" &&
      refreshTokenCache
    ) {
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
      }
      await refreshInFlight;
      return fetchAPI<T>(path, options, false);
    }

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
  ativo: boolean;
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

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AdminSecretResponse {
  secret: string;
  usuario: string;
  username: string;
  can_manage_auto_weekly: boolean;
}

export interface AutoPedidoSemanal {
  id: number;
  usuario_id: number;
  usuario_nome: string;
  ativo: boolean;
  semana_referencia: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ResumoMensalItem {
  usuario: string;
  usuario_id: number;
  qtde: number;
  dias: Record<string, number>;
}

export interface ResumoMensalResponse {
  resumo: ResumoMensalItem[];
  data_inicio: string;
  data_fim: string;
  gerado: string;
  dias_no_mes: number[];
}

// ─── API calls ─────────────────────────────────────────────

export const api = {
  loadSession: () => {
    loadTokensFromStorage();
  },
  isAuthenticated: () => Boolean(accessTokenCache && refreshTokenCache),
  login: async (username: string, senha: string) => {
    const data = await fetchAPI<AuthTokens>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, senha }),
    }, false);
    persistTokens(data.access_token, data.refresh_token);
    return data;
  },
  logout: async () => {
    const token = refreshTokenCache;
    try {
      if (token) {
        await fetchAPI<{ status: string }>("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: token }),
        }, false);
      }
    } finally {
      clearPersistedTokens();
    }
  },
  getAdminSecret: () => fetchAPI<AdminSecretResponse>("/api/admin/secret"),
  getAutoPedidosSemanais: () =>
    fetchAPI<AutoPedidoSemanal[]>("/api/admin/auto-pedidos-semanais"),
  getRelatorioMensal: () =>
    fetchAPI<ResumoMensalResponse>("/api/relatorios/mensal"),
  getRelatorioMensalAnterior: () =>
    fetchAPI<ResumoMensalResponse>("/api/relatorios/mensal-anterior"),
  addAutoPedidoSemanal: (usuario_id: number) =>
    fetchAPI<AutoPedidoSemanal>("/api/admin/auto-pedidos-semanais", {
      method: "POST",
      body: JSON.stringify({ usuario_id }),
    }),
  removeAutoPedidoSemanal: (usuario_id: number) =>
    fetchAPI<void>(`/api/admin/auto-pedidos-semanais/${usuario_id}`, {
      method: "DELETE",
    }),

  // Usuarios
  getUsuarios: () => fetchAPI<Usuario[]>("/api/usuarios"),
  getAdminUsuarios: () => fetchAPI<Usuario[]>("/api/admin/usuarios"),
  criarUsuario: (nome: string, ativo = true) =>
    fetchAPI<Usuario>("/api/admin/usuarios", {
      method: "POST",
      body: JSON.stringify({ nome, ativo }),
    }),
  setUsuarioStatus: (usuarioId: number, ativo: boolean) =>
    fetchAPI<Usuario>(`/api/admin/usuarios/${usuarioId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  deletarUsuario: (usuarioId: number) =>
    fetchAPI<void>(`/api/admin/usuarios/${usuarioId}`, {
      method: "DELETE",
    }),

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
    const apiUrl = new URL(API_BASE);
    apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    apiUrl.pathname = "/ws";
    apiUrl.search = "";
    apiUrl.hash = "";
    wsUrl = apiUrl.toString();
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
