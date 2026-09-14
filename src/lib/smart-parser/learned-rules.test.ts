import {expect,it} from "vitest";
import {validateLearnedRules} from "./learned-rules";
it("ignores broken and empty rules that would match every phrase",()=>expect(validateLearnedRules([null,{id:"bad",phrase:"",intent:"task"},{id:"bad2",phrase:42},{id:"bad3",phrase:"hello",projectPath:[null]}])).toEqual([]));
it("preserves valid corrections",()=>{const rule={id:"ok",phrase:"дизайн сайта",intent:"task",createdAt:"2026-09-14"};expect(validateLearnedRules([rule])).toEqual([rule]);});
