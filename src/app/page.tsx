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
        <div key={t.id} className={`toast toast-${t.type}`}
          onAnimationEnd={(e) => { if (e.animationName === "fadeOut") onRemove(t.id); }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

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

  // ─── Fetch data ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [est, usrs, peds] = await Promise.all([
        api.getEstado(), api.getUsuarios(), api.getPedidos(),
      ]);
      setEstado(est.estado);
      setUsuarios(usrs);
      setPedidos(peds);
    } catch (err: unknown) {
      addToast(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── WebSocket ──────────────────────────────────────────
  useEffect(() => {
    const ws = createWS((msg) => {
      if (msg.tipo === "estado") setEstado(msg.dados as string);
      if (msg.tipo === "pedidos") setPedidos(msg.dados as Pedido[]);
    });
    return () => ws.close();
  }, []);

  // ─── Handlers ──────────────────────────────────────────
  const toggleUser = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

  const isOpen = estado === "Aberto";

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="fade-in">
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

      {/* ═══ INFO BAR ═══ */}
      <div className="info-bar">
        <span className="info-dot" />
        Total de pedidos realizados até o momento: <strong>{pedidos.length}</strong>
      </div>

      {/* ═══ MAIN 2-COLUMN LAYOUT ═══ */}
      <main className="main-grid">
        {/* LEFT — Lista de Pedidos */}
        <div className="pedidos-col">
          {pedidos.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🍽️</div>
              <p>Nenhum pedido registrado ainda hoje.</p>
            </div>
          ) : (
            pedidos.map((p) => (
              <div key={p.id} className="pedido-row">
                <span className="pedido-nome">{p.usuario}</span>
                <button className="btn-x" onClick={() => deletarPedido(p.id)} title="Remover">×</button>
              </div>
            ))
          )}
        </div>

        {/* RIGHT — Cardápio + Ações */}
        <div className="sidebar-col">
          {/* Cardápio Card */}
          <div className="glass card-cardapio">
            <div className="card-title">Cardápio</div>
            <div className="cardapio-item">ALMOÇO</div>
          </div>

          {/* Select Users */}
          <div className="glass card-select">
            <select
              className="user-select"
              multiple
              size={6}
              value={selectedIds.map(String)}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val) toggleUser(val);
              }}
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {selectedIds.includes(u.id) ? "✓ " : "  "}{u.nome}
                </option>
              ))}
            </select>
            <p className="select-hint">
              {selectedIds.length > 0
                ? `${selectedIds.length} selecionado(s)`
                : "Clique para selecionar"}
            </p>
          </div>

          {/* Buttons */}
          <button
            className="btn-fazer"
            onClick={fazerPedidos}
            disabled={sending || selectedIds.length === 0}
          >
            {sending ? "Enviando..." : "Fazer Pedido"}
          </button>

          <button className="btn-email" onClick={enviarEmailDebug}>
            Enviar Email (Debug)
          </button>
        </div>
      </main>

      {/* ═══ FOOTER STATUS ═══ */}
      <div className={`footer-status ${isOpen ? "open" : "closed"}`}>
        {isOpen ? "Pedidos abertos — faça seu pedido! 🍽️" : "Pedidos encerrados por hoje 😄"}
      </div>
    </div>
  );
}
