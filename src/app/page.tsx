"use client";

import { useCallback, useEffect, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { api, createWS, type Pedido, type Usuario } from "@/lib/api";

// ─── Toast ─────────────────────────────────────────────────
type Toast = { id: number; msg: string; type: "ok" | "err" };
let tid = 0;

type SuccessPlayer = {
  addEventListener: (event: "complete", listener: () => void) => void;
  removeEventListener: (event: "complete", listener: () => void) => void;
};

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
  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successPlayer, setSuccessPlayer] = useState<SuccessPlayer | null>(null);

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

  useEffect(() => {
    if (!successOpen) return;

    const fallbackTimeoutId = window.setTimeout(() => setSuccessOpen(false), 6500);

    if (!successPlayer) {
      return () => window.clearTimeout(fallbackTimeoutId);
    }

    const handleComplete = () => setSuccessOpen(false);
    successPlayer.addEventListener("complete", handleComplete);

    return () => {
      window.clearTimeout(fallbackTimeoutId);
      successPlayer.removeEventListener("complete", handleComplete);
    };
  }, [successOpen, successPlayer]);

  // ─── Handlers ────────────────────────────────────────────
  const toggleUser = (id: number) => {
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const openModal = () => {
    setConfirmStep(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (sending) return;
    setConfirmStep(false);
    setModalOpen(false);
  };

  const goToConfirm = () => {
    if (selectedIds.length === 0) return;
    setConfirmStep(true);
  };

  const removeFromConfirm = (id: number) => {
    if (selectedIds.length <= 1) {
      toast("Deixe ao menos 1 pessoa selecionada", "err");
      return;
    }
    setSelectedIds((p) => p.filter((x) => x !== id));
  };

  const submitPedidos = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    let ok = 0;
    for (const uid of selectedIds) {
      try { await api.criarPedido(uid, { items: ["Almoço"], multiplos: {} }, ""); ok++; } catch {}
    }
    setSelectedIds([]);
    setConfirmStep(false);
    setModalOpen(false);
    setSending(false);
    if (ok > 0) {
      toast(`${ok} pedido(s) registrado(s)!`);
      setSuccessOpen(true);
    }
    try { setPedidos(await api.getPedidos()); } catch {}
  };

  const deletar = async (id: number) => {
    const confirmed = window.confirm("Tem certeza que deseja excluir este pedido de almoço?");
    if (!confirmed) return;

    try {
      await api.deletarPedido(id);
      setPedidos((p) => p.filter((x) => x.id !== id));
      toast("Removido");
    } catch { toast("Erro", "err"); }
  };

  const isOpen = estado === "Aberto";
  const selectedUsers = usuarios.filter((u) => selectedIds.includes(u.id));

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <Toasts items={toasts} onDone={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {successOpen && (
        <div className="success-overlay" onClick={() => setSuccessOpen(false)}>
          <div className="success-card" onClick={(e) => e.stopPropagation()}>
            <DotLottieReact
              src="/Success.lottie"
              autoplay
              loop={false}
              className="success-lottie"
              dotLottieRefCallback={(dotLottie) => setSuccessPlayer(dotLottie as SuccessPlayer | null)}
            />
            <p>Pedido registrado com sucesso!</p>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header className="header">
        <div className="logo">
          <div className="logo-mark"><img src="/logo.svg" alt="Logo GRT Food" /></div>
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
          <div className="menu-item-display">
            Almoço
          </div>
          <button className="btn-fazer-panel" onClick={openModal}>
            FAZER PEDIDO
          </button>
        </aside>
      </div>


      {/* ═══ MODAL ═══ */}
      {modalOpen && (
        <div className="overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{confirmStep ? "Confirmar Pedidos" : "Selecionar Almoços"}</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            {!confirmStep ? (
              <>
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
                  onClick={goToConfirm}
                >
                  Continuar com {selectedIds.length} pessoa(s)
                </button>
              </>
            ) : (
              <>
                <p className="modal-hint">
                <strong>Tem certeza que quer adicionar essa(s) pessoa(s)?</strong>.
                </p>

                <div className="confirm-list">
                  {selectedUsers.map((u) => (
                    <div key={u.id} className="confirm-item">
                      <span>{u.nome}</span>
                      <button
                        className="confirm-remove"
                        disabled={selectedIds.length === 1 || sending}
                        onClick={() => removeFromConfirm(u.id)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <div className="confirm-actions">
                  <button className="btn-secondary" disabled={sending} onClick={() => setConfirmStep(false)}>
                    Voltar
                  </button>
                  <button
                    className="btn-confirm"
                    disabled={sending || selectedIds.length === 0}
                    onClick={submitPedidos}
                  >
                    {sending ? "Enviando..." : `Confirmar ${selectedIds.length} pedido(s)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
