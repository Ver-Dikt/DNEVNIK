"use client";

import { Bot, Check, Send, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Select, Surface, Textarea } from "@/components/ui/native";
import { useModalLayer } from "@/hooks/use-modal-layer";
import type { AIParseResult, DiaryEntry } from "@/lib/types";

export function LocalAssistant({ entries, onProposal }: { entries: DiaryEntry[]; onProposal: (proposal: AIParseResult) => void }) {
  const [open, setOpen] = useState(false);
  return <><div className="assistant-toolbar"><Button onClick={() => setOpen(true)}><Bot size={18} />Локальный помощник<Sparkles size={14} /></Button></div>{open ? <AssistantDialog entries={entries} onClose={() => setOpen(false)} onProposal={proposal => { setOpen(false); onProposal(proposal); }} /> : null}</>;
}

function AssistantDialog({ entries, onClose, onProposal }: { entries: DiaryEntry[]; onClose: () => void; onProposal: (proposal: AIParseResult) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [text, setText] = useState("");
  const [scope, setScope] = useState("all");
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(false);
  const [message, setMessage] = useState("Проверяю локальную модель…");
  useModalLayer(root, onClose);
  async function check() {
    const here = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
    setLocal(here);
    if (!here) { setMessage("Откройте на компьютере ярлык «Ежедневник с ИИ». Он запустит установленную Ollama и локальную версию приложения. На телефоне остаётся обычный разбор и синхронизация Supabase."); return; }
    try {
      const response = await fetch("/api/local-ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setModels(result.models); setModel(result.models.find((name: string) => name === "qwen2.5-coder:7b") ?? result.models[0] ?? "");
      setMessage(result.models.length ? "Модель работает на этом компьютере. Контекст выбранного раздела передаётся только ей." : "Ollama запущена, но установленных моделей нет. Автоматическое скачивание выключено.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось подключиться к Ollama"); }
  }
  useEffect(() => { queueMicrotask(() => { void check(); }); return () => abort.current?.abort(); }, []);
  async function send(action: "chat" | "parse") {
    if (!text.trim() || !model || busy) return;
    const question = text.trim();
    const controller = new AbortController(); abort.current = controller; setBusy(true);
    setMessage(action === "parse" ? "Модель разбирает запись. Результат появится для проверки." : "Модель обдумывает ответ…");
    try {
      const context = entries.filter(entry => scope === "all" || entry.area === scope).map(({ title, kind, status, area, dueDate }) => ({ title, kind, status, area, dueDate }));
      const response = await fetch("/api/local-ai", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ action, model, text: question, context, history }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "parse") { onProposal(result.proposal); return; }
      setHistory(current => [...current, { role: "user", content: question }, { role: "assistant", content: result.answer }]);
      setText(""); setMessage("Ответ готов. Чтобы добавить дела, введите их и нажмите «Разобрать в записи».");
    } catch (error) { setMessage(controller.signal.aborted ? "Запрос остановлен" : error instanceof Error ? error.message : "Не удалось получить ответ"); }
    finally { setBusy(false); abort.current = null; }
  }
  return <div ref={root} className="app-overlay z-[80]" onClick={onClose}><Surface role="dialog" aria-modal="true" aria-label="Локальный помощник" className="app-dialog assistant-dialog" onClick={event => event.stopPropagation()}><div className="dialog-heading"><div><p className="screen-eyebrow">На вашем компьютере</p><h2>Локальный помощник</h2></div><button type="button" className="icon-control" aria-label="Закрыть помощника" onClick={onClose}><X size={20} /></button></div><p role="status" className="assistant-message">{message}</p>
    {local ? <div className="assistant-controls"><div className="grid gap-3 sm:grid-cols-2"><Field label="Установленная модель"><Select value={model} onChange={event => setModel(event.target.value)} disabled={busy || !models.length} aria-label="Установленная модель">{!models.length ? <option value="">Модель не найдена</option> : models.map(name => <option key={name}>{name}</option>)}</Select></Field><Field label="Контекст"><Select aria-label="Контекст помощника" value={scope} onChange={event => setScope(event.target.value)}><option value="all">Все мои записи</option>{[...new Set(entries.map(entry => entry.area).filter(Boolean))].map(area => <option key={area}>{area}</option>)}</Select></Field></div><div className="assistant-chat" aria-live="polite">{history.map((entry, index) => <p className={entry.role} key={index}><b>{entry.role === "user" ? "Вы" : "Помощник"}</b><br />{entry.content}</p>)}</div><Field label="Сообщение или диктовка"><Textarea aria-label="Сообщение помощнику" value={text} onChange={event => setText(event.target.value)} placeholder="Обсудим планы или разберём несколько дел…" disabled={busy} /></Field><div className="flex flex-wrap gap-2"><Button variant="primary" disabled={busy || !model || !text.trim()} onClick={() => void send("chat")}><Send size={16} />Обсудить</Button><Button disabled={busy || !model || !text.trim()} onClick={() => void send("parse")}><Check size={16} />Разобрать в записи</Button>{busy ? <Button onClick={() => abort.current?.abort()}><Square size={16} />Стоп</Button> : <Button onClick={() => void check()}>Проверить соединение</Button>}</div></div> : null}
  </Surface></div>;
}
