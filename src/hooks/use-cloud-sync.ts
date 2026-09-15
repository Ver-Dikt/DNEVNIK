"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeBackupFiles, encodeBackupFiles } from "@/lib/backup-files";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type ExportData = () => Promise<Record<string, unknown>>;
type ImportData = (input: unknown) => Promise<boolean>;
export type CloudState = "disabled" | "signed-out" | "connecting" | "synced" | "saving" | "offline" | "error";

export function useCloudSync({ ready, exportData, importData }: { ready: boolean; exportData: ExportData; importData: ImportData }) {
  const clientRef = useRef<SupabaseClient | null>(null);
  const initializedUserRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestExportRef = useRef(exportData);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<CloudState>(() => process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "connecting" : "disabled");
  const [message, setMessage] = useState("");
  useEffect(() => { latestExportRef.current = exportData; }, [exportData]);

  const saveNow = useCallback(async () => {
    const client = clientRef.current;
    const user = session?.user;
    if (!client || !user || initializedUserRef.current !== user.id) return false;
    setState("saving");
    try {
      const snapshot = await encodeBackupFiles(await latestExportRef.current());
      const { error } = await client.from("app_state").upsert({ user_id: user.id, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      setState("synced"); setMessage("Сохранено в облаке"); return true;
    } catch {
      setState(navigator.onLine ? "error" : "offline");
      setMessage("Локальная копия сохранена. Облако повторит попытку при следующем изменении.");
      return false;
    }
  }, [session]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    clientRef.current = client;
    if (!client) { queueMicrotask(() => setState("disabled")); return; }
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    const user = session?.user;
    if (!client || !ready) return;
    if (!user) { initializedUserRef.current = null; queueMicrotask(() => setState("signed-out")); return; }
    if (initializedUserRef.current === user.id) return;
    let cancelled = false;
    setState("connecting"); setMessage("Проверяю облачную копию…");
    void (async () => {
      try {
        const { data, error } = await client.from("app_state").select("data").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const remote = data?.data as Record<string, unknown> | null | undefined;
        if (remote && Array.isArray(remote.entries)) {
          await importData(decodeBackupFiles(remote));
          setMessage("Облачная копия загружена");
        } else {
          const snapshot = await encodeBackupFiles(await latestExportRef.current());
          const { error: uploadError } = await client.from("app_state").upsert({ user_id: user.id, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
          if (uploadError) throw uploadError;
          setMessage("Данные этого телефона сохранены в облаке");
        }
        initializedUserRef.current = user.id;
        setState("synced");
      } catch {
        if (!cancelled) { setState(navigator.onLine ? "error" : "offline"); setMessage("Не удалось подключить облако. Локальные данные не затронуты."); }
      }
    })();
    return () => { cancelled = true; };
  }, [importData, ready, session]);

  useEffect(() => {
    if (!ready || !session?.user || initializedUserRef.current !== session.user.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void saveNow(); }, 1400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [exportData, ready, saveNow, session]);

  const authenticate = useCallback(async (mode: "signin" | "signup", email: string, password: string) => {
    const client = clientRef.current;
    if (!client) return { ok: false, message: "Supabase не настроен" };
    setState("connecting");
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const emailRedirectTo = `${window.location.origin}${basePath}/`;
    const result = mode === "signup"
      ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo } })
      : await client.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) { setState("signed-out"); return { ok: false, message: mode === "signup" ? "Не удалось создать аккаунт. Проверь адрес и длину пароля." : "Не удалось войти. Проверь почту и пароль." }; }
    if (mode === "signup" && !result.data.session) { setState("signed-out"); return { ok: true, message: "Аккаунт создан. Подтверди почту, затем вернись и нажми «Войти»." }; }
    return { ok: true, message: "Вход выполнен. Подключаю облачную копию…" };
  }, []);

  const signOut = useCallback(async () => { await clientRef.current?.auth.signOut(); initializedUserRef.current = null; setSession(null); setState("signed-out"); setMessage(""); }, []);
  return { email: session?.user.email ?? null, state, message, authenticate, signOut, saveNow };
}
