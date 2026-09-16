import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../api";
import { Analysis } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Button, Source, date } from "../../components/ui";
import { Modal, ScrollView } from "../../components/platform";

export type Asset = { uri: string; name: string; mimeType?: string; file?: Blob };

export function UploadModal({
  visible,
  seed,
  onClose,
  onDone,
}: {
  visible: boolean;
  seed: Asset | null;
  onClose: () => void;
  onDone: (result: Analysis) => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [recognized, setRecognized] = useState<Analysis | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (visible) {
      setAsset(seed?.uri ? seed : null);
      setError("");
      setProgress(0);
      setRecognized(null);
      setEditing(false);
    }
  }, [visible, seed]);
  useEffect(() => {
    if (!busy) return;
    setProgress(0.08);
    const timer = setInterval(() => {
      setProgress((current) => {
        if (current < 0.28) return Math.min(0.28, current + 0.045);
        if (current < 0.62) return Math.min(0.62, current + 0.024);
        if (current < 0.86) return Math.min(0.86, current + 0.012);
        return Math.min(0.94, current + 0.003);
      });
    }, 700);
    return () => clearInterval(timer);
  }, [busy]);
  async function camera() {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      setError("Разрешите доступ к камере в настройках устройства.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!r.canceled) {
      const x = r.assets[0];
      if (x)
        setAsset({
          uri: x.uri,
          name: x.fileName || `analysis-${Date.now()}.jpg`,
          mimeType: x.mimeType || "image/jpeg",
          file: x.file,
        });
    }
  }
  async function gallery() {
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Разрешите доступ к фотографиям в настройках устройства.");
        return;
      }
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (!r.canceled) {
      const x = r.assets[0];
      if (x)
        setAsset({
          uri: x.uri,
          name: x.fileName || `analysis-${Date.now()}.jpg`,
          mimeType: x.mimeType || "image/jpeg",
          file: x.file,
        });
    }
  }
  async function files() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!r.canceled) {
      const x = r.assets[0];
      if (x)
        setAsset({
          uri: x.uri,
          name: x.name,
          mimeType: x.mimeType,
          file: x.file,
        });
    }
  }
  async function submit() {
    if (!asset) {
      setError("Сначала выберите файл.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.upload(asset);
      setProgress(1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setRecognized(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }
  function changeValue(index: number, raw: string) {
    setRecognized((current) => {
      if (!current) return current;
      const markers = [...current.markers];
      const parsed = Number(raw.replace(",", "."));
      markers[index] = { ...markers[index]!, value: raw.trim() === "" || !Number.isFinite(parsed) ? undefined : parsed };
      return { ...current, markers };
    });
  }
  async function confirm() {
    if (!recognized || confirming) return;
    setConfirming(true);
    setError("");
    try {
      const result = await api.confirmAnalysis(recognized.id, recognized.markers);
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось утвердить показатели");
    } finally {
      setConfirming(false);
    }
  }
  if (recognized) return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.fullScreenModal}>
      <View style={s.verifyHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={onClose}><Ionicons name="arrow-back" size={25}/></Pressable><View style={{flex:1}}><Text style={s.fullScreenTitle}>Проверьте показатели</Text><Text style={s.analysisMeta}>{recognized.collected_at ? `Дата исследования: ${date(recognized.collected_at)}` : "Дата исследования не указана в бланке"}</Text></View></View>
      <Text style={s.verifyIntro}>Сравните значения с бланком. При необходимости включите редактирование и исправьте числа.</Text>
      <ScrollView contentContainerStyle={s.verifyMarkers}>{recognized.markers.map((marker,index)=><View key={`${marker.canonical_name}-${index}`} style={s.verifyMarkerRow}><View style={s.verifyMarkerName}><Text style={s.markerName}>{marker.name}</Text><Text style={s.analysisMeta}>{marker.unit||""}</Text></View>{editing?<TextInput accessibilityLabel={`Значение ${marker.name}`} keyboardType="decimal-pad" style={s.verifyValueInput} value={marker.value === undefined ? "" : String(marker.value).replace(".",",")} onChangeText={(value)=>changeValue(index,value)}/>:<Text style={s.verifyMarkerValue}>{marker.value ?? marker.text_value ?? "—"}</Text>}<Text numberOfLines={2} style={s.verifyMarkerReference}>{marker.reference_text||[marker.reference_min,marker.reference_max].filter(value=>value!==undefined).join(" — ")||"—"}</Text></View>)}</ScrollView>
      {error?<Text style={s.error}>{error}</Text>:null}
      <View style={s.verifyFooter}>{confirming?<View style={s.confirmProgress}><ActivityIndicator color={colors.violet}/><Text style={s.progressLabel}>Формируем резюме…</Text></View>:<View style={s.verifyActions}><View style={s.verifyActionCell}><Button kind="ghost" label={editing?"Завершить правки":"Внести изменения"} icon="create-outline" onPress={()=>setEditing(value=>!value)}/></View><View style={s.verifyActionCell}><Button label="Утвердить" icon="checkmark" onPress={()=>void confirm()}/></View></View>}</View>
    </SafeAreaView>
  </Modal>;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.fullScreenModal}>
        <View style={[s.uploadSheet, compact && s.uploadSheetCompact]}>
          <View style={s.rowBetween}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              hitSlop={10}
              style={s.iconButton}
              onPress={onClose}
            >
              <Ionicons name="arrow-back" size={25} color={colors.ink} />
            </Pressable>
            <Text style={s.fullScreenTitle}>Добавить результат</Text><View style={s.headerSpacer}/>
          </View>
          <Text style={s.cardHint}>Сфотографируйте бланк или выберите изображение/PDF.</Text>
          <View style={s.sourceRow}>
            <Source icon="camera-outline" label="Камера" onPress={camera} />
            <Source icon="images-outline" label="Галерея" onPress={gallery} />
            <Source icon="folder-open-outline" label="Файлы" onPress={files} />
          </View>
          {asset && (
            <View style={s.fileChosen}>
              <Ionicons
                name="document-attach-outline"
                size={24}
                color={colors.brand}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.analysisTitle} numberOfLines={1}>
                  {asset.name}
                </Text>
                <Text style={s.analysisMeta}>Готов к загрузке</Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={25}
                color={colors.brand}
              />
            </View>
          )}
          {error ? <Text style={s.error}>{error}</Text> : null}
          {busy && (
            <View style={s.progressPanel} accessibilityRole="progressbar">
              <View style={s.progressHead}>
                <View style={s.progressLabelRow}>
                  <ActivityIndicator size="small" color={colors.brand} />
                  <Text style={s.progressLabel}>
                    {progress < 0.3
                      ? "Загружаем документ"
                      : progress < 0.7
                        ? "Распознаём показатели"
                        : progress < 1
                          ? "Проверяем результат"
                          : "Готово"}
                  </Text>
                </View>
                <Text style={s.progressPercent}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <LinearGradient
                  colors={[colors.brand, colors.aqua, colors.violet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]}
                />
              </View>
              <Text style={s.progressHint}>Процент приблизительный и зависит от качества снимка.</Text>
            </View>
          )}
          <Button
            label={busy ? "Распознаём…" : "Загрузить и распознать"}
            disabled={busy}
            onPress={submit}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
