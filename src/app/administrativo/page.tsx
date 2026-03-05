"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type ResumoMensalResponse } from "@/lib/api";

type LoadingState = "idle" | "loading" | "ready" | "error";

export default function AdministrativoPage() {
  const [username, setUsername] = useState("administrativo");
  const [senha, setSenha] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");

  const [periodo, setPeriodo] = useState<"atual" | "anterior">("atual");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState("");
  const [relatorio, setRelatorio] = useState<ResumoMensalResponse | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        api.loadSession();
        if (!api.isAuthenticated()) {
          setAuthReady(true);
          return;
        }

        const admin = await api.getAdminSecret();
        if (admin.username !== "administrativo") {
          await api.logout();
          setAuthReady(true);
          return;
        }

        setIsLoggedIn(true);
      } catch {
        await api.logout();
      } finally {
        setAuthReady(true);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const carregarRelatorio = async () => {
      setLoading("loading");
      setError("");
      try {
        const data =
          periodo === "atual"
            ? await api.getRelatorioMensal()
            : await api.getRelatorioMensalAnterior();
        setRelatorio(data);
        setLoading("ready");
      } catch (e) {
        setLoading("error");
        setError(e instanceof Error ? e.message : "Erro ao carregar relatório");
      }
    };

    carregarRelatorio();
  }, [isLoggedIn, periodo]);

  const fazerLogin = async () => {
    setAuthError("");
    if (username.trim().toLowerCase() !== "administrativo") {
      setAuthError("Somente o usuário administrativo pode acessar essa tela");
      return;
    }

    try {
      await api.login(username.trim(), senha);
      const admin = await api.getAdminSecret();
      if (admin.username !== "administrativo") {
        await api.logout();
        setAuthError("Acesso permitido apenas para o login administrativo");
        return;
      }
      setIsLoggedIn(true);
      setSenha("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Falha no login");
    }
  };

  const sair = async () => {
    await api.logout();
    setIsLoggedIn(false);
    setRelatorio(null);
  };

  const linhas = useMemo(() => {
    if (!relatorio) return [];
    return relatorio.resumo.map((item) => {
      const dias = Object.keys(item.dias)
        .map((dia) => Number(dia))
        .filter((dia) => !Number.isNaN(dia))
        .sort((a, b) => a - b)
        .map((dia) => String(dia).padStart(2, "0"));

      return {
        ...item,
        diasTexto: dias.length > 0 ? dias.join(", ") : "—",
      };
    });
  }, [relatorio]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-zinc-700 border-t-red-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(1200px_500px_at_-10%_-20%,rgba(220,38,38,0.10),transparent_55%),linear-gradient(180deg,#0f0f10_0%,#0a0a0a_55%,#070707_100%)] p-4 text-zinc-100">
        <div className="w-full max-w-[380px] rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
          <h1 className="text-xl font-bold text-zinc-100">Administrativo</h1>
          <p className="mt-1 text-sm text-zinc-400">Acesso exclusivo para o relatório mensal de pedidos.</p>

          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nome"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-red-500/70"
              onKeyDown={(e) => {
                if (e.key === "Enter") fazerLogin();
              }}
            />
            {authError && <p className="text-xs text-red-300">{authError}</p>}
            <button
              className="w-full cursor-pointer rounded-lg bg-red-600 p-3 text-sm font-bold text-white transition hover:bg-red-500"
              onClick={fazerLogin}
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_-10%_-20%,rgba(220,38,38,0.10),transparent_55%),linear-gradient(180deg,#0f0f10_0%,#0a0a0a_55%,#070707_100%)] px-6 py-5 text-zinc-100">
      <div className="mx-auto w-full max-w-[1080px] rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Relatório mensal de pedidos</h1>
            <p className="text-xs text-zinc-400">
              {relatorio ? `${relatorio.data_inicio} até ${relatorio.data_fim}` : ""}
            </p>
          </div>
          <button
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800"
            onClick={sair}
          >
            Sair
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            className={[
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition",
              periodo === "atual"
                ? "bg-red-600 text-white"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
            ].join(" ")}
            onClick={() => setPeriodo("atual")}
          >
            Mês atual
          </button>
          <button
            className={[
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition",
              periodo === "anterior"
                ? "bg-red-600 text-white"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
            ].join(" ")}
            onClick={() => setPeriodo("anterior")}
          >
            Mês anterior
          </button>
        </div>

        {loading === "loading" && (
          <div className="py-10 text-center text-sm text-zinc-400">Carregando relatório...</div>
        )}

        {loading === "error" && (
          <div className="py-10 text-center text-sm text-red-300">{error || "Erro ao carregar relatório"}</div>
        )}

        {loading === "ready" && (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <div className="grid grid-cols-[1.5fr_120px_2fr] border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.6px] text-zinc-400">
              <span>Pessoa</span>
              <span>Total no mês</span>
              <span>Dias que pediu</span>
            </div>
            {linhas.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">Nenhum pedido encontrado no período.</div>
            ) : (
              linhas.map((linha) => (
                <div
                  key={linha.usuario_id}
                  className="grid grid-cols-[1.5fr_120px_2fr] border-b border-zinc-900 px-3 py-2.5 text-sm"
                >
                  <span>{linha.usuario}</span>
                  <span className="font-bold text-zinc-200">{linha.qtde}</span>
                  <span className="text-zinc-300">{linha.diasTexto}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
