import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api";
import { Analysis } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Button, Empty, Section, Segment, Status, analysisDate, date } from "../../components/ui";
import { Modal, ScrollView } from "../../components/platform";
import { markerStatusText } from "./report";

const rubricOrder = ["Кровь", "Моча", "УЗИ", "КТ и МРТ", "Рентген", "Другие анализы"];
const rubricMeta: Record<string, { icon: keyof typeof Ionicons.glyphMap; description: string }> = {
  "Кровь": { icon: "water-outline", description: "Общий анализ, биохимия и гормоны" },
  "Моча": { icon: "beaker-outline", description: "Общий анализ и биохимия мочи" },
  "УЗИ": { icon: "pulse-outline", description: "Ультразвуковые исследования по органам" },
  "КТ и МРТ": { icon: "scan-outline", description: "Томографические исследования" },
  "Рентген": { icon: "image-outline", description: "Рентгенографические исследования" },
  "Другие анализы": { icon: "document-text-outline", description: "Исследования, которым нужна дополнительная классификация" },
};

export const isProcessingAnalysis = (analysis: Analysis) => analysis.status === "queued" || analysis.status === "processing";

function processingLabel(analysis: Analysis) {
  const labels: Record<string,string> = { queued:"В очереди",retry_wait:"Повторная попытка",preprocessing:"Подготовка документа",recognizing:"Распознавание",structuring:"Разбор показателей",finalizing:"Проверка результата" };
  return labels[analysis.processing_stage || ""] || "Обработка";
}

