"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  createWS,
  type CardapioData,
  type Estado,
  type Pedido,
  type Usuario,
} from "@/lib/api";

// ─── Toast system ──────────────────────────────────────────
type Toast = { id: number; msg: string; type: "success" | "error" | "info" };
let toastId = 0;

function Toasts({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: number) => void;
}) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onAnimationEnd={(e) => {
            if (e.animationName === "fadeOut") onRemove(t.id);
          }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function Home() {
  const [tab, setTab] = useState<"pedido" | "pedidos" | "admin">("pedido");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cardapio, setCardapio] = useState<CardapioData | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (msg: string, type: Toast["type"] = "success") => {
      setToasts((prev) => [...prev, { id: ++toastId, msg, type }]);
    },
    []
  );
  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Fetch initial data ──────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [est, card, usrs, peds] = await Promise.all([
        api.getEstado(),
        api.getCardapio(),
        api.getUsuarios(),
        api.getPedidos(),
      ]);
      setEstado(est);
      setCardapio(card);
      setUsuarios(usrs);
      setPedidos(peds);
    } catch (err: unknown) {
      addToast(
        `Erro ao carregar dados: ${err instanceof Error ? err.message : "desconhecido"}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── WebSocket ───────────────────────────────────────────
  useEffect(() => {
    const ws = createWS((msg) => {
      if (msg.tipo === "estado") {
        setEstado({ estado: msg.dados as "Aberto" | "Fechado" });
        addToast(
          `Cardápio ${msg.dados === "Aberto" ? "aberto" : "fechado"}!`,
          "info"
        );
      } else if (msg.tipo === "cardapio") {
        setCardapio(msg.dados as CardapioData);
      } else if (msg.tipo === "pedidos") {
        setPedidos(msg.dados as Pedido[]);
      }
    });
    return () => ws.close();
  }, [addToast]);

  if (loading) {
    return (
      <div className="app-container" style={{ marginTop: "30vh" }}>
        <div className="loader">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      <Toasts toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <span className="logo-icon">🍽️</span>
          <h1>GRT Food</h1>
        </div>
        {estado && (
          <span
            className={`badge ${estado.estado === "Aberto" ? "badge-open" : "badge-closed"}`}
          >
            {estado.estado}
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button
          className={`tab ${tab === "pedido" ? "active" : ""}`}
          onClick={() => setTab("pedido")}
        >
          🍴 Fazer Pedido
        </button>
        <button
          className={`tab ${tab === "pedidos" ? "active" : ""}`}
          onClick={() => setTab("pedidos")}
        >
          📋 Pedidos ({pedidos.length})
        </button>
        <button
          className={`tab ${tab === "admin" ? "active" : ""}`}
          onClick={() => setTab("admin")}
        >
          ⚙️ Admin
        </button>
      </div>

      {/* Content */}
      {tab === "pedido" && (
        <FazerPedido
          estado={estado}
          cardapio={cardapio}
          usuarios={usuarios}
          onSuccess={(pedido) => {
            setPedidos((prev) => [pedido, ...prev]);
            addToast("Pedido criado com sucesso!");
          }}
          onError={(msg) => addToast(msg, "error")}
        />
      )}
      {tab === "pedidos" && (
        <ListaPedidos
          pedidos={pedidos}
          onDelete={(id) => {
            api
              .deletarPedido(id)
              .then(() => {
                setPedidos((prev) => prev.filter((p) => p.id !== id));
                addToast("Pedido removido.");
              })
              .catch((e) => addToast(e.message, "error"));
          }}
        />
      )}
      {tab === "admin" && (
        <Admin
          estado={estado}
          cardapio={cardapio}
          onEstadoChange={setEstado}
          onCardapioChange={(c) => {
            setCardapio(c);
            addToast("Cardápio salvo!");
          }}
          onError={(msg) => addToast(msg, "error")}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FAZER PEDIDO
// ═══════════════════════════════════════════════════════════
function FazerPedido({
  estado,
  cardapio,
  usuarios,
  onSuccess,
  onError,
}: {
  estado: Estado | null;
  cardapio: CardapioData | null;
  usuarios: Usuario[];
  onSuccess: (p: Pedido) => void;
  onError: (msg: string) => void;
}) {
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedMultiplos, setSelectedMultiplos] = useState<
    Record<string, string>
  >({});
  const [obs, setObs] = useState("");
  const [sending, setSending] = useState(false);

  // Auto-select all items when cardapio changes
  useEffect(() => {
    if (cardapio) {
      setSelectedItems([...cardapio.items]);
      const mult: Record<string, string> = {};
      Object.entries(cardapio.multiplos).forEach(([key, opts]) => {
        if (opts.length > 0) mult[key] = opts[0];
      });
      setSelectedMultiplos(mult);
    }
  }, [cardapio]);

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async () => {
    if (!selectedUser) return onError("Selecione um usuário.");
    setSending(true);
    try {
      const pedido = await api.criarPedido(
        selectedUser as number,
        { items: selectedItems, multiplos: selectedMultiplos },
        obs
      );
      onSuccess(pedido);
      setObs("");
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Erro ao criar pedido");
    } finally {
      setSending(false);
    }
  };

  if (estado?.estado === "Fechado") {
    return (
      <div className="glass-card">
        <div className="empty-state">
          <div className="icon">🔒</div>
          <p>O cardápio está <strong>fechado</strong>. Não é possível fazer pedidos neste momento.</p>
        </div>
      </div>
    );
  }

  if (!cardapio) {
    return (
      <div className="glass-card">
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>Nenhum cardápio definido para hoje. Aguarde o RH configurar o cardápio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-grid two-col">
      {/* Left — Cardápio items */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h2 className="section-title">🍱 Cardápio de Hoje</h2>

        {/* Select user */}
        <select
          className="input"
          value={selectedUser}
          onChange={(e) =>
            setSelectedUser(e.target.value ? Number(e.target.value) : "")
          }
          style={{ marginBottom: 16 }}
        >
          <option value="">Selecione seu nome...</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {cardapio.items.map((item) => (
            <label key={item} className="checkbox-item">
              <input
                type="checkbox"
                checked={selectedItems.includes(item)}
                onChange={() => toggleItem(item)}
              />
              <span style={{ fontSize: "0.9rem" }}>{item}</span>
            </label>
          ))}
        </div>

        {/* Múltiplos */}
        {Object.entries(cardapio.multiplos).map(([label, options]) => (
          <div key={label} style={{ marginTop: 16 }}>
            <label
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
                marginBottom: 6,
                display: "block",
              }}
            >
              {label}
            </label>
            <select
              className="input"
              value={selectedMultiplos[label] || ""}
              onChange={(e) =>
                setSelectedMultiplos((prev) => ({
                  ...prev,
                  [label]: e.target.value,
                }))
              }
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Right — Obs + submit */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div className="glass-card" style={{ padding: 24 }}>
          <h2 className="section-title">💬 Observação</h2>
          <textarea
            className="input"
            placeholder="Pouca salada, sem tempero..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            style={{ resize: "vertical" }}
          />
        </div>

        <div className="glass-card" style={{ padding: 24 }}>
          <h2 className="section-title">📝 Resumo</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              marginBottom: 16,
            }}
          >
            <span>
              <strong style={{ color: "var(--accent)" }}>
                {selectedItems.length}
              </strong>{" "}
              itens selecionados
            </span>
            {Object.entries(selectedMultiplos).map(([k, v]) => (
              <span key={k}>
                {k}: <strong style={{ color: "var(--text-primary)" }}>{v}</strong>
              </span>
            ))}
            {obs && (
              <span>
                Obs: <em style={{ color: "var(--text-primary)" }}>{obs}</em>
              </span>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={sending || !selectedUser}
            style={{ width: "100%" }}
          >
            {sending ? "Enviando..." : "✅ Confirmar Pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  LISTA DE PEDIDOS
// ═══════════════════════════════════════════════════════════
function ListaPedidos({
  pedidos,
  onDelete,
}: {
  pedidos: Pedido[];
  onDelete: (id: number) => void;
}) {
  if (pedidos.length === 0) {
    return (
      <div className="glass-card">
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>Nenhum pedido registrado hoje.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h2 className="section-title">
        📋 Pedidos de Hoje{" "}
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            fontWeight: 400,
          }}
        >
          ({pedidos.length})
        </span>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pedidos.map((p) => (
          <div key={p.id} className="pedido-card">
            <div>
              <div
                style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}
              >
                {p.usuario}
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {p.pedido.items.map((item) => (
                  <span
                    key={item}
                    style={{
                      padding: "2px 8px",
                      background: "rgba(59,130,246,0.1)",
                      borderRadius: 6,
                      color: "var(--accent)",
                    }}
                  >
                    {item}
                  </span>
                ))}
                {Object.entries(p.pedido.multiplos).map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      padding: "2px 8px",
                      background: "rgba(245,158,11,0.1)",
                      borderRadius: 6,
                      color: "var(--accent-amber)",
                    }}
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDelete(p.id)}
              title="Remover pedido"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════
function Admin({
  estado,
  cardapio,
  onEstadoChange,
  onCardapioChange,
  onError,
}: {
  estado: Estado | null;
  cardapio: CardapioData | null;
  onEstadoChange: (e: Estado) => void;
  onCardapioChange: (c: CardapioData) => void;
  onError: (msg: string) => void;
}) {
  const [items, setItems] = useState(cardapio?.items.join(", ") || "");
  const [multiplosText, setMultiplosText] = useState(() => {
    if (!cardapio?.multiplos) return "";
    return Object.entries(cardapio.multiplos)
      .map(([k, v]) => `${k}: ${v.join(", ")}`)
      .join("\n");
  });
  const [saving, setSaving] = useState(false);

  const handleToggleEstado = async () => {
    try {
      const result =
        estado?.estado === "Aberto"
          ? await api.fecharCardapio()
          : await api.abrirCardapio();
      onEstadoChange(result);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleSaveCardapio = async () => {
    setSaving(true);
    try {
      const itemsList = items
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const multiplos: Record<string, string[]> = {};
      multiplosText
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          const [key, ...rest] = line.split(":");
          if (key && rest.length) {
            multiplos[key.trim()] = rest
              .join(":")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        });

      const result = await api.setCardapio({ items: itemsList, multiplos });
      onCardapioChange(result);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-grid two-col">
      {/* Estado */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h2 className="section-title">🔐 Controle de Estado</h2>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.85rem",
            marginBottom: 20,
            marginTop: 0,
          }}
        >
          Estado atual:{" "}
          <span
            className={`badge ${estado?.estado === "Aberto" ? "badge-open" : "badge-closed"}`}
          >
            {estado?.estado || "..."}
          </span>
        </p>
        <button
          className={`btn ${estado?.estado === "Aberto" ? "btn-danger" : "btn-success"}`}
          onClick={handleToggleEstado}
          style={{ width: "100%" }}
        >
          {estado?.estado === "Aberto"
            ? "🔒 Fechar Cardápio"
            : "🔓 Abrir Cardápio"}
        </button>
      </div>

      {/* Definir cardápio */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h2 className="section-title">📝 Definir Cardápio</h2>

        <label
          style={{
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            marginBottom: 6,
            display: "block",
          }}
        >
          Itens (separados por vírgula)
        </label>
        <input
          className="input"
          placeholder="Arroz, Feijão, Salada, Frango"
          value={items}
          onChange={(e) => setItems(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label
          style={{
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            marginBottom: 6,
            display: "block",
          }}
        >
          Múltiplos (uma opção por linha: Carne: Chuleta, Bife, Frango)
        </label>
        <textarea
          className="input"
          placeholder={"Carne: Chuleta, Bife\nSobremesa: Pudim, Gelatina"}
          value={multiplosText}
          onChange={(e) => setMultiplosText(e.target.value)}
          rows={4}
          style={{ resize: "vertical", marginBottom: 16 }}
        />

        <button
          className="btn btn-primary"
          onClick={handleSaveCardapio}
          disabled={saving}
          style={{ width: "100%" }}
        >
          {saving ? "Salvando..." : "💾 Salvar Cardápio"}
        </button>
      </div>
    </div>
  );
}
