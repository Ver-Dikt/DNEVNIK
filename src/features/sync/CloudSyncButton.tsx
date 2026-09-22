"use client";

import { Check, Cloud, CloudOff, LoaderCircle, LogOut, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Input, Surface } from "@/components/ui/native";
import { useModalLayer } from "@/hooks/use-modal-layer";
import type { CloudState } from "@/hooks/use-cloud-sync";

type Props = { email: string | null; state: CloudState; message: string; onAuthenticate: (mode: "signin" | "signup", email: string, password: string) => Promise<{ ok: boolean; message: string }>; onSignOut: () => Promise<void>; onSync: () => Promise<boolean> };
export function CloudSyncButton(props: Props) {
  const [open, setOpen] = useState(false);
  const Icon = props.state === "synced" ? Check : props.state === "saving" || props.state === "connecting" ? LoaderCircle : props.state === "offline" || props.state === "error" ? CloudOff : Cloud;
  return <><button className={`cloud-button is-${props.state}`} type="button" onClick={() => setOpen(true)} aria-label="Облачная синхронизация" title="Облачная синхронизация"><Icon size={19} className={props.state === "saving" || props.state === "connecting" ? "cloud-spin" : ""} /><span>{props.state === "synced" ? "В облаке" : props.state === "saving" ? "Сохраняю" : "Облако"}</span></button>{open ? <CloudDialog {...props} onClose={() => setOpen(false)} /> : null}</>;
}

function CloudDialog({ email: activeEmail, state, message, onClose, onAuthenticate, onSignOut, onSync }: Props & { onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  useModalLayer(root, onClose);
  async function authenticate(mode: "signin" | "signup") { setBusy(true); const result = await onAuthenticate(mode, email, password); setFeedback(result.message); setBusy(false); }
  return <div ref={root} className="app-overlay z-[80]" onClick={onClose}><Surface className="app-dialog cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-title" onClick={event => event.stopPropagation()}><div className="dialog-heading"><div><p className="screen-eyebrow">Общая копия</p><h2 id="cloud-title">Синхронизация</h2></div><button type="button" className="icon-control" aria-label="Закрыть" onClick={onClose}><X size={20} /></button></div>{activeEmail ? <div className="cloud-account"><Cloud size={30} /><div><b>{activeEmail}</b><p>{message || (state === "synced" ? "Телефон и компьютер используют общую копию" : "Локальные данные доступны офлайн")}</p></div><Button disabled={busy} onClick={async () => { setBusy(true); await onSync(); setBusy(false); }}>Синхронизировать сейчас</Button><button className="cloud-signout" type="button" onClick={() => void onSignOut()}><LogOut size={17} /> Выйти</button></div> : <form className="cloud-login" onSubmit={event => { event.preventDefault(); void authenticate("signin"); }}><p>Войди с одной и той же почтой на телефоне и компьютере. При первом входе записи безопасно объединятся — пустое устройство не сотрёт заполненное.</p><label htmlFor="cloud-email">Email</label><Input id="cloud-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" aria-describedby="cloud-feedback" /><label htmlFor="cloud-password">Пароль</label><Input id="cloud-password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="Не короче 8 символов" /><div className="cloud-auth-actions"><Button type="submit" variant="primary" disabled={busy || !email.trim() || password.length < 8}>{busy ? "Подключаю…" : "Войти"}</Button><Button type="button" disabled={busy || !email.trim() || password.length < 8} onClick={() => void authenticate("signup")}>Создать аккаунт</Button></div><p id="cloud-feedback" role="status" aria-live="polite">{feedback}</p></form>}</Surface></div>;
}
