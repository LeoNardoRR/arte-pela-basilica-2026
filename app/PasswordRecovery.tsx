"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "./supabase";

let recoverySession: Promise<boolean> | null = null;

function startRecoverySession(): Promise<boolean> {
  if (recoverySession) return recoverySession;

  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const isRecovery = hash.get("type") === "recovery";

  // Remove tokens from the address bar immediately after reading them.
  if (window.location.hash) {
    window.history.replaceState({}, "", `${window.location.pathname}?admin=reset`);
  }

  if (!isRecovery || !accessToken || !refreshToken) {
    recoverySession = Promise.resolve(false);
    return recoverySession;
  }

  recoverySession = supabase.auth
    .setSession({ access_token: accessToken, refresh_token: refreshToken })
    .then(({ data, error }) => !error && Boolean(data.session));
  return recoverySession;
}

export function PasswordRecovery() {
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    void startRecoverySession().then((valid) => {
      if (!active) return;
      setValidLink(valid);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 16) {
      setMessage("Use uma senha com pelo menos 16 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas digitadas não coincidem.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMessage("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
      return;
    }
    setPassword("");
    setConfirmation("");
    setComplete(true);
    await supabase.auth.signOut();
    recoverySession = null;
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="?admin=1">Arte pela Basílica · Área administrativa</a>
      </header>
      <section className="admin-wrap">
        <div className="admin-login">
          <p className="section-kicker">Área restrita</p>
          <h1>Definir nova senha</h1>
          {!ready ? (
            <p role="status">Verificando o link de recuperação…</p>
          ) : complete ? (
            <>
              <p role="status">Senha alterada com sucesso.</p>
              <a className="button primary" href="?admin=1">Entrar no painel</a>
            </>
          ) : !validLink ? (
            <>
              <p role="alert">Este link expirou ou é inválido. Solicite um novo link na tela de acesso administrativo.</p>
              <a className="button primary" href="?admin=1">Voltar ao acesso</a>
            </>
          ) : (
            <form className="admin-auth-form" onSubmit={changePassword}>
              <label>Nova senha
                <input type="password" required minLength={16} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label>Confirmar nova senha
                <input type="password" required minLength={16} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              <button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Salvar nova senha"}</button>
              {message && <p className="admin-notice" role="alert">{message}</p>}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
