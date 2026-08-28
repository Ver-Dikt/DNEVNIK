"use client";

import { Mic, Square, WandSparkles, X } from "lucide-react";
import { Button, Surface, Textarea } from "@/components/ui/native";
import type { AIParseResult } from "@/lib/types";
import { kindLabels } from "@/features/shared/entry-utils";

export function CaptureSheet({
  text,
  isListening,
  isParsing,
  preview,
  voiceMessage,
  onClose,
  onTextChange,
  onToggleVoice,
  onParse,
  onSaveAll,
  onEditPreview,
  onRemovePreview
}: {
  text: string;
  isListening: boolean;
  isParsing: boolean;
  preview: AIParseResult | null;
  voiceMessage?: string;
  onClose: () => void;
  onTextChange: (value: string) => void;
  onToggleVoice: () => void;
  onParse: () => void;
  onSaveAll: () => void;
  onEditPreview: (index: number) => void;
  onRemovePreview: (index: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={onClose}>
      <Surface className="max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-bottom))] w-full max-w-xl overflow-auto p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-black">Добавить</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/[.05]" onClick={onClose} type="button" aria-label="Закрыть">
            <X size={19} />
          </button>
        </div>
        <Textarea autoFocus placeholder="Напиши или скажи что угодно..." value={text} onChange={(event) => onTextChange(event.target.value)} />
        <div className="mt-3 grid grid-cols-[56px_1fr] gap-2">
          <Button className={`h-14 p-0 ${isListening ? "bg-[#ffe5e9] text-[#b4233a]" : ""}`} onClick={onToggleVoice} aria-label={isListening ? "Остановить запись" : "Начать запись"}>
            {isListening ? <Square size={20} /> : <Mic size={22} />}
          </Button>
          <Button className="h-14 font-black" disabled={!text.trim() || isParsing} onClick={onParse} variant="primary">
            <WandSparkles size={18} />
            {isParsing ? "Разбираю..." : "Разобрать"}
          </Button>
        </div>
        {voiceMessage ? <p className="mt-2 text-sm text-[var(--muted)]">{voiceMessage}</p> : null}

        {preview ? (
          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Я понял так</h3>
              <Button className="px-4 font-bold" onClick={onSaveAll} variant="primary">Сохранить всё</Button>
            </div>
            {preview.items.map((item, index) => (
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 shadow-sm" key={`${item.title}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="badge">{kindLabels[item.kind]}</span>
                    <h4 className="mt-2 text-lg font-black">{item.title}</h4>
                  </div>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-black/[.05]" onClick={() => onRemovePreview(index)} type="button" aria-label="Убрать из preview">
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                  <span>{item.area ?? "Без пространства"}{item.project || item.projectCandidate ? ` · ${item.project ?? item.projectCandidate}` : ""}</span>
                  <span>{item.dueDate ?? item.schedule}{item.time ? ` · ${item.time}` : ""}</span>
                  {item.quantity || item.totalPrice || item.unitPrice ? <span>{item.quantity ? `${item.quantity} × ` : ""}{item.unitPrice ?? item.totalPrice} {item.currency ?? "RUB"}</span> : null}
                  {item.url ? <span className="truncate">{item.url}</span> : null}
                </div>
                <Button className="mt-3 w-full font-bold" onClick={() => onEditPreview(index)}>Исправить поля</Button>
              </div>
            ))}
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
