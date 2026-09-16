import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Role, User } from "../types";
import { colors } from "../theme";
import { s } from "../styles";

export type Tab = "home" | "analyses" | "patients" | "consultations" | "doctors" | "schedule" | "ai" | "guides" | "articles" | "profile";

export const icon: Record<Tab, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  analyses: "flask-outline",
  patients: "people-outline",
  consultations: "chatbubbles-outline",
  doctors: "calendar-outline",
  schedule: "time-outline",
  ai: "sparkles-outline",
  guides: "chatbubble-ellipses-outline",
  articles: "newspaper-outline",
  profile: "person-outline",
};
export const labels: Record<Tab, string> = {
  home: "Главная",
  analyses: "Анализы",
  patients: "Пациенты",
  consultations: "AI",
  doctors: "Запись",
  schedule: "Время",
  ai: "AI",
  guides: "Чат",
  articles: "Публикации",
  profile: "Профиль",
};
export const tabLabel = (role: Role, tab: Tab) => {
  if (role === "admin") return ({home:"Обзор",patients:"Пользователи",analyses:"Анализы",consultations:"Обращения",guides:"Поддержка"} as Partial<Record<Tab,string>>)[tab] || labels[tab];
  if (role === "patient" && tab === "profile") return "Чат";
  return labels[tab];
};
export const tabsFor = (role: Role, desktop = false): Tab[] => role === "doctor"
  ? ["home", "patients", "schedule", "ai", "guides", ...(desktop ? ["articles" as Tab,"profile" as Tab] : [])]
  : role === "admin" ? ["home", "patients", "analyses", "consultations", "guides"]
  : ["home", "analyses", "consultations", "doctors", "profile"];


