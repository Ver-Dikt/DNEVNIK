"use client";
import { Bot, Mic, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Field, Select, Surface, Textarea } from "@/components/ui/native";
import { useModalLayer } from "@/hooks/use-modal-layer";
import { validateAssistantPlan, type AssistantPlan } from "@/lib/assistant-actions";
import type { AIParseResult, DiaryEntry, ProjectNode, Space } from "@/lib/types";

type Props = { entries: DiaryEntry[]; projects: ProjectNode[]; spaces: Space[]; syncMessage: string; onSync: () => Promise<boolean>; onApply: (plan: AssistantPlan) => Promise<void>; onOrganize: () => Promise<void>; onProposal: (proposal: AIParseResult) => void };
const subscribe = () => () => {};
const isLocal = () => ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
export function LocalAssistant(props: Props) {
  const [open, setOpen] = useState(false);
  const local = useSyncExternalStore(subscribe, isLocal, () => false);
  if (!local) return null;
  return <><div className="assistant-toolbar"><Button onClick={() => setOpen(true)}><Bot size={18} />Локальный помощник</Button></div>{open ? <AssistantDialog {...props} onClose={() => setOpen(false)} onProposal={proposal => { setOpen(false); props.onProposal(proposal); }} /> : null}</>;
}
function AssistantDialog({ entries, projects, spaces, syncMessage, onSync, onApply, onOrganize, onProposal, onClose }: Props & { onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const speech = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(null);
  const [listening, setListening] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [text, setText] = useState("");
  const [scope, setScope] = useState("all");
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [message, setMessage] = useState("Проверяю локальную модель…");
  useModalLayer(root, onClose);
  async function check() {
    try {
      const response = await fetch("/api/local-ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setModels(result.models); setModel(result.models.find((name: string) => name === "qwen2.5-coder:7b") ?? result.models[0] ?? "");
      setMessage(result.models.length ? "Создание, перенос, редактирование, завершение записей и вложенные проекты. Изменения сначала показываются для проверки." : "В Ollama нет установленных локальных моделей.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось подключиться к Ollama"); }
  }
  useEffect(() => { queueMicrotask(() => { void check(); }); return () => { abort.current?.abort(); speech.current?.abort(); }; }, []);
  function dictate() {
    if (speech.current) { speech.current.stop(); return; }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setMessage("Голосовой ввод не поддерживается этим браузером. Используйте Chrome или введите команду текстом."); return; }
    const recognition = new Recognition();
    recognition.lang = "ru-RU"; recognition.continuous = true; recognition.interimResults = true;
    const base = text.trim();
    recognition.onresult = event => { setText([base, Array.from(event.results).map(item => item[0].transcript).join(" ")].filter(Boolean).join(" ")); setPlan(null); };
    recognition.onstart = () => setListening(true);
    recognition.onend = () => { speech.current = null; setListening(false); };
    recognition.onerror = event => setMessage(event.error === "not-allowed" ? "Разрешите микрофон в браузере для голосового управления." : "Распознавание остановлено. Текст остался в поле ввода.");
    speech.current = recognition;
    try { recognition.start(); } catch { speech.current = null; setListening(false); setMessage("Не удалось запустить микрофон"); }
  }
  async function send(action: "chat" | "parse" | "manage", suppliedText = text) {
    if (!suppliedText.trim() || !model || busy || listening) return;
    const question = suppliedText.trim();
    const controller = new AbortController(); abort.current = controller; setBusy(true); setPlan(null); setMessage("Модель обрабатывает запрос на этом компьютере…");
    try {
      const selected = entries.filter(entry => scope === "all" || entry.area === scope);
      if(selected.length > 150) throw new Error("Выберите отдельный раздел: в одном запросе доступно до 150 записей");
      const context = selected.map(({ id, title, kind, status, area, dueDate, projectPath, assignedTo, priority, revision, description }) => ({ id, title, kind, status, area, dueDate, projectPath, assignedTo, priority, revision, description: description?.slice(0, 500) }));
      const response = await fetch("/api/local-ai", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ action, model, text: question, context, projects: projects.map(({ id, name, area, parentId }) => ({ id, name, area, parentId })), spaces: spaces.map(({ id, name }) => ({ id, name })), history }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "parse") { onProposal(result.proposal); return; }
      if (action === "manage") { const proposed = validateAssistantPlan(result.plan, entries, question); setPlan(proposed); setMessage(proposed.actions.length ? "Проверьте план. До нажатия «Применить изменения» записи не изменятся." : proposed.answer); return; }
      setHistory(current => [...current.slice(-10), { role: "user", content: question }, { role: "assistant", content: result.answer }]); setText(""); setMessage("Ответ готов");
    } catch (error) { setMessage(controller.signal.aborted ? "Запрос остановлен" : error instanceof Error ? error.message : "Не удалось получить ответ"); }
    finally { setBusy(false); abort.current = null; }
  }
  async function perform(action: "apply" | "sync" | "organize") {
    if(busy) return;
    setBusy(true);
    try {
      if(action === "sync") setMessage(await onSync() ? "Синхронизация завершена" : "Синхронизация не завершена. Проверьте вход через «Облако» и интернет.");
      else if(action === "organize") { await onOrganize(); setPlan(null); setMessage("Проекты упорядочены по сохранённым путям. Исходные тексты и категории сохранены."); }
      else if(plan) { await onApply(plan); setPlan(null); setText(""); setMessage("Изменения сохранены на устройстве. Подключённая синхронизация отправит их в Supabase."); }
    } catch(error) { setMessage(error instanceof Error ? error.message : "Не удалось выполнить действие"); }
    finally { setBusy(false); }
  }
  const summary = (patch: Partial<DiaryEntry>) => Object.entries(patch).filter(([key]) => ["title","kind","area","projectPath","status","priority","assignedTo","dueDate","notes","description"].includes(key)).map(([key,value]) => `${({title:"Название",kind:"Тип",area:"Раздел",projectPath:"Проект",status:"Статус",priority:"Приоритет",assignedTo:"Кому",dueDate:"Дата",notes:"Заметки",description:"Описание"} as Record<string,string>)[key]}: ${Array.isArray(value) ? value.join(" / ") : value ?? "убрать"}`).join(" · ");
  return <div ref={root} className="app-overlay z-[80]" onClick={onClose}><Surface role="dialog" aria-modal="true" aria-label="Локальный помощник" className="app-dialog assistant-dialog" onClick={event => event.stopPropagation()}>
    <div className="dialog-heading"><div><p className="screen-eyebrow">Управление ежедневником</p><h2>Локальный помощник</h2></div><button type="button" className="icon-control" aria-label="Закрыть помощника" onClick={onClose}><X size={20} /></button></div>
    <p role="status" className="assistant-message">{message}</p><p className="text-sm text-[var(--muted)]">{syncMessage || "Облако: откройте кнопку синхронизации для входа"}</p>
    <div className="assistant-controls"><div className="grid gap-3 sm:grid-cols-2"><Field label="Установленная модель"><Select value={model} onChange={event => setModel(event.target.value)} disabled={busy || !models.length}>{!models.length ? <option value="">Модель не найдена</option> : models.map(name => <option key={name}>{name}</option>)}</Select></Field><Field label="Контекст"><Select value={scope} disabled={busy} onChange={event => { setScope(event.target.value); setPlan(null); }}><option value="all">Все мои записи</option>{[...new Set(entries.map(entry => entry.area).filter(Boolean))].map(area => <option key={area}>{area}</option>)}</Select></Field></div>
    <div className="assistant-chat" aria-live="polite">{history.map((entry,index) => <p className={entry.role} key={index}><b>{entry.role === "user" ? "Вы" : "Помощник"}</b><br />{entry.content}</p>)}</div>
    <Field label="Команда текстом или голосом"><Textarea aria-label="Сообщение помощнику" value={text} readOnly={listening} onChange={event => { setText(event.target.value); setPlan(null); }} placeholder="Перенеси задачу «Покрасить стены» в Дом / Ремонт / Кухня и поставь срок завтра" disabled={busy} /></Field>
    <p className="text-xs text-[var(--muted)]">Ollama обрабатывает команды локально. Голос распознаёт браузер; для этого может понадобиться интернет.</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy} aria-pressed={listening} onClick={dictate}><Mic size={16} />{listening ? "Остановить диктовку" : "Продиктовать"}</Button>{([['manage','Выполнить команду'],['parse','Разобрать в записи'],['chat','Обсудить']] as const).map(([action,label]) => <Button key={action} variant={action === "manage" ? "primary" : "plain"} disabled={busy || listening || !model || !text.trim()} onClick={() => void send(action)}>{label}</Button>)}{busy ? <Button onClick={() => abort.current?.abort()}>Стоп</Button> : <Button onClick={() => void check()}>Проверить модель</Button>}</div>
    {plan && (plan.actions.length || plan.sync) ? <section className="assistant-plan grid gap-3" aria-label="Предварительный план изменений"><h3>Будет выполнено</h3>{plan.actions.map((action,index) => <div key={index} className="p-3 rounded-2xl border border-[var(--line)]"><b>{action.type === "project" ? "Новый проект" : action.type === "create" ? `Новая запись: ${action.entry.title}` : action.title}</b><p className="text-sm whitespace-pre-wrap">{action.type === "project" ? action.path.join(" / ") : summary(action.type === "update" ? action.patch : action.entry)}</p></div>)}{plan.sync ? <p>Проверить синхронизацию с облаком</p> : null}<Button variant="primary" disabled={busy} onClick={() => void perform("apply")}>Применить изменения</Button><Button disabled={busy} onClick={() => setPlan(null)}>Отменить план</Button></section> : null}
    <details><summary className="cursor-pointer py-3 font-bold">Обслуживание записей</summary><div className="flex flex-wrap gap-2 py-2"><Button disabled={busy || listening || !model} onClick={() => void send("manage", "Проверь все записи выбранного контекста. Предложи исправления типов, разделов и вложенных проектов только там, где исходный смысл однозначен. Сохрани описания, исходные тексты, цены, даты и владельцев. Непонятные записи оставь без изменений. Не создавай дубли. Верни план изменений для проверки.")}>Разобрать записи раздела</Button><Button disabled={busy || listening} onClick={() => void perform("organize")}>Упорядочить проекты</Button><Button disabled={busy || listening} onClick={() => void perform("sync")}>Синхронизировать сейчас</Button></div></details>
    </div>
  </Surface></div>;
}
