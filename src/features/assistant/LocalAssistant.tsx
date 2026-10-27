"use client";
import { ArrowUp, Bot, ChevronDown, MessageCircle, Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Textarea } from "@/components/ui/native";
import { validateAssistantPlan, type AssistantAction, type AssistantPlan } from "@/lib/assistant-actions";
import { confirmationIntent, conversationHistory, restoreConversation, type ChatMessage } from "@/lib/conversation";
import type { DiaryEntry, ProjectNode, Space } from "@/lib/types";

type Props = { entries: DiaryEntry[]; projects: ProjectNode[]; spaces: Space[]; syncMessage: string; storageScope: string; currentScreen: string; onSync: () => Promise<boolean>; onApply: (plan: AssistantPlan) => Promise<void> };
const subscribe = () => () => {};
const isLocal = () => ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
export function LocalAssistant(props: Props) {
  const local = useSyncExternalStore(subscribe, isLocal, () => false);
  return local ? <DiaryConversation {...props} /> : null;
}
function DiaryConversation({ entries, projects, spaces, syncMessage, storageScope, currentScreen, onSync, onApply }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const speech = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(null);
  const voiceText = useRef("");
  const sendAfterVoice = useRef(false);
  const generation = useRef(0);
  const sendRef = useRef<(value: string, voice?: boolean) => void>(() => undefined);
  const log = useRef<HTMLDivElement>(null);
  const storageKey = `dnevnik.chat.v1.${encodeURIComponent(storageScope)}`;
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if(cancelled) return;
      try { const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); setMessages(restoreConversation(value.messages)); setText(typeof value.draft === "string" ? value.draft.slice(0,12000) : ""); } catch { /* An invalid chat does not affect diary data. */ }
      setLoaded(true);
    });
    const reset = () => { generation.current++; sendAfterVoice.current=false; abort.current?.abort(); speech.current?.abort(); setBusy(false); setMessages([]); setText(""); };
    window.addEventListener("dnevnik:reset-chat",reset);
    return () => { cancelled = true; window.removeEventListener("dnevnik:reset-chat",reset); sendAfterVoice.current = false; speech.current?.abort(); abort.current?.abort(); };
  }, [storageKey]);
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
    if(!question || busy || (listening && !fromVoice)) return;
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
      if(entries.length>150) throw new Error("В ежедневнике больше 150 записей: контекст этого чата пока ограничен 150 записями.");
      const context=entries.map(({id,title,kind,status,area,dueDate,projectPath,assignedTo,priority,revision,updatedAt,needsReview,description,notes,purchase,wish})=>({id,title,kind,status,area,dueDate,projectPath,assignedTo,priority,revision,updatedAt,needsReview,description:description?.slice(0,220),notes:notes?.slice(0,180),...(purchase ? {purchase:{quantity:purchase.quantity,totalPrice:purchase.totalPrice,unitPrice:purchase.unitPrice,currency:purchase.currency,status:purchase.status}} : {}),...(wish ? {wish:{status:wish.status,estimatedPrice:wish.estimatedPrice,currency:wish.currency}} : {})}));
      const response=await fetch("/api/local-ai",{method:"POST",headers:{"content-type":"application/json"},signal:controller.signal,body:JSON.stringify({action:"conversation",text:question,history,context,projects:projects.map(({id,name,area,parentId})=>({id,name,area,parentId})),spaces:spaces.map(({id,name})=>({id,name})),currentScreen})});
      const result=await response.json();
      if(requestGeneration!==generation.current) return;
      if(!response.ok) throw new Error(result.error ?? "Не удалось получить ответ");
      const plan=validateAssistantPlan(result.plan,entries,question);
      if(plan.actions.length) add("assistant",plan.answer || "Предлагаю такие изменения. Можно нажать «Применить» или ответить «да».",{plan,state:"pending"});
      else if(plan.sync && /синхрон|обнови.*облак|обнови.*запис/i.test(question)) { const ok=await onSync(); add("assistant",ok ? "Синхронизация с облаком завершена." : "Синхронизация не завершена. Проверьте вход через «Облако» и подключение к интернету."); }
      else add("assistant",plan.answer || "Не получилось составить ответ. Попробуйте уточнить вопрос.");
    } catch(error) {
      if(requestGeneration===generation.current) add("assistant",controller.signal.aborted ? "Запрос остановлен. Можно продолжить другим сообщением." : error instanceof Error ? error.message : "Не удалось получить ответ. Попробуйте ещё раз.");
    } finally { if(requestGeneration===generation.current) { setBusy(false); abort.current=null; } }
  }
  function dictate() {
    if(speech.current) { sendAfterVoice.current=true; speech.current.stop(); return; }
    const Recognition=window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if(!Recognition) { setError("В этом браузере нет голосового ввода. Используйте Chrome или напишите сообщение."); return; }
    setError(""); setExpanded(true); sendAfterVoice.current=false;
    const recognition=new Recognition(); const base=text.trim(); voiceText.current=base;
    recognition.lang="ru-RU";recognition.continuous=true;recognition.interimResults=true;
    recognition.onstart=()=>setListening(true);
    recognition.onresult=event=>{voiceText.current=[base,Array.from(event.results).map(item=>item[0].transcript).join(" ")].filter(Boolean).join(" ");setText(voiceText.current);};
    recognition.onerror=event=>{sendAfterVoice.current=false;setError(event.error==="not-allowed" ? "Разрешите доступ к микрофону в браузере." : "Распознавание остановлено. Текст остался в поле ввода.");};
    recognition.onend=()=>{speech.current=null;setListening(false);if(sendAfterVoice.current && voiceText.current.trim()){sendAfterVoice.current=false;sendRef.current(voiceText.current,true);}};
    speech.current=recognition;
    try {recognition.start();}catch{speech.current=null;setListening(false);setError("Не удалось включить микрофон");}
  }
  return <aside className={`diary-chat ${expanded ? "is-expanded" : ""}`} aria-label="Чат ежедневника">
    <header className="diary-chat-header"><div className="diary-chat-title"><Bot size={23}/><div><h2>Чат ежедневника</h2><p>Локально · {entries.length} записей</p></div></div><div className="flex gap-1"><button className="icon-control" type="button" aria-label="Очистить диалог" disabled={busy || listening || !messages.length} onClick={()=>{setMessages([]);setText("");}}><Trash2 size={17}/></button><button className="icon-control chat-collapse" type="button" aria-label={expanded ? "Свернуть чат" : "Открыть чат"} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded ? <ChevronDown size={20}/> : <MessageCircle size={20}/>}</button></div></header>
    <div className="diary-chat-body"><div className="diary-chat-log" ref={log} tabIndex={0} role="log" aria-label="Переписка" aria-live="polite" aria-relevant="additions text">
      {!messages.length ? <div className="chat-welcome"><span><Bot size={30}/></span><h3>Давай разберёмся</h3><p>Я вижу записи и проекты. Спроси, что осталось купить, расскажи о новых делах или попроси навести порядок.</p><div>{["Что ещё нужно купить?","Что у нас на сегодня?","Помоги разобрать записи"].map(question=><button type="button" key={question} disabled={!ready || busy} onClick={()=>void send(question)}>{question}</button>)}</div></div> : messages.map(message=><article key={message.id} className={`chat-message is-${message.role}`}><span className="chat-speaker">{message.role==="user" ? "Вы" : "Ежедневник"}</span><p>{message.text}</p>{message.plan ? <div className="chat-plan">{message.plan.actions.map((action,index)=><div key={index}>{describeAction(action)}</div>)}{message.state==="pending" ? <div className="chat-plan-actions"><Button variant="primary" disabled={busy || listening} onClick={()=>void apply(message)}>Применить</Button><Button disabled={busy || listening} onClick={()=>{setMessages(current=>current.map(item=>item.id===message.id ? {...item,state:"dismissed"} : item));add("assistant","План отменён, записи не изменены.");}}>Отменить</Button></div> : <small>{message.state==="applied" ? "Изменения применены" : "План отменён"}</small>}</div> : null}</article>)}
      {busy ? <p className="chat-thinking" role="status">Думаю над ответом…</p> : null}
    </div><form className="diary-chat-composer" onSubmit={event=>{event.preventDefault();void send();}}>
      {error ? <div className="chat-error" role="status"><p>{error}</p>{!ready ? <Button type="button" onClick={()=>void connect()}>Подключить снова</Button> : null}</div> : null}
      <Textarea aria-label="Сообщение в чат ежедневника" placeholder="Напиши или расскажи…" value={text} maxLength={12000} readOnly={listening} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();void send();}}}/>
      <div className="chat-compose-actions"><button type="button" className={`icon-control ${listening ? "is-recording" : ""}`} aria-label={listening ? "Отправить диктовку" : "Надиктовать сообщение"} aria-pressed={listening} disabled={busy} onClick={dictate}><Mic size={20}/></button><span>{listening ? "Нажми микрофон, чтобы отправить" : "Enter — отправить"}</span>{busy ? <button className="icon-control" type="button" aria-label="Остановить ответ" onClick={()=>abort.current?.abort()}><Square size={18}/></button> : <button className="chat-send" type="submit" aria-label="Отправить сообщение" disabled={!text.trim() || listening}><ArrowUp size={21}/></button>}</div>
      <details className="chat-details"><summary>О чате и синхронизации</summary><p>{syncMessage || "Для обмена с телефоном войдите в тот же аккаунт через «Облако»."}</p><p>Команды обрабатываются на компьютере. Распознавание голоса браузером может требовать интернет.</p></details>
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