export function Sidebar({
  user,
  tab,
  onTab,
}: {
  user: User;
  tab: Tab;
  onTab: (x: Tab) => void;
}) {
  return (
    <View style={s.sidebar}>
      <View style={s.brand}>
        <View style={s.logo}>
          <Ionicons name="pulse" size={24} color="#fff" />
        </View>
        <Text style={s.brandText}>Lab</Text>
      </View>
      <View style={s.nav}>
        {tabsFor(user.role, true).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            onPress={() => onTab(t)}
            style={[s.navItem, tab === t && s.navActive]}
          >
            <Ionicons
              name={user.role === "patient" && t === "profile" ? "chatbubble-ellipses-outline" : icon[t]}
              size={22}
              color={tab === t ? colors.brand : colors.muted}
            />
            <Text style={[s.navText, tab === t && { color: colors.brand }]}>
              {tabLabel(user.role,t)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.sidebarUser}>
        <Text style={s.sidebarName} numberOfLines={1}>
          {user.full_name}
        </Text>
        <Text style={s.analysisMeta}>
          {user.role === "doctor" ? user.specialization : "Пользователь"}
        </Text>
      </View>
    </View>
  );
}
export function Bottom({ role, tab, onTab }: { role: Role; tab: Tab; onTab: (t: Tab) => void }) {
  const tabs = tabsFor(role);
  const activeIndex = Math.max(0, tabs.indexOf(tab));
  const [navWidth, setNavWidth] = useState(0);
  const [gestureIndex,setGestureIndex]=useState<number|null>(null);
  const gestureIndexRef=useRef<number|null>(null);
  const draggingRef=useRef(false);
  const lastTouchX=useRef(0);
  const dropX = useRef(new Animated.Value(0)).current;
  const dropScaleX=useRef(new Animated.Value(1)).current;
  const dropScaleY=useRef(new Animated.Value(1)).current;
  const dropTilt=useRef(new Animated.Value(0)).current;
  const itemWidth = navWidth > 0 ? (navWidth - 14) / tabs.length : 0;
  const useNativeDriver=Platform.OS!=="web";
  const springTo=useCallback((index:number)=>{if(!itemWidth)return;Animated.spring(dropX,{toValue:index*itemWidth,damping:20,stiffness:260,mass:.72,useNativeDriver}).start()},[dropX,itemWidth,useNativeDriver]);
  useEffect(() => {
    if(!draggingRef.current)springTo(activeIndex);
  },[activeIndex,springTo]);
  const indexAt=useCallback((x:number)=>Math.min(tabs.length-1,Math.max(0,Math.floor((Math.max(7,Math.min(navWidth-7-Number.EPSILON,x))-7)/Math.max(1,itemWidth)))),[itemWidth,navWidth,tabs.length]);
  const moveDrop=useCallback((x:number)=>{if(!Number.isFinite(x)||!itemWidth||!navWidth)return;const bounded=Math.max(7+itemWidth/2,Math.min(navWidth-7-itemWidth/2,x));const next=indexAt(x);const delta=bounded-lastTouchX.current;lastTouchX.current=bounded;gestureIndexRef.current=next;setGestureIndex(current=>current===next?current:next);dropX.setValue(bounded-itemWidth/2-7);const motion=Math.min(1,Math.abs(delta)/22);dropScaleX.setValue(1.04+motion*.14);dropScaleY.setValue(1.06-motion*.08);dropTilt.setValue(Math.max(-1,Math.min(1,delta/22)))},[dropScaleX,dropScaleY,dropTilt,dropX,indexAt,itemWidth,navWidth]);
  const settle=useCallback((commit:boolean)=>{const next=gestureIndexRef.current??activeIndex;draggingRef.current=false;gestureIndexRef.current=null;setGestureIndex(null);if(commit)onTab(tabs[next]!);springTo(commit?next:activeIndex);Animated.parallel([Animated.spring(dropScaleX,{toValue:1,damping:9,stiffness:230,mass:.62,useNativeDriver}),Animated.spring(dropScaleY,{toValue:1,damping:9,stiffness:230,mass:.62,useNativeDriver}),Animated.spring(dropTilt,{toValue:0,damping:12,stiffness:220,useNativeDriver})]).start()},[activeIndex,dropScaleX,dropScaleY,dropTilt,onTab,springTo,tabs,useNativeDriver]);
  const panResponder=useMemo(()=>PanResponder.create({onStartShouldSetPanResponderCapture:()=>true,onMoveShouldSetPanResponderCapture:()=>true,onPanResponderGrant:event=>{draggingRef.current=true;const x=Number(event.nativeEvent.locationX);if(Number.isFinite(x)){lastTouchX.current=x;moveDrop(x)}Animated.parallel([Animated.spring(dropScaleX,{toValue:1.04,damping:13,stiffness:300,useNativeDriver}),Animated.spring(dropScaleY,{toValue:1.06,damping:13,stiffness:300,useNativeDriver})]).start()},onPanResponderMove:event=>moveDrop(Number(event.nativeEvent.locationX)),onPanResponderRelease:()=>settle(true),onPanResponderTerminate:()=>settle(false),onPanResponderTerminationRequest:()=>false}),[dropScaleX,dropScaleY,moveDrop,settle,useNativeDriver]);
  const visualIndex=gestureIndex??activeIndex;
  const tilt=dropTilt.interpolate({inputRange:[-1,0,1],outputRange:["-7deg","0deg","7deg"]});
  // Web CSS owns the physical safe-area geometry. Native builds already expose
  // the usable window through their host view.
  const dockInsets = Platform.OS === "web"
    ? ({ bottom: 0, height: 66 } as any)
    : { bottom: 0, height: 66 };
  return (
    <View nativeID="mobile-navigation" testID="bottom-nav" style={[s.bottom, dockInsets]} onLayout={(event)=>setNavWidth(event.nativeEvent.layout.width)} {...panResponder.panHandlers}>
      {navWidth > 0 && <Animated.View pointerEvents="none" style={[s.bottomDrop,{width:Math.max(0,itemWidth-6),transform:[{translateX:dropX},{scaleX:dropScaleX},{scaleY:dropScaleY},{skewX:tilt}]}]}/>}
      {tabs.map((t,index) => (
        <Pressable
          key={t}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === t }}
          style={({ pressed }) => [
            s.bottomItem,
            visualIndex === index && s.bottomItemActive,
            pressed && !draggingRef.current && { opacity: 0.68 },
          ]}
          onPress={() => onTab(t)}
        >
          <View style={[s.bottomIcon, visualIndex === index && s.bottomIconActive]}><Ionicons
              name={role === "patient" && t === "profile" ? "chatbubble-ellipses-outline" : icon[t]}
              size={20}
              color={visualIndex === index ? colors.brand : colors.muted}
            /></View>
          <Text style={[s.bottomText, visualIndex === index && s.bottomTextActive]}>
            {tabLabel(role,t)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

