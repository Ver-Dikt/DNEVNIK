"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { encodeBackupFiles } from "@/lib/backup-files";
import { cloudKnownState, mergeCloudSnapshots, prepareLocalSnapshot, sameSnapshotContent, type CloudKnownState } from "@/lib/cloud-merge";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { commitCloudSnapshot } from "@/lib/cloud-sync";

type ExportData = () => Promise<Record<string, unknown>>;
type ImportData = (input: unknown) => Promise<boolean>;
export type CloudState = "disabled" | "signed-out" | "connecting" | "synced" | "saving" | "offline" | "error";

export function useCloudSync({ ready, exportData, importData }: { ready: boolean; exportData: ExportData; importData: ImportData }) {
  const clientRef = useRef<SupabaseClient | null>(null);
  const initializedUserRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestExportRef = useRef(exportData);
  const latestImportRef = useRef(importData);
  const syncingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const syncAgainRef = useRef<() => void>(() => undefined);
  const activeUserRef = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<CloudState>(() => process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "connecting" : "disabled");
  const [message, setMessage] = useState("");
  useEffect(() => { latestExportRef.current = exportData; latestImportRef.current = importData; }, [exportData, importData]);

  const runSync = useCallback(async (initial = false) => {
    const client = clientRef.current;
    const user = session?.user;
    if (!client || !user || (!initial && initializedUserRef.current !== user.id)) return false;
    if (syncingRef.current) { pendingSyncRef.current = true; return false; }
    syncingRef.current = true;
    setState(initial ? "connecting" : "saving");
    setMessage(initial ? "Безопасно объединяю данные устройства и облака…" : "Проверяю изменения на других устройствах…");
    try {
      const now = new Date().toISOString();
      const knownState = loadKnownState(user.id);
      const isCurrent = () => activeUserRef.current === user.id;
      const { local, merged } = await commitCloudSnapshot(client, user.id, () => latestExportRef.current(), knownState, isCurrent);
      if (!isCurrent()) return false;
      // Preserve edits made locally while the network request was in flight.
      const latestLocal = await latestExportRef.current();
      const rebased = mergeCloudSnapshots(prepareLocalSnapshot(latestLocal, cloudKnownState(local), now), merged, now);
      const encodedMerged = await encodeBackupFiles(rebased);
      const encodedLocal = await encodeBackupFiles(latestLocal);
      if (!isRecord(encodedMerged) || !isRecord(encodedLocal)) throw new Error("Cloud snapshot encoding failed");
      if (!isCurrent()) return false;
      if (!sameSnapshotContent(encodedLocal, encodedMerged)) {
        const imported = await latestImportRef.current(rebased);
        if (!imported) throw new Error("Merged cloud snapshot was rejected");
      }
      saveKnownState(user.id, cloudKnownState(merged));
      initializedUserRef.current = user.id;
      setState("synced");
      setMessage("Изменения сохранены в Supabase. Другие устройства получат их при подключении.");
      return true;
    } catch {
      if (activeUserRef.current === user.id) {
        setState(navigator.onLine ? "error" : "offline");
        setMessage("Не удалось завершить синхронизацию. Повторю при подключении.");
      }
      return false;
    } finally {
      syncingRef.current = false;
      if (pendingSyncRef.current) { pendingSyncRef.current = false; window.setTimeout(() => syncAgainRef.current(), 300); }
    }
  }, [session]);

  const saveNow = useCallback(() => runSync(initializedUserRef.current !== session?.user.id), [runSync, session?.user.id]);
  useEffect(() => { syncAgainRef.current = () => { void saveNow(); }; return () => { syncAgainRef.current = () => undefined; }; }, [saveNow]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    clientRef.current = client;
    if (!client) { queueMicrotask(() => setState("disabled")); return; }
    client.auth.getSession().then(({ data }) => { activeUserRef.current = data.session?.user.id ?? null; setSession(data.session); });
    const { data } = client.auth.onAuthStateChange((_event, next) => { activeUserRef.current = next?.user.id ?? null; setSession(next); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!clientRef.current || !ready) return;
    if (!user) { initializedUserRef.current = null; queueMicrotask(() => setState("signed-out")); return; }
    if (initializedUserRef.current === user.id) return;
    void runSync(true);
  }, [ready, runSync, session]);

  useEffect(() => {
    if (!ready || !session?.user || initializedUserRef.current !== session.user.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void saveNow(); }, 1400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [exportData, ready, saveNow, session]);

  useEffect(() => {
    if (!ready || !session?.user) return;
    const refresh = () => { if (document.visibilityState === "visible") void saveNow(); };
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [ready, saveNow, session]);

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

  const signOut = useCallback(async () => { activeUserRef.current = null; await clientRef.current?.auth.signOut(); initializedUserRef.current = null; setSession(null); setState("signed-out"); setMessage(""); }, []);
  return { email: session?.user.email ?? null, state, message, authenticate, signOut, saveNow };
}

function loadKnownState(userId: string): CloudKnownState | null {
  try {
    const value = JSON.parse(localStorage.getItem(`dnevnik.cloudKnown.${userId}`) ?? "null") as unknown;
    return isRecord(value) && isRecord(value.knownIds) && isRecord(value.deleted) ? value as unknown as CloudKnownState : null;
  } catch { return null; }
}

function saveKnownState(userId: string, state: CloudKnownState) {
  try { localStorage.setItem(`dnevnik.cloudKnown.${userId}`, JSON.stringify(state)); } catch {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
