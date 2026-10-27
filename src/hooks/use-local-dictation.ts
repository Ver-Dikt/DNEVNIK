"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoicePhase = "idle" | "requesting" | "recording" | "transcribing";
export function microphoneError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Доступ к микрофону запрещён. Разрешите его для ежедневника в настройках доступа к микрофону.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Микрофон не найден. Подключите его и повторите запись.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Не удалось открыть микрофон. Возможно, устройство занято другой программой.";
  if (name === "OverconstrainedError") return "Выбранный микрофон отключён. Выберите системный микрофон или другой вход.";
  return error instanceof Error ? error.message : "Не удалось включить микрофон";
}
export function useLocalDictation(text: string, onTranscript: (value: string) => void) {
  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef<number>(0);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const upload = useRef<AbortController | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");
  const alive = useRef(true);
  const lastBlob = useRef<Blob | null>(null);
  const urlRef = useRef("");
  const recordingGeneration = useRef(0);
  const base = useRef("");
  const callback = useRef(onTranscript);
  useEffect(() => { callback.current = onTranscript; }, [onTranscript]);
  const setPhase = useCallback((value: VoicePhase) => { phaseRef.current = value; if(alive.current) setPhaseState(value); }, []);
  const release = useCallback(() => {
    cancelAnimationFrame(frame.current);
    if(clock.current) clearInterval(clock.current);
    clock.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if(audio.current) void audio.current.close().catch(() => undefined);
    audio.current = null;
  }, []);
  const cancel = useCallback(() => {
    recordingGeneration.current++;
    if(alive.current && phaseRef.current === "transcribing") setError("Распознавание остановлено. Аудиозапись остаётся в этом окне — можно повторить попытку.");
    upload.current?.abort(); upload.current = null;
    if(recorder.current) { recorder.current.onstop = null; if(recorder.current.state !== "inactive") recorder.current.stop(); recorder.current = null; }
    release(); setPhase("idle");
  }, [release,setPhase]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); if(urlRef.current) URL.revokeObjectURL(urlRef.current); }; }, [cancel]);
  async function transcribe(blob: Blob) {
    if(!alive.current) return;
    setPhase("transcribing"); setError("");
    const controller = new AbortController(); upload.current = controller;
    try {
      const form = new FormData(); form.set("audio", blob, "recording.webm");
      const response = await fetch("/api/local-speech", { method: "POST", body: form, signal: controller.signal });
      const result = await response.json();
      if(!response.ok || typeof result.text !== "string" || !result.text.trim()) throw new Error(result.error ?? "В записи не удалось услышать речь");
      if(!alive.current || controller.signal.aborted) return;
      const combined = [base.current,result.text.trim()].filter(Boolean).join(" ");
      setPhase("idle"); callback.current(combined);
    } catch(error) { if(alive.current && !controller.signal.aborted) setError(microphoneError(error)); }
    finally { if(upload.current === controller) { if(alive.current) setPhase("idle"); upload.current = null; } }
  }
  async function toggle() {
    if(phaseRef.current === "recording") { if(recorder.current?.state === "recording") recorder.current.stop(); return; }
    if(phaseRef.current !== "idle") return;
    const recordingId = ++recordingGeneration.current;
    lastBlob.current = null;
    if(urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = ""; setAudioUrl("");
    setError(""); setPhase("requesting"); setSeconds(0); setLevel(0); base.current = text.trim();
    try {
      if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Этот браузер не поддерживает запись звука. Откройте ежедневник компьютерным ярлыком.");
      const captured = await navigator.mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if(!alive.current || recordingId !== recordingGeneration.current || (phaseRef.current as VoicePhase) !== "requesting") { captured.getTracks().forEach(track => track.stop()); return; }
      stream.current = captured;
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "audioinput"));
      if(!alive.current || recordingId !== recordingGeneration.current || (phaseRef.current as VoicePhase) !== "requesting") { captured.getTracks().forEach(track => track.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      const record = new MediaRecorder(captured,mimeType ? { mimeType } : undefined);
      recorder.current = record;
      const chunks: Blob[] = [];
      record.ondataavailable = event => { if(event.data.size) chunks.push(event.data); };
      record.onerror = () => { record.onstop = null; if(record.state !== "inactive") record.stop(); recorder.current = null; release(); setPhase("idle"); setError("Не удалось записать звук. Проверьте выбранный микрофон."); };
      record.onstop = () => {
        release(); recorder.current = null;
        if(!alive.current) return;
        const blob = new Blob(chunks,{type:record.mimeType || "audio/webm"});
        lastBlob.current = blob;
        if(urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob); setAudioUrl(urlRef.current);
        void transcribe(blob);
      };
      record.start(250); setPhase("recording");
      const started = Date.now();
      clock.current = setInterval(() => { setSeconds(Math.floor((Date.now()-started)/1000)); if(Date.now()-started >= 90000 && record.state === "recording") record.stop(); },250);
      try {
        const context = new AudioContext(); audio.current = context; await context.resume();
        const analyser = context.createAnalyser(); analyser.fftSize = 256;
        context.createMediaStreamSource(captured).connect(analyser);
        const values = new Uint8Array(analyser.fftSize);
        let lastUpdate = 0;
        const meter = () => {
          if(phaseRef.current !== "recording") return;
          analyser.getByteTimeDomainData(values);
          const rms = Math.sqrt(values.reduce((sum,value) => sum + ((value-128)/128)**2,0)/values.length);
          if(Date.now()-lastUpdate > 100) { lastUpdate=Date.now(); setLevel(Math.min(100,Math.round(rms*600))); }
          frame.current = requestAnimationFrame(meter);
        }; meter();
      } catch { /* Recording still works on devices without an audio meter. */ }
    } catch(error) { release(); setPhase("idle"); if(alive.current) setError(microphoneError(error)); }
  }
  return {phase,level,seconds,error,devices,deviceId,setDeviceId,audioUrl,toggle,retry:()=>{if(lastBlob.current) void transcribe(lastBlob.current);},cancel};
}
