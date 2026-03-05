"use client";

import { useCallback, useEffect, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { api, createWS, type Pedido, type Usuario } from "@/lib/api";

type Toast = { id: number; msg: string; type: "ok" | "err" };
let tid = 0;

type SuccessPlayer = {
  addEventListener: (event: "complete", listener: () => void) => void;
  removeEventListener: (event: "complete", listener: () => void) => void;
};

function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="fixed right-4 top-[68px] z-[300] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            "max-w-[280px] rounded-lg border px-4 py-2 text-sm font-medium",
            t.type === "ok"
              ? "border-zinc-700 bg-zinc-900 text-zinc-300"
              : "border-red-900/40 bg-red-500/10 text-red-300",
          ].join(" ")}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [estado, setEstado] = useState("Fechado");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successPlayer, setSuccessPlayer] = useState<SuccessPlayer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const toast = useCallback((msg: string, type: Toast["type"] = "ok") => {
    const id = ++tid;
    setToasts((p) => [...p, { id, msg, type }]);
    window.setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
    }, 2800);
  }, []);

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

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const toggleUser = (id: number) => {
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const openModal = () => {
    setConfirmStep(false);
    setSearchTerm("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (sending) return;
    setConfirmStep(false);
    setSearchTerm("");
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

  const excluirPedido = async (pedidoId: number) => {
    try {
      await api.deletarPedido(pedidoId);
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
      toast("Pedido excluído");
    } catch {
      toast("Erro ao excluir pedido", "err");
    }
  };

  const isOpen = estado === "Aberto";
  const selectedUsers = usuarios.filter((u) => selectedIds.includes(u.id));
  const filteredUsuarios = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-zinc-700 border-t-red-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(1200px_500px_at_-10%_-20%,rgba(220,38,38,0.10),transparent_55%),radial-gradient(900px_420px_at_110%_10%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(180deg,#0f0f10_0%,#0a0a0a_55%,#070707_100%)] text-zinc-100">
      <Toasts items={toasts} />

      {successOpen && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={() => setSuccessOpen(false)}>
          <div className="flex w-[min(360px,90vw)] flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-5 pb-4 pt-4 shadow-[0_24px_80px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
            <DotLottieReact
              src="/Success.lottie"
              autoplay
              loop={false}
              className="h-[170px] w-[170px]"
              dotLottieRefCallback={(dotLottie) => setSuccessPlayer(dotLottie as SuccessPlayer | null)}
            />
            <p className="text-center text-[15px] font-bold text-zinc-100">Pedido registrado com sucesso!</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-black bg-black px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg">
            <img src="/logo.svg" alt="Logo GRT Food" className="h-8 w-8" />
          </div>
          <span className="text-[17px] font-bold text-zinc-100">GRT Food</span>
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.8px] text-white">Plus</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <span className={["h-1.5 w-1.5 rounded-full", isOpen ? "bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.25)]" : "bg-zinc-600"].join(" ")} />
          {isOpen ? "Aberto" : "Encerrado"}
        </div>
      </header>

      <div className="w-full border-b border-red-500/10 bg-red-500/10 px-6 py-2.5 text-[13px] font-medium text-red-300">
        Total de pedidos realizados até o momento: <strong>{pedidos.length}</strong>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_30%),linear-gradient(180deg,#0c0c0d_0%,#0a0a0a_100%)] max-[900px]:grid-cols-1">
        <section className="min-h-0 min-w-0 max-[900px]:border-r-0 max-[900px]:shadow-none">
          <div className="custom-scroll h-full overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.015)_0%,rgba(255,255,255,0)_22%),linear-gradient(180deg,#0d0d0e_0%,#090909_100%)] max-[900px]:max-h-[calc(100vh-56px-40px-44px)]">
            {pedidos.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-5 py-20 text-zinc-300">
                <span className="inline-flex h-16 w-16 items-center justify-center text-[40px] leading-none opacity-90">🍽️</span>
                <p className="text-sm">Nenhum pedido registrado hoje.</p>
              </div>
            ) : (
              pedidos.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-zinc-900 px-[34px] py-3.5 text-[20px] font-medium transition hover:bg-[linear-gradient(90deg,rgba(220,38,38,0.08)_0%,rgba(220,38,38,0)_50%),#111111]">
                  <span>{p.usuario}</span>
                  <button
                    className="h-8 w-8 cursor-pointer rounded-full bg-transparent text-base font-bold leading-none text-red-300 transition hover:bg-red-500/10 hover:text-white"
                    onClick={() => excluirPedido(p.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="depth-divider-left relative z-40 -mt-11 flex min-h-full flex-col items-center gap-3.5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_20%),linear-gradient(180deg,#151515_0%,#111111_100%)] px-[18px] py-3 max-[900px]:mt-0 max-[900px]:min-h-auto max-[900px]:border-t max-[900px]:border-zinc-800 max-[900px]:shadow-none">
          <h2 className="text-[38px] leading-none font-light text-zinc-300 max-[900px]:text-3xl">Cardápio</h2>
          <div className="depth-surface w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-center text-[22px] font-light tracking-wide text-zinc-100 max-[900px]:text-2xl">
            Almoço
          </div>
          <div className="mt-auto flex w-full flex-col gap-2">
            <button className="depth-surface w-full cursor-pointer rounded-lg bg-red-600 px-3.5 py-3 text-base font-bold tracking-wide text-white transition hover:bg-red-500 hover:shadow-[0_6px_28px_rgba(220,38,38,0.4)] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:opacity-45 disabled:shadow-none" onClick={openModal} disabled={!isOpen}>
              {isOpen ? "FAZER PEDIDO" : "PEDIDOS FECHADOS"}
            </button>
          </div>
        </aside>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={closeModal}>
          <div className="depth-surface flex max-h-[80vh] w-[92%] max-w-[640px] flex-col rounded-xl bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-[18px]">
              <h2 className="text-base font-bold text-zinc-100">{confirmStep ? "Confirmar Pedidos" : "Selecionar Almoços"}</h2>
              <button className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full bg-zinc-800 p-0 text-lg leading-none text-zinc-400 transition hover:bg-zinc-700 hover:text-white" onClick={closeModal}>×</button>
            </div>

            {!confirmStep ? (
              <>
                <p className="px-5 pt-3 text-xs text-zinc-500">
                  Clique nos nomes para selecionar. {selectedIds.length > 0 && <strong>{selectedIds.length} selecionado(s)</strong>}
                </p>

                <div className="px-3 pt-3">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar pessoa..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
                  />
                </div>

                <div className="custom-scroll my-2 flex-1 overflow-y-auto px-3 py-2">
                  {filteredUsuarios.map((u) => (
                    <div
                      key={u.id}
                      className={[
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-[11px] text-sm font-medium transition",
                        selectedIds.includes(u.id) ? "bg-red-500/10 text-zinc-100" : "hover:bg-zinc-900",
                      ].join(" ")}
                      onClick={() => toggleUser(u.id)}
                    >
                      <span className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold text-white transition",
                        selectedIds.includes(u.id) ? "border-red-600 bg-red-600" : "border-zinc-600",
                      ].join(" ")}>{selectedIds.includes(u.id) ? "✓" : ""}</span>
                      <span>{u.nome}</span>
                    </div>
                  ))}
                  {filteredUsuarios.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-zinc-500">
                      Nenhum usuário encontrado.
                    </div>
                  )}
                </div>

                <button
                  className="mx-3 mb-3 cursor-pointer rounded-lg bg-red-600 p-3.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={sending || selectedIds.length === 0}
                  onClick={goToConfirm}
                >
                  Continuar com {selectedIds.length} pessoa(s)
                </button>
              </>
            ) : (
              <>
                <p className="px-5 pt-3 text-xs text-zinc-500">
                <strong>Tem certeza que quer adicionar essa(s) pessoa(s)?</strong>.
                </p>

                <div className="custom-scroll my-2 flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
                  {selectedUsers.map((u) => (
                    <div key={u.id} className="depth-surface flex items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-3.5">
                      <span className="text-[23px] leading-[1.15] font-bold">{u.nome}</span>
                      <button
                        className="cursor-pointer rounded-[10px] border border-red-500/35 bg-transparent px-2.5 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={selectedIds.length === 1 || sending}
                        onClick={() => removeFromConfirm(u.id)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                  <button className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 p-3.5 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35" disabled={sending} onClick={() => setConfirmStep(false)}>
                    Voltar
                  </button>
                  <button
                    className="m-0 w-full cursor-pointer rounded-lg bg-red-600 p-3.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30"
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
    </div>
  );
}
