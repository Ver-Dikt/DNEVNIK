"use client";
import { ArrowUp, Bot, ChevronDown, MessageCircle, Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Field, Select, Textarea } from "@/components/ui/native";
import { validateAssistantPlan, type AssistantAction, type AssistantPlan } from "@/lib/assistant-actions";
import { confirmationIntent, conversationHistory, restoreConversation, type ChatMessage } from "@/lib/conversation";
import { useLocalDictation } from "@/hooks/use-local-dictation";
import type { DiaryEntry, ProjectNode, Space } from "@/lib/types";
import { navigationTarget, screenNames } from "@/lib/assistant-navigation";
import type { ScreenId } from "@/features/app/types";
import { selectAssistantContext, type AssistantExtras } from "@/lib/assistant-context";

type Props = { entries: DiaryEntry[]; projects: ProjectNode[]; spaces: Space[]; extras: AssistantExtras; syncMessage: string; storageScope: string; currentScreen: string; onNavigate: (screen: ScreenId) => void; onOpenEntry: (id: string) => void; onSync: () => Promise<boolean>; onApply: (plan: AssistantPlan) => Promise<void> };
const subscribe = () => () => {};
const isLocal = () => ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
export function LocalAssistant(props: Props) {
  const local = useSyncExternalStore(subscribe, isLocal, () => false);
  return local ? <DiaryConversation {...props} /> : null;
}
function DiaryConversation({ entries, projects, spaces, extras, syncMessage, storageScope, currentScreen, onNavigate, onOpenEntry, onSync, onApply }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);



  const generation = useRef(0);
  const sendRef = useRef<(value: string, voice?: boolean) => void>(() => undefined);
  const dictation = useLocalDictation(text, value => { setText(value); sendRef.current(value,true); });
  const cancelDictation = dictation.cancel;
  const voiceActive = dictation.phase !== "idle";
  const listening = dictation.phase === "recording";
  const log = useRef<HTMLDivElement>(null);
  const storageKey = `dnevnik.chat.v1.${encodeURIComponent(storageScope)}`;
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if(cancelled) return;
      try { const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); setMessages(restoreConversation(value.messages)); setText(typeof value.draft === "string" ? value.draft.slice(0,12000) : ""); } catch { /* An invalid chat does not affect diary data. */ }
      setLoaded(true);
    });
    const reset = () => { generation.current++; cancelDictation(); abort.current?.abort(); setBusy(false); setMessages([]); setText(""); };
    window.addEventListener("dnevnik:reset-chat",reset);
    return () => { cancelled = true; window.removeEventListener("dnevnik:reset-chat",reset); abort.current?.abort(); };
  }, [storageKey,cancelDictation]);
  useEffect(() => {
    if(!loaded) return;
    try { localStorage.setItem(storageKey,JSON.stringify({ messages: messages.slice(-40).map(({id,role,text,state})=>({id,role,text,state})),draft:text })); } catch { /* The diary and the visible chat still work if storage is full. */ }
  }, [messages,text,loaded,storageKey]);
  useEffect(() => { log.current?.scrollTo({top:log.current.scrollHeight}); }, [messages,busy,expanded]);
  async function connect() {
    try {
      const response = await fetch("/api/local-ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"status"})});
      const result = await response.json();
      if(!response.ok || !result.conversationReady) throw new Error(result.error ?? "Не удалось подключить Qwen3.5:9b. Откройте ежедневник компьютерным ярлыком.");
      setReady(true); setError("");
    } catch(error) { setReady(false); setError(error instanceof Error ? error.message : "Нет связи с локальной моделью"); }
  }
  useEffect(() => { queueMicrotask(()=>{void connect();}); }, []);
  useEffect(() => { sendRef.current=(value,voice)=>{void send(value,voice);}; });
  function add(role: ChatMessage["role"], value: string, extra: Partial<ChatMessage> = {}) {
    const message={id:crypto.randomUUID(),role,text:value,...extra};
    setMessages(current=>[...current.slice(-39),message]);
    return message;
  }
  async function apply(message: ChatMessage) {
    if(!message.plan || busy || message.state !== "pending") return;
    setBusy(true); setError("");
    try {
      await onApply(message.plan);
      setMessages(current=>current.map(item=>item.id===message.id ? {...item,state:"applied"} : item));
      add("assistant","Готово, изменения сохранены в ежедневнике. Подключённая автосинхронизация передаст их в облако.");
    } catch(error) { setError(error instanceof Error ? error.message : "Не удалось сохранить изменения"); }
    finally { setBusy(false); }
  }
  async function send(value = text, fromVoice = false) {
    const question=value.trim();
    if(!question || busy || (voiceActive && !fromVoice)) return;
    setExpanded(true); setText(""); setError("");
    const pending=[...messages].reverse().find(item=>item.state==="pending" && item.plan);
    const confirmation=confirmationIntent(question);
    if(pending && confirmation) {
      add("user",question);
      if(confirmation==="apply") await apply(pending);
      else { setMessages(current=>current.map(item=>item.id===pending.id ? {...item,state:"dismissed"} : item)); add("assistant","Хорошо, этот план отменён. Записи не изменены."); }
      return;
    }
    if(!ready) { setText(question); setError("Локальная модель пока недоступна. Нажмите «Подключить снова»."); return; }
    const controller=new AbortController(); abort.current=controller; setBusy(true);
    const requestGeneration=generation.current;
    const history=conversationHistory(messages.map(item=>item.state==="pending" ? {...item,state:"dismissed" as const} : item));
    setMessages(current=>current.map(item=>item.state==="pending" ? {...item,state:"dismissed"} : item));
    add("user",question);
    try {
      const selected=selectAssistantContext({entries,projects,spaces,...extras},question);
      const response=await fetch("/api/local-ai",{method:"POST",headers:{"content-type":"application/json"},signal:controller.signal,body:JSON.stringify({action:"conversation",text:question,history,context:selected.entries.items,diaryContext:selected,projects:selected.projects.items,spaces:selected.spaces.items,currentScreen})});
      const result=await response.json();
      if(requestGeneration!==generation.current) return;
      if(!response.ok) throw new Error(result.error ?? "Не удалось получить ответ");
      const plan=validateAssistantPlan(result.plan,entries,question);
      const target=navigationTarget(question,result.plan.navigate);
      if(target) onNavigate(target);
      const requestedEntry = typeof result.plan.openEntry === "string" && /(?:открой|покажи\s+(?:мне\s+)?(?:запись|карточку))/iu.test(question) && !/(?:как|не открывай|не надо)/iu.test(question) ? entries.find(entry => entry.id === result.plan.openEntry) : undefined;
      if(requestedEntry) onOpenEntry(requestedEntry.id);
      if(plan.actions.length) add("assistant",plan.answer || "Предлагаю такие изменения. Можно нажать «Применить» или ответить «да».",{plan,state:"pending"});
      else if(plan.sync && /синхрон|обнови.*облак|обнови.*запис/i.test(question)) { const ok=await onSync(); add("assistant",ok ? "Синхронизация с облаком завершена." : "Синхронизация не завершена. Проверьте вход через «Облако» и подключение к интернету."); }
      else add("assistant",target ? `Открываю раздел «${screenNames[target]}».${plan.answer ? ` ${plan.answer}` : ""}` : plan.answer || "Не получилось составить ответ. Попробуйте уточнить вопрос.");
    } catch(error) {
      if(requestGeneration===generation.current) add("assistant",controller.signal.aborted ? "Запрос остановлен. Можно продолжить другим сообщением." : error instanceof Error ? error.message : "Не удалось получить ответ. Попробуйте ещё раз.");
    } finally { if(requestGeneration===generation.current) { setBusy(false); abort.current=null; } }
  }
  function dictate() { setError(""); if(dictation.phase === "requesting" || dictation.phase === "transcribing") dictation.cancel(); else void dictation.toggle(); }
  return <aside className={`diary-chat ${expanded ? "is-expanded" : ""}`} aria-label="Чат ежедневника">
    <header className="diary-chat-header"><div className="diary-chat-title"><Bot size={23}/><div><h2>Чат ежедневника</h2><p>Локально · {entries.length} записей</p></div></div><div className="flex gap-1"><button className="icon-control" type="button" aria-label="Очистить диалог" disabled={busy || voiceActive || !messages.length} onClick={()=>{setMessages([]);setText("");}}><Trash2 size={17}/></button><button className="icon-control chat-collapse" type="button" aria-label={expanded ? "Свернуть чат" : "Открыть чат"} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded ? <ChevronDown size={20}/> : <MessageCircle size={20}/>}</button></div></header>
    <div className="diary-chat-body"><div className="diary-chat-log" ref={log} tabIndex={0} role="log" aria-label="Переписка" aria-live="polite" aria-relevant="additions text">
      {!messages.length ? <div className="chat-welcome"><span><Bot size={30}/></span><h3>Давай разберёмся</h3><p>Я вижу записи и проекты. Спроси, что осталось купить, расскажи о новых делах или попроси навести порядок.</p><div>{["Что ещё нужно купить?","Что у нас на сегодня?","Помоги разобрать записи"].map(question=><button type="button" key={question} disabled={!ready || busy} onClick={()=>void send(question)}>{question}</button>)}</div></div> : messages.map(message=><article key={message.id} className={`chat-message is-${message.role}`}><span className="chat-speaker">{message.role==="user" ? "Вы" : "Ежедневник"}</span><p>{message.text}</p>{message.plan ? <div className="chat-plan">{message.plan.actions.map((action,index)=><div key={index}>{describeAction(action)}</div>)}{message.state==="pending" ? <div className="chat-plan-actions"><Button variant="primary" disabled={busy || voiceActive} onClick={()=>void apply(message)}>Применить</Button><Button disabled={busy || voiceActive} onClick={()=>{setMessages(current=>current.map(item=>item.id===message.id ? {...item,state:"dismissed"} : item));add("assistant","План отменён, записи не изменены.");}}>Отменить</Button></div> : <small>{message.state==="applied" ? "Изменения применены" : "План отменён"}</small>}</div> : null}</article>)}
      {busy ? <p className="chat-thinking" role="status">Думаю над ответом…</p> : null}
    </div><form className="diary-chat-composer" onSubmit={event=>{event.preventDefault();void send();}}>
      {dictation.error ? <div className="chat-error" role="alert"><p>{dictation.error}</p>{dictation.audioUrl ? <><audio controls src={dictation.audioUrl} aria-label="Прослушать записанный звук"/><Button type="button" disabled={voiceActive || busy} onClick={dictation.retry}>Распознать ещё раз</Button></> : null}</div> : null}
      {error ? <div className="chat-error" role="status"><p>{error}</p>{!ready ? <Button type="button" onClick={()=>void connect()}>Подключить снова</Button> : null}</div> : null}
      <Textarea aria-label="Сообщение в чат ежедневника" placeholder="Напиши или расскажи…" value={text} maxLength={12000} readOnly={voiceActive} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();void send();}}}/>
      <div className="chat-compose-actions"><button type="button" className={`icon-control ${listening ? "is-recording" : ""}`} aria-label={dictation.phase === "requesting" ? "Отменить включение микрофона" : dictation.phase === "transcribing" ? "Остановить распознавание" : listening ? "Отправить диктовку" : "Надиктовать сообщение"} aria-pressed={voiceActive} disabled={busy} onClick={dictate}>{dictation.phase === "transcribing" ? <Square size={20}/> : <Mic size={20}/>}</button><span>{dictation.phase === "requesting" ? "Ожидаю доступ к микрофону…" : dictation.phase === "transcribing" ? "Распознаю запись на компьютере…" : listening ? `Запись ${Math.floor(dictation.seconds / 60)}:${String(dictation.seconds % 60).padStart(2,"0")}` : "Enter — отправить"}</span>{busy ? <button className="icon-control" type="button" aria-label="Остановить ответ" onClick={()=>abort.current?.abort()}><Square size={18}/></button> : <button className="chat-send" type="submit" aria-label="Отправить сообщение" disabled={!text.trim() || voiceActive}><ArrowUp size={21}/></button>}</div>
      {listening ? <div className="voice-meter" role="status"><meter aria-label="Уровень микрофона" min={0} max={100} value={dictation.level}/><span>{dictation.level ? "Звук поступает" : "Звука пока не слышно"}</span></div> : null}
      <details className="chat-details"><summary>Микрофон и синхронизация</summary><p>{syncMessage || "Для обмена с телефоном войдите в тот же аккаунт через «Облако»."}</p><p>Звук записывается здесь и распознаётся на компьютере. Нажмите микрофон ещё раз, чтобы закончить и отправить сообщение.</p>{dictation.devices.length ? <Field label="Вход звука"><Select value={dictation.deviceId} disabled={voiceActive} onChange={event=>dictation.setDeviceId(event.target.value)}><option value="">Системный микрофон</option>{dictation.devices.filter(device=>device.deviceId!=="default"&&device.deviceId!=="communications").map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label || `Микрофон ${index+1}`}</option>)}</Select></Field> : null}</details>
    </form></div>
  </aside>;
}
function describeAction(action: AssistantAction) {
  if(action.type==="project") return `Создать проект: ${action.path.join(" / ")}`;
  if(action.type==="create") return `Добавить: ${action.entry.title}${action.entry.projectPath?.length ? ` · ${action.entry.projectPath.join(" / ")}` : ""}`;
  const labels: Record<string,string>={title:"Название",kind:"Тип",area:"Раздел",projectPath:"Проект",status:"Статус",priority:"Важность",assignedTo:"Кому",dueDate:"Дата",notes:"Заметки",description:"Описание"};
  const values: Record<string,string>={task:"задача",purchase:"покупка",wish:"хотелка",note:"заметка",idea:"идея",inbox:"на разбор",active:"в работе",done:"готово",bought:"куплено",ordered:"заказано",waiting:"ожидает",cancelled:"отменено",want_to_buy:"нужно купить",normal:"обычная",high:"высокая",low:"низкая",me:"мне",partner:"партнёру",shared:"общее"};
  return `${action.title}: ${Object.entries(action.patch).filter(([key])=>labels[key]).map(([key,value])=>`${labels[key]} — ${Array.isArray(value) ? value.join(" / ") : value===undefined ? "убрать" : values[String(value)] ?? String(value)}`).join("; ")}`;
}