export function Analyses({
  compact,
  wide,
  data,
  doctor,
  onOpen,
  onUpload,
}: {
  compact: boolean;
  wide: boolean;
  data: Analysis[];
  doctor: boolean;
  onOpen: (a: Analysis) => void;
  onUpload: () => void;
}) {
  const [mode, setMode] = useState<"research" | "dynamics">("research");
  const [rubric, setRubric] = useState("Все");
  const desktop = useWindowDimensions().width >= 960;
  const [marker, setMarker] = useState("");
  const [dynamicQuery, setDynamicQuery] = useState("");
  const categories = useMemo(() => rubricOrder.filter((category) => data.some((analysis) => analysis.status === "ready" && (analysis.category || "Другие анализы") === category)), [data]);
  const groups = useMemo(() => {
    const grouped = new Map<string, Analysis[]>();
    data.forEach((analysis) => {
      const key = isProcessingAnalysis(analysis) ? "Обрабатываются" : analysis.status === "awaiting_confirmation" ? "Требуют проверки" : analysis.status === "needs_review" || analysis.status === "failed" ? "Нужны действия" : analysis.category || analysis.title || "Лабораторные исследования";
      if (rubric !== "Все" && !["Обрабатываются", "Требуют проверки", "Нужны действия"].includes(key) && key !== rubric) return;
      grouped.set(key, [...(grouped.get(key) || []), analysis]);
    });
    const stateOrder = ["Обрабатываются", "Требуют проверки", "Нужны действия"];
    return Array.from(grouped.entries()).sort(([left], [right]) => {
      const leftIndex = stateOrder.includes(left) ? stateOrder.indexOf(left) : stateOrder.length + Math.max(0, rubricOrder.indexOf(left));
      const rightIndex = stateOrder.includes(right) ? stateOrder.indexOf(right) : stateOrder.length + Math.max(0, rubricOrder.indexOf(right));
      return leftIndex - rightIndex;
    });
  }, [data, rubric]);
  const markerSeries = useMemo(() => {
    const result = new Map<string, { name: string; points: Array<{ date: string; value: number; unit: string; status: string; reference: string }> }>();
    data.filter((analysis)=>analysis.status==="ready").forEach((analysis) => analysis.markers.forEach((item) => {
      if (item.value === undefined) return;
      const reference = item.reference_text || [item.reference_min, item.reference_max].filter((value) => value !== undefined).join(" — ") || "—";
      const key = item.canonical_name?.trim().toLocaleLowerCase("ru-RU") || item.name.trim().toLocaleLowerCase("ru-RU");
      const current = result.get(key) || { name: item.name, points: [] };
      current.points.push({ date: analysisDate(analysis), value: item.value, unit: item.unit || "", status: item.status, reference });
      result.set(key, current);
    }));
    result.forEach((entry) => entry.points.sort((a,b) => a.date.localeCompare(b.date)));
    return result;
  }, [data]);
  const dynamicEntries = useMemo(() => Array.from(markerSeries.entries()).map(([key, entry]) => ({ key, name: entry.name, points: entry.points, latest: entry.points[entry.points.length - 1]! })).filter((entry) => entry.name.toLocaleLowerCase("ru-RU").includes(dynamicQuery.trim().toLocaleLowerCase("ru-RU"))).sort((a,b) => a.name.localeCompare(b.name,"ru-RU")), [markerSeries, dynamicQuery]);
  const selectedMarker = marker ? markerSeries.get(marker) : undefined;
  const series = selectedMarker?.points || [];
  return (
    <View style={s.analysisPage}>
    <ScrollView contentContainerStyle={[s.primaryTabScroll, compact && s.primaryTabScrollCompact, wide && s.primaryTabScrollWide, s.analysisScrollContent, !doctor && mode === "research" && desktop && s.analysisScrollWithDockDesktop]}>
      {!doctor && <View style={s.segment}><Segment active={mode === "research"} label="Исследования" icon="documents-outline" onPress={() => setMode("research")} /><Segment active={mode === "dynamics"} label="Динамика" icon="stats-chart-outline" onPress={() => setMode("dynamics")} /></View>}
      {(doctor || mode === "research") && categories.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rubricBar}>
        {["Все", ...categories].map((category) => { const active = rubric === category; const meta = rubricMeta[category]; return <Pressable key={category} accessibilityRole="button" accessibilityState={{selected:active}} onPress={()=>setRubric(category)} style={({pressed})=>[s.rubricChip,active&&s.rubricChipActive,pressed&&s.pressablePressed]}>{meta ? <Ionicons name={meta.icon} size={17} color={active?colors.white:colors.muted}/> : null}<Text style={[s.rubricChipText,active&&s.rubricChipTextActive]}>{category}</Text></Pressable>; })}
      </ScrollView> : null}
      {!doctor && mode === "research" && !desktop ? <View nativeID="analysis-upload-inline" style={s.uploadInline}><Button label="Загрузить анализ" kind="primary" icon="cloud-upload-outline" onPress={onUpload}/></View> : null}
      {data.length && (doctor || mode === "research") ? (
        <View style={s.analysisGroups}>{groups.map(([group, items]) => <View key={group} style={s.analysisGroup}><View style={s.groupTitleRow}><Text style={s.groupTitle}>{group}</Text><Text style={s.groupCount}>{items.length}</Text></View>{rubricMeta[group]?.description ? <Text style={s.groupDescription}>{rubricMeta[group].description}</Text> : null}<View style={[s.compactCardGrid,wide&&s.compactCardGridWide]}>{items.map((analysis) => <AnalysisCard key={analysis.id} item={analysis} wide={wide} onPress={() => onOpen(analysis)} />)}</View></View>)}</View>
      ) : data.length && mode === "dynamics" ? (
        <View style={s.dynamicsScreen}>
          <View style={s.doctorSearch}><Ionicons name="search" size={20} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={dynamicQuery} onChangeText={setDynamicQuery} placeholder="Например, креатинин"/></View>
          <View style={[s.dynamicCards,wide&&s.dynamicCardsWide]}>{dynamicEntries.map((entry) => <DynamicMarkerCard key={entry.key} name={entry.name} wide={wide} onPress={() => setMarker(entry.key)}/>)}</View>
          {!dynamicEntries.length && <Empty icon="stats-chart-outline" title="Показатель не найден" text="Измените запрос или загрузите исследование с этим показателем."/>}
        </View>
      ) : (
        <Empty
          icon="documents-outline"
          title="Здесь появится история"
          text="Поддерживаются фотографии, изображения из галереи и PDF."
        />
      )}
      <Modal visible={!!marker} animationType="slide" onRequestClose={()=>setMarker("")}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={()=>setMarker("")}><Ionicons name="arrow-back" size={25}/></Pressable><Text numberOfLines={1} style={s.fullScreenTitle}>{selectedMarker?.name||"Динамика"}</Text><View style={s.headerSpacer}/></View><ScrollView bounces={false} contentContainerStyle={s.dynamicDetailBody}>{series.length ? <><View style={s.dynamicCurrent}><Text style={s.dynamicCurrentValue}>{series[series.length-1]?.value} {series[series.length-1]?.unit}</Text><Text style={s.analysisMeta}>Последний результат · {date(series[series.length-1]!.date)}</Text></View><DynamicsChart series={series}/><Text style={s.dynamicHistoryTitle}>История результатов</Text><View style={s.dynamicHistory}>{[...series].reverse().map((point,index)=><View key={`${point.date}-${index}`} style={s.dynamicHistoryRow}><View><Text style={s.dynamicHistoryDate}>{date(point.date)}</Text><Text style={[s.dynamicHistoryStatus,point.status!=="normal"&&{color:colors.coral}]}>{markerStatusText(point.status)} · {point.reference}</Text></View><Text style={s.dynamicHistoryValue}>{point.value} {point.unit}</Text></View>)}</View></>:null}</ScrollView></SafeAreaView></Modal>
    </ScrollView>
    {!doctor && !marker && mode==="research" && desktop && <View nativeID="analysis-upload-dock" style={[s.uploadDock, s.uploadDockDesktop]}><Button label="Загрузить анализ" kind="primary" icon="cloud-upload-outline" onPress={onUpload}/></View>}
    </View>
  );
}

