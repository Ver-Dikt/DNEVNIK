import { expect, it } from "vitest";
import { encodeBackupFiles, decodeBackupFiles } from "./backup-files";
it("restores attachment bytes and MIME type after JSON round trip",async()=>{
 const original={documents:[{title:"Билет",attachments:[{blob:new Blob([new Uint8Array([0,255,31,80])],{type:"application/pdf"})}]}]};
 const decoded=decodeBackupFiles(JSON.parse(JSON.stringify(await encodeBackupFiles(original)))) as typeof original;
 expect(decoded.documents[0].title).toBe("Билет");
 const blob=decoded.documents[0].attachments[0].blob;
 expect(blob.type).toBe("application/pdf");expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0,255,31,80]);
});
it("keeps legacy text-only backups intact",()=>expect(decodeBackupFiles({entries:[],draft:null})).toEqual({entries:[],draft:null}));
it("rejects damaged attachment encoding",()=>expect(()=>decodeBackupFiles({$dnevnikBlob:1,base64:"%%",mimeType:"text/plain"})).toThrow());
