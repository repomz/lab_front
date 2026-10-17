import { Analysis } from "../../types";

export type DynamicsFilter = "all" | "normal" | "abnormal";
export type MarkerPoint = { date: string; value: number; unit: string; status: string; reference: string };
export type MarkerSeries = { name: string; points: MarkerPoint[] };
const normalize = (text: string) => text.trim().toLocaleLowerCase("ru-RU").replace(/ё/g,"е");

export function buildMarkerSeries(data: Analysis[]) {
  const result = new Map<string, MarkerSeries>();
  // Stable oldest-first ordering also resolves equal collection dates by save time.
  const ordered = data.filter(item=>item.status==="ready").slice().sort((a,b)=>(a.collected_at||a.created_at).localeCompare(b.collected_at||b.created_at)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  for (const analysis of ordered) for (const item of analysis.markers) {
    if (typeof item.value!=="number" || !Number.isFinite(item.value)) continue;
    // Different units must not be plotted on the same numeric scale.
    const key = `${normalize(item.canonical_name||item.name)}:${normalize(item.unit||"")}`;
    const entry = result.get(key)||{name:item.name,points:[]};
    entry.name=item.name;
    entry.points.push({date:analysis.collected_at||analysis.created_at,value:item.value,unit:item.unit||"",status:item.status,reference:item.reference_text||[item.reference_min,item.reference_max].filter(value=>value!==undefined).join(" — ")||"—"});
    result.set(key,entry);
  }
  return result;
}

export function filterMarkerSeries(series: Map<string,MarkerSeries>, query: string, filter: DynamicsFilter) {
  return Array.from(series,([key,entry])=>({key,...entry,latest:entry.points[entry.points.length-1]!}))
    .filter(entry=>normalize(entry.name).startsWith(normalize(query)))
    .filter(entry=>filter==="all" || (filter==="normal"?entry.latest.status==="normal":entry.latest.status==="high"||entry.latest.status==="low"))
    .sort((a,b)=>a.name.localeCompare(b.name,"ru-RU"));
}
