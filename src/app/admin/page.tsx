"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AutoPedidoSemanal, type Usuario } from "@/lib/api";

type Toast = { id: number; msg: string; type: "ok" | "err" };
let tid = 0;
const ONLY_LETTERS_AND_SPACES = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?: [A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

function normalizePersonName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="fixed right-4 top-[20px] z-[300] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            "max-w-[320px] rounded-lg border px-4 py-2 text-sm font-medium",
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

export default function AdminPage() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [canManageAutoWeekly, setCanManageAutoWeekly] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [updatingUsuarioId, setUpdatingUsuarioId] = useState<number | null>(null);
  const [novoUsuarioNome, setNovoUsuarioNome] = useState("");
  const [buscaNomeInput, setBuscaNomeInput] = useState("");
  const [creatingUsuario, setCreatingUsuario] = useState(false);
  const [addUsuarioModalOpen, setAddUsuarioModalOpen] = useState(false);
  const [deleteUsuarioTarget, setDeleteUsuarioTarget] = useState<Usuario | null>(null);
  const [deleteUsuarioConfirmName, setDeleteUsuarioConfirmName] = useState("");
  const [deletingUsuario, setDeletingUsuario] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [autoPedidosSemanais, setAutoPedidosSemanais] = useState<AutoPedidoSemanal[]>([]);
  const [loadingAutoPedidos, setLoadingAutoPedidos] = useState(false);
  const [addingAutoPedido, setAddingAutoPedido] = useState(false);
  const [removingAutoPedidoUserId, setRemovingAutoPedidoUserId] = useState<number | null>(null);
  const [autoPedidoUsuarioId, setAutoPedidoUsuarioId] = useState<number | "">("");

  const toast = useCallback((msg: string, type: Toast["type"] = "ok") => {
    const id = ++tid;
    setToasts((p) => [...p, { id, msg, type }]);
    window.setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const loadUsuariosAdmin = useCallback(async () => {
    setLoadingUsuarios(true);
    try {
      const data = await api.getAdminUsuarios();
      setUsuarios(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao carregar usuários";
      toast(msg, "err");
    } finally {
      setLoadingUsuarios(false);
    }
  }, [toast]);

  const loadAutoPedidosSemanais = useCallback(async () => {
    setLoadingAutoPedidos(true);
    try {
      const data = await api.getAutoPedidosSemanais();
      setAutoPedidosSemanais(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao carregar pedidos automáticos";
      toast(msg, "err");
    } finally {
      setLoadingAutoPedidos(false);
    }
  }, [toast]);

  const validateSession = useCallback(async () => {
    api.loadSession();
    if (!api.isAuthenticated()) {
      setIsLoggedIn(false);
      setAuthReady(true);
      return;
    }
    try {
      const admin = await api.getAdminSecret();
      setAdminName(admin.usuario);
      setAdminUsername(admin.username);
      setCanManageAutoWeekly(Boolean(admin.can_manage_auto_weekly));
      setIsLoggedIn(true);
      setAuthReady(true);
    } catch {
      await api.logout();
      setIsLoggedIn(false);
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadUsuariosAdmin();
  }, [isLoggedIn, loadUsuariosAdmin]);

  useEffect(() => {
    if (!isLoggedIn || !canManageAutoWeekly) return;
    loadAutoPedidosSemanais();
  }, [isLoggedIn, canManageAutoWeekly, loadAutoPedidosSemanais]);

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword) {
      toast("Preencha usuário e senha", "err");
      return;
    }
    setLoginLoading(true);
    try {
      await api.login(loginUsername.trim(), loginPassword);
      const admin = await api.getAdminSecret();
      setAdminName(admin.usuario);
      setAdminUsername(admin.username);
      setCanManageAutoWeekly(Boolean(admin.can_manage_auto_weekly));
      setIsLoggedIn(true);
      setLoginPassword("");
      toast("Login realizado com sucesso");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha no login";
      toast(msg, "err");
      setIsLoggedIn(false);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setIsLoggedIn(false);
    setAdminName("");
    setAdminUsername("");
    setCanManageAutoWeekly(false);
    setAutoPedidosSemanais([]);
  };

  const adicionarAutoPedidoSemanal = async () => {
    if (!canManageAutoWeekly) {
      toast("Somente o usuário garten pode ativar", "err");
      return;
    }
    if (!autoPedidoUsuarioId || addingAutoPedido) return;

    setAddingAutoPedido(true);
    try {
      const created = await api.addAutoPedidoSemanal(autoPedidoUsuarioId);
      setAutoPedidosSemanais((prev) => {
        const withoutCurrent = prev.filter((item) => item.usuario_id !== created.usuario_id);
        return [created, ...withoutCurrent];
      });
      setAutoPedidoUsuarioId("");
      toast(`Pedido automático ativado para ${created.usuario_nome}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao ativar pedido automático";
      toast(msg, "err");
    } finally {
      setAddingAutoPedido(false);
    }
  };

  const removerAutoPedidoSemanal = async (usuarioId: number) => {
    if (!canManageAutoWeekly || removingAutoPedidoUserId !== null) return;

    setRemovingAutoPedidoUserId(usuarioId);
    try {
      await api.removeAutoPedidoSemanal(usuarioId);
      setAutoPedidosSemanais((prev) => prev.filter((item) => item.usuario_id !== usuarioId));
      toast("Pedido automático semanal removido");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao remover pedido automático";
      toast(msg, "err");
    } finally {
      setRemovingAutoPedidoUserId(null);
    }
  };

  const enviarEmailDebug = async () => {
    if (sendingEmail) return;
    setSendingEmail(true);
    try {
      const result = await api.testEmail();
      toast(result.message || "E-mail debug enviado com sucesso!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao enviar e-mail debug";
      toast(msg, "err");
    } finally {
      setSendingEmail(false);
    }
  };

  const criarUsuarioAdmin = async () => {
    const nome = normalizePersonName(novoUsuarioNome);
    if (!nome) {
      toast("Informe o nome da pessoa", "err");
      return;
    }

    if (!ONLY_LETTERS_AND_SPACES.test(nome)) {
      toast("Digite somente letras no nome", "err");
      return;
    }

    const nomeJaExiste = usuarios.some(
      (u) => normalizePersonName(u.nome).toLocaleLowerCase() === nome.toLocaleLowerCase()
    );
    if (nomeJaExiste) {
      toast("Já existe uma pessoa com esse nome", "err");
      return;
    }

    if (!window.confirm(`Confirma criar a pessoa \"${nome}\" no banco?`)) {
      return;
    }

    setCreatingUsuario(true);
    try {
      await api.criarUsuario(nome, true);
      setNovoUsuarioNome("");
      setAddUsuarioModalOpen(false);
      toast("Pessoa adicionada com sucesso");
      await loadUsuariosAdmin();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao adicionar pessoa";
      toast(msg, "err");
    } finally {
      setCreatingUsuario(false);
    }
  };

  const alternarStatusUsuario = async (usuario: Usuario) => {
    if (updatingUsuarioId !== null) return;
    setUpdatingUsuarioId(usuario.id);
    try {
      const atualizado = await api.setUsuarioStatus(usuario.id, !usuario.ativo);
      setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      toast(atualizado.ativo ? "Usuário ativado" : "Usuário desativado");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao atualizar status";
      toast(msg, "err");
    } finally {
      setUpdatingUsuarioId(null);
    }
  };

  const confirmarExclusaoUsuario = async () => {
    if (!deleteUsuarioTarget || deletingUsuario) return;

    const expectedName = normalizePersonName(deleteUsuarioTarget.nome);
    const typedName = normalizePersonName(deleteUsuarioConfirmName);
    if (typedName !== expectedName) {
      toast("Digite o nome exatamente para confirmar", "err");
      return;
    }

    setDeletingUsuario(true);
    try {
      await api.deletarUsuario(deleteUsuarioTarget.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== deleteUsuarioTarget.id));
      setDeleteUsuarioTarget(null);
      setDeleteUsuarioConfirmName("");
      toast("Pessoa excluída do banco");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao excluir pessoa";
      toast(msg, "err");
    } finally {
      setDeletingUsuario(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const termo = normalizePersonName(buscaNomeInput).toLocaleLowerCase();
    if (termo.length < 3) return true;
    return normalizePersonName(u.nome).toLocaleLowerCase().includes(termo);
  });

  const usuariosElegiveisAutoPedido = usuarios
    .filter((u) => u.ativo)
    .filter((u) => !autoPedidosSemanais.some((item) => item.usuario_id === u.id));

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-zinc-700 border-t-red-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(1200px_500px_at_-10%_-20%,rgba(220,38,38,0.10),transparent_55%),linear-gradient(180deg,#0f0f10_0%,#0a0a0a_55%,#070707_100%)] p-4 text-zinc-100">
        <Toasts items={toasts} />
        <div className="depth-surface w-full max-w-[380px] rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
          <h1 className="text-xl font-bold text-zinc-100">Login Admin</h1>
          <p className="mt-1 text-sm text-zinc-400">Acesso restrito ao painel administrativo.</p>

          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              autoComplete="username"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Usuário"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loginLoading) handleLogin();
              }}
            />
            <button
              className="w-full cursor-pointer rounded-lg bg-red-600 p-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(1200px_500px_at_-10%_-20%,rgba(220,38,38,0.10),transparent_55%),radial-gradient(900px_420px_at_110%_10%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(180deg,#0f0f10_0%,#0a0a0a_55%,#070707_100%)] text-zinc-100">
      <Toasts items={toasts} />

      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-black bg-black px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg">
            <img src="/logo.svg" alt="Logo GRT Food" className="h-8 w-8" />
          </div>
          <span className="text-[17px] font-bold text-zinc-100">GRT Food</span>
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.8px] text-white">Plus</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.25)]" />
          Admin
        </div>
      </header>

      <div className="w-full border-b border-zinc-800 bg-black/20 px-6 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Logado como {adminName} ({adminUsername})</p>
          <div className="flex gap-2">
            <button
              className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800"
              onClick={enviarEmailDebug}
              disabled={sendingEmail}
            >
              {sendingEmail ? "ENVIANDO EMAIL..." : "ENVIAR EMAIL DEBUG"}
            </button>
            <button
              className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800"
              onClick={handleLogout}
            >
              SAIR
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
          <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-zinc-300">Pedido automático semanal</h2>
              <span className="text-[11px] text-zinc-500">Reseta automaticamente na sexta-feira</span>
            </div>

            {!canManageAutoWeekly ? (
              <p className="text-xs text-zinc-500">Somente o usuário de login <strong className="text-zinc-300">garten</strong> pode ativar/desativar.</p>
            ) : (
              <>
                <div className="mb-2 flex gap-2">
                  <select
                    value={autoPedidoUsuarioId}
                    onChange={(e) => setAutoPedidoUsuarioId(e.target.value ? Number(e.target.value) : "")}
                    className="h-10 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none"
                    disabled={addingAutoPedido || usuariosElegiveisAutoPedido.length === 0}
                  >
                    <option value="">Selecione uma pessoa...</option>
                    {usuariosElegiveisAutoPedido.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  <button
                    className="cursor-pointer rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={adicionarAutoPedidoSemanal}
                    disabled={addingAutoPedido || !autoPedidoUsuarioId}
                  >
                    {addingAutoPedido ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>

                <div className="custom-scroll max-h-[160px] overflow-y-auto rounded-lg border border-zinc-800">
                  {loadingAutoPedidos ? (
                    <div className="px-3 py-3 text-xs text-zinc-400">Carregando...</div>
                  ) : autoPedidosSemanais.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-zinc-500">Nenhuma pessoa configurada para pedido automático.</div>
                  ) : (
                    autoPedidosSemanais.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b border-zinc-900 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200">{item.usuario_nome}</span>
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">Ativo</span>
                        </div>
                        <button
                          className="cursor-pointer rounded border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
                          onClick={() => removerAutoPedidoSemanal(item.usuario_id)}
                          disabled={removingAutoPedidoUserId === item.usuario_id}
                        >
                          {removingAutoPedidoUserId === item.usuario_id ? "Removendo..." : "Remover"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-300">Pessoas (banco de dados)</h2>
            <div className="flex items-center gap-2">
              <button
                className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setAddUsuarioModalOpen(true)}
              >
                + Adicionar
              </button>
              <button
                className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800"
                onClick={loadUsuariosAdmin}
                disabled={loadingUsuarios}
              >
                {loadingUsuarios ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
          </div>

          <div className="mb-3 flex h-10 items-stretch overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
            <input
              type="text"
              value={buscaNomeInput}
              onChange={(e) => setBuscaNomeInput(e.target.value)}
              placeholder="Filter or search (3 character minimum)"
              className="h-full flex-1 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500"
            />
            <div className="grid w-11 place-items-center border-l border-zinc-700 text-zinc-400" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
              </svg>
            </div>
          </div>

          <div className="custom-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-800">
            {usuariosFiltrados.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">Nenhum usuário encontrado.</div>
            ) : (
              usuariosFiltrados.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 border-b border-zinc-900 px-4 py-3 text-sm">
                  <div className="min-w-0 flex items-center gap-2">
                    <span>{u.nome}</span>
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.6px]",
                        u.ativo ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300",
                      ].join(" ")}
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      className="min-w-[96px] cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => alternarStatusUsuario(u)}
                      disabled={updatingUsuarioId === u.id}
                    >
                      {updatingUsuarioId === u.id
                        ? "Salvando..."
                        : u.ativo
                          ? "Desativar"
                          : "Ativar"}
                    </button>
                    <button
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-red-500/35 text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => {
                        setDeleteUsuarioTarget(u);
                        setDeleteUsuarioConfirmName("");
                      }}
                      disabled={deletingUsuario}
                      aria-label={`Excluir ${u.nome}`}
                      title={`Excluir ${u.nome}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l1 14h8l1-14" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {deleteUsuarioTarget && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => {
            if (deletingUsuario) return;
            setDeleteUsuarioTarget(null);
            setDeleteUsuarioConfirmName("");
          }}
        >
          <div
            className="depth-surface flex w-[90%] max-w-[460px] flex-col rounded-xl bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-zinc-100">Excluir pessoa do banco</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Para confirmar, digite o nome <strong className="text-zinc-200">{deleteUsuarioTarget.nome}</strong>
              </p>
            </div>

            <div className="px-4 py-3">
              <input
                type="text"
                value={deleteUsuarioConfirmName}
                onChange={(e) => setDeleteUsuarioConfirmName(e.target.value)}
                placeholder="Digite o nome para confirmar"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <button
                className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => {
                  setDeleteUsuarioTarget(null);
                  setDeleteUsuarioConfirmName("");
                }}
                disabled={deletingUsuario}
              >
                Cancelar
              </button>
              <button
                className="w-full cursor-pointer rounded-lg bg-red-600 p-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={confirmarExclusaoUsuario}
                disabled={deletingUsuario}
              >
                {deletingUsuario ? "Excluindo..." : "Excluir pessoa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addUsuarioModalOpen && (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => {
            if (creatingUsuario) return;
            setAddUsuarioModalOpen(false);
            setNovoUsuarioNome("");
          }}
        >
          <div
            className="depth-surface flex w-[90%] max-w-[460px] flex-col rounded-xl bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-zinc-100">Adicionar pessoa</h3>
              <p className="mt-1 text-sm text-zinc-400">Digite o nome para cadastrar no banco</p>
            </div>

            <div className="px-4 py-3">
              <input
                type="text"
                value={novoUsuarioNome}
                onChange={(e) => setNovoUsuarioNome(e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, ""))}
                placeholder="Nome da pessoa"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creatingUsuario) criarUsuarioAdmin();
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <button
                className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => {
                  setAddUsuarioModalOpen(false);
                  setNovoUsuarioNome("");
                }}
                disabled={creatingUsuario}
              >
                Cancelar
              </button>
              <button
                className="w-full cursor-pointer rounded-lg bg-red-600 p-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={criarUsuarioAdmin}
                disabled={creatingUsuario}
              >
                {creatingUsuario ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
