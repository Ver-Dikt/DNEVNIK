import {describe,expect,it} from "vitest";
import {microphoneError} from "./use-local-dictation";
describe("real microphone failure messages",()=>{
 it.each([["NotAllowedError","Доступ к микрофону запрещён"],["NotFoundError","Микрофон не найден"],["NotReadableError","Не удалось открыть микрофон"],["OverconstrainedError","Выбранный микрофон отключён"]])("explains %s",(name,message)=>{const error=new Error();error.name=name;expect(microphoneError(error)).toContain(message);});
 it("preserves a meaningful local transcription error",()=>expect(microphoneError(new Error("В записи не удалось услышать речь"))).toBe("В записи не удалось услышать речь"));
});
