import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeDesign as d } from "../features/home/design";
import { Tab } from "./AppNavigation";

export function PatientDock({tab,onTab,onUpload}:{tab:Tab;onTab:(tab:Tab)=>void;onUpload:()=>void}) {
  const insets=useSafeAreaInsets();
  return <View nativeID="patient-dock" style={[d.dock,{bottom:Math.max(18,insets.bottom+8)}]}>
    <View style={d.nav}>{([{tab:"home",icon:"home-outline",label:"Главная"},{tab:"consultations",icon:"chatbubbles-outline",label:"Чат с AI"}] as const).map(item=><Pressable key={item.tab} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:tab===item.tab}} onPress={()=>onTab(item.tab)} style={[d.navItem,tab===item.tab&&d.navActive]}><Ionicons name={item.icon} size={28} color="#211A49"/></Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Добавить документ" onPress={onUpload} style={d.add}><Ionicons name="add" size={34} color="white"/></Pressable>
  </View>;
}
