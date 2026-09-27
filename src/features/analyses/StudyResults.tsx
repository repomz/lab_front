import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Modal, ScrollView } from "../../components/platform";
import { Analysis } from "../../types";
import { s } from "../../styles";
import { AnalysisCard } from "./AnalysesScreen";

export function unpackStudies(result: Analysis): [Analysis, ...Analysis[]] {
  const { related_analyses, ...primary } = result;
  return [primary, ...(related_analyses || [])];
}

export function StudyResults({ studies, onOpen, onClose }: { studies: Analysis[]; onOpen: (item: Analysis) => void; onClose: () => void }) {
  return <Modal visible={studies.length > 1} onRequestClose={onClose} animationType="slide">
    <SafeAreaView style={s.fullScreenModal}>
      <View style={s.fullScreenHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="К исследованиям" style={s.iconButton} onPress={onClose}><Ionicons name="arrow-back" size={25}/></Pressable>
        <Text style={s.fullScreenTitle}>Результаты готовы</Text><View style={s.headerSpacer}/>
      </View>
      <ScrollView contentContainerStyle={s.dynamicDetailBody}>
        <Text style={s.cardHint}>В документе найдено исследований: {studies.length}. Каждое сохранено отдельно. Выберите результат, чтобы прочитать его оценку.</Text>
        {studies.map(item => <AnalysisCard key={item.id} item={item} onPress={() => onOpen(item)}/>)}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
