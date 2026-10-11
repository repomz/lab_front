import { Analysis } from "../../types";

export type DocumentFolder = "laboratory" | "diagnostic" | "discharge" | "specialist";
export const folders = [
  {id:"laboratory",title:"Анализы",description:"Лабораторные\nисследования",icon:"flask-outline"},
  {id:"diagnostic",title:"Исследования",description:"Инструментальные\nисследования",icon:"body-outline"},
  {id:"discharge",title:"Выписки",description:"Больничные выписки",icon:"clipboard-outline"},
  {id:"specialist",title:"Заключения",description:"Заключения узких\nспециалистов",icon:"medical-outline"},
] as const;

export function documentFolder(item: Analysis): DocumentFolder {
  if(item.report?.document_kind==="discharge"||item.category==="Выписки")return "discharge";
  if(item.report?.document_kind==="specialist"||item.category==="Заключения")return "specialist";
  return item.report ? "diagnostic" : "laboratory";
}
