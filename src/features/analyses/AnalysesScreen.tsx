import React, { useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api";
import { Analysis } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Button, Empty, Section, Segment, Status, analysisDate, date } from "../../components/ui";
import { Modal, ScrollView } from "../../components/platform";
import { markerStatusText } from "./report";

export function Analyses({
  compact,
  data,
  doctor,
  onOpen,
  onUpload,
}: {
  compact: boolean;
  data: Analysis[];
  doctor: boolean;
  onOpen: (a: Analysis) => void;
  onUpload: () => void;
}) {
  const [mode, setMode] = useState<"research" | "dynamics">("research");
  const [marker, setMarker] = useState("");
  const [dynamicQuery, setDynamicQuery] = useState("");
  const groups = useMemo(() => {
    const grouped = new Map<string, Analysis[]>();
    data.forEach((analysis) => {
      const key = analysis.category || analysis.title || "Лабораторные исследования";
      grouped.set(key, [...(grouped.get(key) || []), analysis]);
    });
    return Array.from(grouped.entries());
  }, [data]);
  const markerSeries = useMemo(() => {
    const result = new Map<string, { name: string; points: Array<{ date: string; value: number; unit: string; status: string; reference: string }> }>();
    data.forEach((analysis) => analysis.markers.forEach((item) => {
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
    <ScrollView contentContainerStyle={[s.primaryTabScroll, compact && s.primaryTabScrollCompact, s.analysisScrollContent]}>
      {!doctor && <View style={s.segment}><Segment active={mode === "research"} label="Исследования" icon="documents-outline" onPress={() => setMode("research")} /><Segment active={mode === "dynamics"} label="Динамика" icon="stats-chart-outline" onPress={() => setMode("dynamics")} /></View>}
      {data.length && (doctor || mode === "research") ? (
        <View style={s.analysisGroups}>{groups.map(([group, items]) => <View key={group} style={s.analysisGroup}><View style={s.groupTitleRow}><Text style={s.groupTitle}>{group}</Text><Text style={s.groupCount}>{items.length}</Text></View><View style={s.compactCardGrid}>{items.map((analysis) => <AnalysisCard key={analysis.id} item={analysis} onPress={() => onOpen(analysis)} />)}</View></View>)}</View>
      ) : data.length && mode === "dynamics" ? (
        <View style={s.dynamicsScreen}>
          <View style={s.doctorSearch}><Ionicons name="search" size={20} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={dynamicQuery} onChangeText={setDynamicQuery} placeholder="Например, креатинин"/></View>
          <View style={s.dynamicCards}>{dynamicEntries.map((entry) => <DynamicMarkerCard key={entry.key} name={entry.name} onPress={() => setMarker(entry.key)}/>)}</View>
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
    {!doctor && !marker && mode==="research" && <View nativeID="analysis-upload-dock" style={[s.uploadDock, Platform.OS === "web" && s.uploadDockWeb]}><Button label="Загрузить анализ" kind="glass" icon="cloud-upload-outline" onPress={onUpload}/></View>}
    </View>
  );
}

export function DynamicMarkerCard({ name, onPress }: { name: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Открыть динамику: ${name}`} onPress={onPress} style={({pressed})=>[s.dynamicMarkerCard,pressed&&s.pressablePressed]}>
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
  onPress,
}: {
  item: Analysis;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть результат: ${item.title}`}
      style={({ pressed }) => [
        s.analysisCard,
        pressed && { opacity: 0.78 },
      ]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.analysisTitle}>{date(analysisDate(item))}</Text>
      </View>
    </Pressable>
  );
}
