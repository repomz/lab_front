import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeDesign as d } from "../features/home/design";
import { Tab } from "./AppNavigation";

export function PatientDock({tab,onTab,onUpload,onList}:{tab:Tab;onTab:(tab:Tab)=>void;onUpload:()=>void;onList:()=>void}) {
  const insets=useSafeAreaInsets();
  const isAI=tab==="consultations"||tab==="ai";
  return <View nativeID="patient-dock" style={[d.dock,{bottom:Math.max(18,insets.bottom+8)}]}>
    <View style={d.nav}>{([{tab:"home",icon:"home-outline",label:"Главная"},{tab:"consultations",icon:"chatbubbles-outline",label:"Чат с AI"}] as const).map(item=><Pressable key={item.tab} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:tab===item.tab}} onPress={()=>onTab(item.tab)} style={[d.navItem,tab===item.tab&&d.navActive]}><Ionicons name={item.icon} size={28} color="#211A49"/></Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={isAI?"Список":"Добавить документ"} onPress={isAI?onList:onUpload} style={d.add}><Ionicons name={isAI?"list-outline":"add"} size={isAI?25:34} color="white"/>{isAI&&<Text style={{fontSize:10,color:"white",fontWeight:"600"}}>Список</Text>}</Pressable>
  </View>;
}
