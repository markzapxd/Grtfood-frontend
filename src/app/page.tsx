"use client";

import { useCallback, useEffect, useState } from "react";
import { api, createWS, type Pedido, type Usuario } from "@/lib/api";

// ─── Toast ─────────────────────────────────────────────────
type Toast = { id: number; msg: string; type: "ok" | "err" };
let tid = 0;

function Toasts({ items, onDone }: { items: Toast[]; onDone: (id: number) => void }) {
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}
          onAnimationEnd={(e) => { if (e.animationName === "toastOut") onDone(t.id); }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function Home() {
  const [estado, setEstado] = useState("Fechado");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  const toast = useCallback((msg: string, type: Toast["type"] = "ok") => {
    setToasts((p) => [...p, { id: ++tid, msg, type }]);
  }, []);

  // ─── Fetch ───────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [est, usrs, peds] = await Promise.all([
        api.getEstado(), api.getUsuarios(), api.getPedidos(),
      ]);
      setEstado(est.estado);
      setUsuarios(usrs);
      setPedidos(peds);
    } catch { toast("Erro ao carregar dados", "err"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── WebSocket ───────────────────────────────────────────
  useEffect(() => {
    const ws = createWS((msg) => {
      if (msg.tipo === "estado") setEstado(msg.dados as string);
      if (msg.tipo === "pedidos") setPedidos(msg.dados as Pedido[]);
    });
    return () => ws.close();
  }, []);

  // ─── Handlers ────────────────────────────────────────────
  const toggleUser = (id: number) => {
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const submitPedidos = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    let ok = 0;
    for (const uid of selectedIds) {
      try { await api.criarPedido(uid, { items: ["Almoço"], multiplos: {} }, ""); ok++; } catch {}
    }
    setSelectedIds([]);
    setModalOpen(false);
    setSending(false);
    if (ok > 0) toast(`${ok} pedido(s) registrado(s)!`);
    try { setPedidos(await api.getPedidos()); } catch {}
  };

  const deletar = async (id: number) => {
    try {
      await api.deletarPedido(id);
      setPedidos((p) => p.filter((x) => x.id !== id));
      toast("Removido");
    } catch { toast("Erro", "err"); }
  };

  const isOpen = estado === "Aberto";

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <Toasts items={toasts} onDone={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {/* ═══ HEADER ═══ */}
      <header className="header">
        <div className="logo">
          <div className="logo-mark">G</div>
          <span className="logo-name">GRT Food</span>
          <span className="logo-plus">Plus</span>
        </div>
        <div className="status">
          <span className={`dot ${isOpen ? "on" : ""}`} />
          {isOpen ? "Aberto" : "Encerrado"}
        </div>
      </header>

      {/* ═══ COUNTER BAR ═══ */}
      <div className="counter-bar">
        Total de pedidos realizados até o momento: <strong>{pedidos.length}</strong>
      </div>

      <div className="content-layout">
        <section className="list-column">
          <div className="list-area">
            {pedidos.length === 0 ? (
              <div className="empty">
                <span>🍽️</span>
                <p>Nenhum pedido registrado hoje.</p>
              </div>
            ) : (
              pedidos.map((p) => (
                <div key={p.id} className="row">
                  <span>{p.usuario}</span>
                  <button className="row-x" onClick={() => deletar(p.id)}>×</button>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="menu-column">
          <h2 className="menu-title">Cardápio</h2>
          <button className="menu-item" onClick={() => setModalOpen(true)}>
            ALMOÇO
          </button>
        </aside>
      </div>

      {/* ═══ FOOTER STATUS ═══ */}
      <div className={`footer ${isOpen ? "on" : ""}`}>
        {isOpen ? "Pedidos abertos — faça seu pedido! 🍽️" : "Pedidos encerrados por hoje 😄"}
      </div>

      {/* ═══ MODAL ═══ */}
      {modalOpen && (
        <div className="overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Selecionar Almoços</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>

            <p className="modal-hint">
              Clique nos nomes para selecionar. {selectedIds.length > 0 && <strong>{selectedIds.length} selecionado(s)</strong>}
            </p>

            <div className="modal-list">
              {usuarios.map((u) => (
                <div
                  key={u.id}
                  className={`modal-item ${selectedIds.includes(u.id) ? "selected" : ""}`}
                  onClick={() => toggleUser(u.id)}
                >
                  <span className="check">{selectedIds.includes(u.id) ? "✓" : ""}</span>
                  <span>{u.nome}</span>
                </div>
              ))}
            </div>

            <button
              className="btn-confirm"
              disabled={sending || selectedIds.length === 0}
              onClick={submitPedidos}
            >
              {sending ? "Enviando..." : `Registrar ${selectedIds.length} pedido(s)`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
