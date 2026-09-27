import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components/ui";
import { Modal, ScrollView } from "../../components/platform";
import { colors } from "../../theme";
import { s } from "../../styles";

const consentText = "Для распознавания приложение передаст выбранный оригинал медицинского документа внешнему AI-сервису DeepSeek. Документ может содержать сведения о здоровье и персональные данные, видимые на изображении.\n\nЦель передачи — визуальная транскрипция показателей, лабораторных референсов, описания и заключения исследования. Сервис не заменяет врача и не устанавливает диагноз.\n\nПередача выполняется только после вашего явного подтверждения для этой загрузки или повторной обработки. В приложении сохраняются дата подтверждения, пользователь, действие и название внешнего обработчика.\n\nЕсли вы не согласны на передачу документа внешнему AI-сервису, не запускайте распознавание. Самостоятельно внесённые и подтверждённые врачом данные следует считать приоритетными по отношению к автоматически сформированному результату.";

export function AIProcessingConsentControl({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const [details, setDetails] = useState(false);
  return <>
    <View style={s.consentRow}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Согласие на передачу документа DeepSeek" accessibilityState={{ checked }} hitSlop={8} onPress={() => onChange(!checked)} style={[s.consentBox, checked && s.consentBoxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color={colors.white}/>} 
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setDetails(true)} style={s.consentTextButton}>
        <Text style={s.consentLabel}>Согласие на передачу документа DeepSeek для AI-распознавания</Text>
        <Text style={s.consentOpen}>Что именно передаётся</Text>
      </Pressable>
    </View>
    <Modal visible={details} animationType="slide" onRequestClose={() => setDetails(false)}>
      <SafeAreaView style={s.fullScreenModal}>
        <View style={s.fullScreenHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={() => setDetails(false)}><Ionicons name="arrow-back" size={24}/></Pressable>
          <Text numberOfLines={2} style={s.fullScreenTitle}>AI-обработка документа</Text><View style={s.headerSpacer}/>
        </View>
        <ScrollView contentContainerStyle={s.legalBody}><Text selectable style={s.legalText}>{consentText}</Text></ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}

export function AIProcessingConsentDialog({ visible, busy, onCancel, onConfirm }: { visible: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
    <View style={s.confirmOverlay}>
      <View style={s.confirmCard}>
        <Text style={s.confirmTitle}>Повторно передать документ DeepSeek?</Text>
        <Text style={s.confirmText}>Оригинал медицинского документа будет снова передан внешнему AI-сервису для распознавания. Подтверждение относится только к этой повторной обработке.</Text>
        <View style={s.confirmActions}>
          <View style={{ flex: 1 }}><Button kind="ghost" label="Отмена" disabled={busy} onPress={onCancel}/></View>
          <View style={{ flex: 1 }}><Button label={busy ? "Обрабатываем…" : "Согласен и повторить"} disabled={busy} onPress={onConfirm}/></View>
        </View>
      </View>
    </View>
  </Modal>;
}
