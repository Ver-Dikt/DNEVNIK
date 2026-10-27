import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
let transcribing = false;
export async function POST(request: Request) {
  const url = new URL(request.url);
  const target = new URL(`${url.protocol}//${request.headers.get("host") ?? url.host}`);
  const origin = request.headers.get("origin");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || (origin && origin !== target.origin)) return NextResponse.json({ error: "Запись обрабатывается только на этом компьютере" }, { status: 403 });
  const root = process.cwd();
  const python = join(root, ".maintenance", "speech-runtime", "venv", "Scripts", "python.exe");
  const model = join(root, ".maintenance", "speech-runtime", "model");
  if (!existsSync(python) || !existsSync(join(model, "model.bin"))) return NextResponse.json({ error: "Локальный движок распознавания пока не установлен. Аудиозапись остаётся в этом окне." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 16_000_000) return NextResponse.json({ error: "Запись слишком большая. Запишите сообщение до 90 секунд." }, { status: 413 });
  if (transcribing) return NextResponse.json({ error: "Другая запись ещё распознаётся. Повторите через несколько секунд." }, { status: 429 });
  transcribing = true;
  let directory: string | undefined;
  try {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || file.size < 100 || file.size > 15_000_000) return NextResponse.json({ error: "Не удалось получить аудиозапись. Проверьте выбранный микрофон." }, { status: 400 });
    directory = await mkdtemp(join(tmpdir(), "dnevnik-speech-"));
    const path = join(directory, "recording.audio");
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    const result = await new Promise<string>((resolve, reject) => {
      const child = spawn(python, [join(root, "scripts", "transcribe-local.py"), "--audio", path, "--model", model], { cwd: root, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", PYTHONIOENCODING: "utf-8" } });
      let output = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Распознавание заняло слишком долго. Попробуйте запись покороче.")); }, 120000);
      const cancel = () => { child.kill(); reject(new Error("Распознавание остановлено")); };
      request.signal.addEventListener("abort", cancel, { once: true });
      if (request.signal.aborted) cancel();
      child.stdout.on("data", chunk => { output += String(chunk); if (output.length > 100000) { child.kill(); reject(new Error("Слишком длинный ответ распознавания")); } });
      // Drain diagnostic output without returning paths or audio to the browser.
      child.stderr.on("data", () => undefined);
      child.on("error", () => { clearTimeout(timer); request.signal.removeEventListener("abort", cancel); reject(new Error("Не удалось запустить локальное распознавание")); });
      child.on("close", code => { clearTimeout(timer); request.signal.removeEventListener("abort", cancel); if (code === 0) resolve(output); else reject(new Error("Не удалось распознать запись. Проверьте микрофон или попробуйте ещё раз.")); });
    });
    const parsed = JSON.parse(result);
    if (typeof parsed.text !== "string" || !parsed.text.trim()) return NextResponse.json({ error: "В записи не удалось услышать речь. Проверьте уровень звука и выберите другой микрофон." }, { status: 422 });
    return NextResponse.json({ text: parsed.text.trim().slice(0, 12000) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось распознать запись. Аудио остаётся в этом окне." }, { status: 503 });
  } finally {
    transcribing = false;
    if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
