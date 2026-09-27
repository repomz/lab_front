import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../api";
import { Analysis } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Button, Source } from "../../components/ui";
import { Modal } from "../../components/platform";
import { AIProcessingConsentControl } from "./AIProcessingConsent";

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
  const [error, setError] = useState("");
  const [aiProcessingConsent, setAIProcessingConsent] = useState(false);
  useEffect(() => {
    if (visible) {
      setAsset(seed?.uri ? seed : null);
      setError("");
      setAIProcessingConsent(false);
    }
  }, [visible, seed]);
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
    if (!aiProcessingConsent) {
      setError("Подтвердите передачу документа внешнему AI-сервису.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.upload(asset, aiProcessingConsent);
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => { if (!busy) onClose(); }}
    >
      <SafeAreaView style={s.fullScreenModal}>
        <View style={[s.uploadSheet, compact && s.uploadSheetCompact]}>
          <View style={s.rowBetween}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              hitSlop={10}
              style={s.iconButton}
              disabled={busy}
              onPress={onClose}
            >
              <Ionicons name="arrow-back" size={25} color={colors.ink} />
            </Pressable>
            <Text style={s.fullScreenTitle}>Добавить результат</Text><View style={s.headerSpacer}/>
          </View>
          <Text style={s.cardHint}>Выберите фото или PDF (до 10 страниц). Если в файле несколько разных исследований, каждое будет сохранено отдельно.</Text>
          {!busy && <View style={s.sourceRow}>
            <Source icon="camera-outline" label="Камера" onPress={camera} />
            <Source icon="images-outline" label="Галерея" onPress={gallery} />
            <Source icon="folder-open-outline" label="Файлы" onPress={files} />
          </View>}
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
          {!busy && (
            <AIProcessingConsentControl checked={aiProcessingConsent} onChange={setAIProcessingConsent}/>
          )}
          {busy && (
            <View style={s.progressPanel} accessibilityRole="progressbar">
              <View style={s.progressLabelRow}><ActivityIndicator size="small" color={colors.brand}/><Text style={s.progressLabel}>Распознаём и проверяем документ</Text></View>
              <Text style={s.progressHint}>Не закрывайте экран. Оригинал, все показатели, лабораторные референсы и итоговое резюме обрабатываются одним непрерывным запросом.</Text>
            </View>
          )}
          <Button
            label={busy ? "Анализируем документ…" : "Распознать документ"}
            disabled={busy || !asset || !aiProcessingConsent}
            onPress={submit}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