export function DynamicMarkerCard({ name, wide=false, onPress }: { name: string; wide?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Открыть динамику: ${name}`} onPress={onPress} style={({pressed})=>[s.dynamicMarkerCard,wide&&s.wideGridCard,pressed&&s.pressablePressed]}>
    <View style={s.dynamicMarkerCopy}><Text numberOfLines={1} style={s.dynamicCardTitle}>{name}</Text></View>
    <View style={s.dynamicCardArrow}><Ionicons name="chevron-forward" size={23} color={colors.ink}/></View>
  </Pressable>;
}

export function DynamicsChart({ series }: { series: Array<{ date: string; value: number; unit: string; status: string }> }) {
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return <View style={s.chartCard}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartBars}>{series.map((point,index) => { const height = 52 + ((point.value - min) / span) * 118; return <View key={`${point.date}-${index}`} style={s.chartColumn}><Text style={s.chartValue}>{point.value}</Text><View style={[s.chartBar, { height }, point.status !== "normal" && s.chartBarAlert]} /><Text style={s.chartDate}>{new Date(point.date).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"2-digit"})}</Text></View>; })}</ScrollView><Text style={s.chartUnit}>{series[0]?.unit}</Text></View>;
}
export function AnalysisCard({
  item,
  wide=false,
  onPress,
}: {
  item: Analysis;
  wide?: boolean;
  onPress: () => void;
}) {
  const processing = isProcessingAnalysis(item);
  const verification = item.status === "awaiting_confirmation";
  const failed = item.status === "failed" || item.status === "needs_review";
  const progress = Math.max(5, Math.min(100, item.processing_progress || 5));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть результат: ${item.title}`}
      style={({ pressed }) => [
        s.analysisCard,
        wide && s.wideGridCard,
        processing && s.analysisCardProcessing,
        verification && s.analysisCardReview,
        failed && s.analysisCardAlert,
        pressed && { opacity: 0.78 },
      ]}
      onPress={onPress}
    >
      <View style={[s.analysisIcon, processing && s.analysisIconProcessing, failed && s.analysisIconFailed]}>{processing ? <ActivityIndicator size="small" color={colors.brand}/> : <Ionicons name={verification?"checkmark-done-outline":failed?"alert-circle-outline":"flask-outline"} size={22} color={failed?colors.coral:colors.brand}/>}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.analysisTitle} numberOfLines={1}>{processing || failed || verification ? item.original_name : date(analysisDate(item))}</Text>
        <Text style={s.analysisMeta}>{processing ? processingLabel(item) : verification ? "Проверьте распознанные значения" : failed ? (item.processing_error || "Нужна повторная обработка") : item.title}</Text>
        {processing && <View style={s.jobCardProgressTrack}><View style={[s.jobCardProgressFill,{width:`${progress}%`}]}/></View>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted}/>
    </Pressable>
  );
}
