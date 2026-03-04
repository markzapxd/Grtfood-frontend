"use client";

import { useCallback, useEffect, useState } from "react";
import { api, createWS, type Pedido, type Usuario } from "@/lib/api";

// ─── Toast system ──────────────────────────────────────────
type Toast = { id: number; msg: string; type: "success" | "error" | "info" };
let toastId = 0;

function Toasts({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
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
//  MAIN PAGE — GRT Food Plus
// ═══════════════════════════════════════════════════════════
export default function Home() {
  const [estado, setEstado] = useState<string>("Fechado");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((msg: string, type: Toast["type"] = "success") => {
    setToasts((prev) => [...prev, { id: ++toastId, msg, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Fetch initial data ──────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [est, usrs, peds] = await Promise.all([
        api.getEstado(),
        api.getUsuarios(),
        api.getPedidos(),
      ]);
      setEstado(est.estado);
      setUsuarios(usrs);
      setPedidos(peds);
    } catch (err: unknown) {
      addToast(`Erro ao carregar dados: ${err instanceof Error ? err.message : "desconhecido"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── WebSocket ──────────────────────────────────────────
  useEffect(() => {
    const ws = createWS((msg) => {
      if (msg.tipo === "estado") {
        setEstado(msg.dados as string);
      } else if (msg.tipo === "pedidos") {
        setPedidos(msg.dados as Pedido[]);
      }
    });
    return () => ws.close();
  }, []);

  // ─── Handlers ───────────────────────────────────────────
  const toggleUser = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeSelected = (id: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const fazerPedidos = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    let ok = 0, fail = 0;
    for (const uid of selectedIds) {
      try {
        await api.criarPedido(uid, { items: ["Almoço"], multiplos: {} }, "");
        ok++;
      } catch { fail++; }
    }
    setSelectedIds([]);
    if (ok > 0) addToast(`${ok} pedido(s) registrado(s)!`);
    if (fail > 0) addToast(`${fail} pedido(s) falharam.`, "error");
    setSending(false);
    // Reload pedidos
    try { setPedidos(await api.getPedidos()); } catch {}
  };

  const deletarPedido = async (id: number) => {
    try {
      await api.deletarPedido(id);
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      addToast("Pedido removido!");
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Erro", "error");
    }
  };

  const enviarEmailDebug = async () => {
    try {
      await api.testEmail();
      addToast("Email de teste enviado!", "info");
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Erro ao enviar email", "error");
    }
  };

  const selectedUsers = usuarios.filter((u) => selectedIds.includes(u.id));
  const isOpen = estado === "Aberto";

  if (loading) {
    return (
      <div className="app-wrap">
        <div className="loader"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="app-wrap fade-in">
      <Toasts toasts={toasts} onRemove={removeToast} />

      {/* ═══ HEADER ═══ */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">G</div>
          <span className="logo-text">GRT Food</span>
          <span className="logo-badge">Plus</span>
        </div>
        <div className="header-status">
          <div className={`status-dot ${isOpen ? "open" : "closed"}`} />
          <span>{isOpen ? "Pedidos Abertos" : "Pedidos Encerrados"}</span>
        </div>
      </header>

      {/* ═══ STATS ═══ */}
      <div className="stats">
        <div className="glass stat-card">
          <div className="stat-number">{pedidos.length}</div>
          <div className="stat-label">Pedidos Hoje</div>
        </div>
        <div className="glass stat-card">
          <div className="stat-number">{usuarios.length}</div>
          <div className="stat-label">Usuários</div>
        </div>
      </div>

      {/* ═══ ORDER PANEL ═══ */}
      <div className="glass order-panel">
        <h2>📋 Fazer Pedido</h2>

        {/* Selected chips */}
        <div className="chips">
          {selectedUsers.map((u) => (
            <span key={u.id} className="chip">
              {u.nome}
              <button onClick={() => removeSelected(u.id)}>&times;</button>
            </span>
          ))}
        </div>

        {/* Multi-select */}
        <div className="select-wrapper">
          <select
            multiple
            size={6}
            value={selectedIds.map(String)}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions);
              const clicked = parseInt(opts[opts.length - 1]?.value || "0");
              if (clicked) toggleUser(clicked);
            }}
          >
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {selectedIds.includes(u.id) ? "✓ " : "  "}{u.nome}
              </option>
            ))}
          </select>
        </div>
        <p className="select-hint">Clique nos nomes para selecionar (clique de novo para remover)</p>

        <button
          className="btn btn-primary"
          onClick={fazerPedidos}
          disabled={sending || selectedIds.length === 0}
        >
          {sending ? <><span className="spinner-sm" /> Registrando...</> : "🍽️ Registrar Pedidos"}
        </button>

        <div className="actions-row">
          <button className="btn btn-debug" onClick={enviarEmailDebug}>
            📧 Enviar Email (Debug)
          </button>
        </div>
      </div>

      {/* ═══ ORDERS LIST ═══ */}
      <div className="glass orders-section">
        <h2>
          Pedidos de Hoje
          <span className="orders-count">{pedidos.length}</span>
        </h2>
        <div className="order-list">
          {pedidos.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🍽️</div>
              <p>Nenhum pedido registrado ainda hoje.</p>
            </div>
          ) : (
            pedidos.map((p) => (
              <div key={p.id} className="order-item">
                <div>
                  <div className="order-name">{p.usuario}</div>
                  <div className="order-time">{p.dataDoPedido || ""}</div>
                </div>
                <button className="btn btn-danger-sm" onClick={() => deletarPedido(p.id)}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
