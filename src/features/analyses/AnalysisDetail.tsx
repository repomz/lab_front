import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api } from "../../api";
import { Analysis, User } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Action, Button, Empty, analysisDate, date } from "../../components/ui";
import { Modal, ScrollView } from "../../components/platform";
import { analysisReportHTML } from "./report";

export function AnalysisDetail({
  item,
  user,
  onClose,
  onDelete,
  onChanged,
  onError,
}: {
  item: Analysis | null;
  user: User;
  onClose: () => void;
  onDelete?: () => void;
  onChanged: () => void;
  onError: (x: string) => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 520;
  const [exporting, setExporting] = useState<"share" | "view" | "print" | null>(null);
  const [pdfURI, setPdfURI] = useState("");
  useEffect(() => () => {
    if (pdfURI.startsWith("blob:")) URL.revokeObjectURL(pdfURI);
  }, [pdfURI]);
  if (!item) return null;
  const active = item;
  const review = active.ai_review?.summary || "";
  async function nativeReport() {
    const result = await Print.printToFileAsync({
      html: analysisReportHTML(active),
      margins: { top: 28, right: 28, bottom: 28, left: 28 },
    });
    return result.uri;
  }
  async function shareWebReport() {
    const blob = await api.reportBlob(active.id);
    const file = new File([blob], `analysis-${active.id}.pdf`, {
      type: "application/pdf",
    });
    const webNavigator = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (
      webNavigator.share &&
      (!webNavigator.canShare || webNavigator.canShare({ files: [file] }))
    ) {
      await webNavigator.share({
        title: active.title,
        text: "Результаты лабораторного анализа в PDF",
        files: [file],
      });
      return;
    }
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function performReportAction(kind: "share" | "view" | "print") {
    if (exporting) return;
    setExporting(kind);
    try {
      if (Platform.OS === "web") {
        if (kind === "share") {
          await shareWebReport();
        } else {
          const blob = await api.reportBlob(active.id);
          const href = URL.createObjectURL(blob);
          if (kind === "view") {
          setPdfURI((current) => {
            if (current.startsWith("blob:")) URL.revokeObjectURL(current);
            return href;
          });
          } else {
            await Linking.openURL(href);
            setTimeout(() => URL.revokeObjectURL(href), 60_000);
          }
        }
        return;
      }
      const uri = await nativeReport();
      if (kind === "view") {
        setPdfURI(uri);
        await Linking.openURL(uri);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Передать ${active.title}`,
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      } else {
        throw new Error("Передача файлов недоступна на этом устройстве");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось подготовить PDF";
      if (!/cancel|abort/i.test(message)) onError(message);
    } finally {
      setExporting(null);
    }
  }
  return (
    <>
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={["top"]} style={s.fullScreenModal}>
        <View style={s.fullScreenInner}>
          <View style={s.detailHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              hitSlop={10}
              style={s.iconButton}
              onPress={onClose}
            >
              <Ionicons name="arrow-back" size={25} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{date(analysisDate(active))}</Text>
              <Text style={s.cardTitle}>{active.title}</Text>
            </View>
            <View style={s.headerSpacer}/>
          </View>
          <ScrollView
            style={s.detailScroll}
            contentContainerStyle={[
              s.detailBody,
              compact && s.detailBodyCompact,
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {active.markers.length ? (
              active.markers.map((m, i) => (
                <View
                  key={`${m.name}-${i}`}
                  style={[
                    s.markerTableRow,
                    (m.status === "high" || m.status === "low") && s.markerTableRowAlert,
                  ]}
                >
                  <Text numberOfLines={2} style={s.markerTableName}>{m.name}</Text>
                  <Text numberOfLines={1} style={s.markerTableValue}>{m.value ?? m.text_value} {m.unit}</Text>
                  <Text numberOfLines={2} style={s.markerTableReference}>
                    {m.reference_text ||
                        [m.reference_min, m.reference_max]
                          .filter((x) => x !== undefined)
                          .join(" — ") ||
                        "—"}
                  </Text>
                </View>
              ))
            ) : (
              <Empty
                icon="scan-outline"
                title="Показатели не распознаны"
                text="Проверьте качество снимка или добавьте более чёткий файл."
              />
            )}
            {review ? <View style={s.detailSummaryBox}><Text style={s.detailSummaryText}>{review}</Text></View> : null}
          </ScrollView>
          <View style={[s.detailFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={s.actionRow}>
              <Action
                icon="share-outline"
                label="Передать"
                busy={exporting === "share"}
                disabled={!!exporting}
                onPress={() => void performReportAction("share")}
              />
              <Action icon="document-text-outline" label="Просмотр" busy={exporting === "view"} disabled={!!exporting} onPress={() => void performReportAction("view")}/>
              {onDelete && <Action icon="trash-outline" label="Удалить" disabled={!!exporting} danger onPress={onDelete}/>}
              {Platform.OS === "web" && !compact && <Action icon="print-outline" label="Печать" busy={exporting === "print"} disabled={!!exporting} onPress={() => void performReportAction("print")}/>}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
    <Modal visible={!!pdfURI} animationType="slide" onRequestClose={()=>setPdfURI("")}>
      <SafeAreaView style={s.pdfViewerPage}>
        <View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={()=>setPdfURI("")}><Ionicons name="arrow-back" size={25}/></Pressable><Text numberOfLines={1} style={s.fullScreenTitle}>PDF · {active.title}</Text><View style={s.headerSpacer}/></View>
        {Platform.OS === "web" ? React.createElement("iframe", { src: pdfURI, title: `PDF ${active.title}`, style: { flex: 1, width: "100%", height: "100%", border: 0, backgroundColor: "#F6F4FA" } }) : <View style={s.nativePdfReturn}><Ionicons name="document-text-outline" size={58} color={colors.violet}/><Text style={s.cardTitle}>PDF открыт в просмотрщике устройства</Text><Text style={s.cardHint}>После возврата в Lab нажмите стрелку назад, чтобы закрыть просмотр.</Text><Button label="Открыть PDF ещё раз" icon="open-outline" onPress={()=>void Linking.openURL(pdfURI)}/></View>}
      </SafeAreaView>
    </Modal>
    </>
  );
}
