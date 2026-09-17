import React from "react";
import { ActivityIndicator, Animated, Image, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { Analysis, User } from "../types";
import { colors } from "../theme";
import { s } from "../styles";

export function AvatarView({user,size=44}:{user:User;size?:number}){
  const url=api.avatarURL(user);const preset=user.avatar_preset;const presetIcon=(preset==="leaf"?"leaf":preset==="heart"?"heart":preset==="sun"?"sunny":"person") as keyof typeof Ionicons.glyphMap;
  return <View style={[s.avatarView,{width:size,height:size,borderRadius:size*.34}]}>{url?<Image source={{uri:url}} style={{width:size,height:size,borderRadius:size*.34}}/>:preset?<Ionicons name={presetIcon} size={size*.48} color={colors.violet}/>:<Text style={[s.avatarText,{fontSize:size*.32}]}>{initials(user.full_name)}</Text>}</View>
}
export function BackButton({onPress,label="Назад"}:{onPress:()=>void;label?:string}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({pressed})=>[s.iconButton,pressed&&s.pressablePressed]}><Ionicons name="arrow-back" size={24} color={colors.ink}/></Pressable>
}
export function ScreenHeader({title,onBack}:{title:string;onBack:()=>void}){
  return <View style={s.fullScreenHeader}><BackButton onPress={onBack}/><Text numberOfLines={2} style={s.fullScreenTitle}>{title}</Text><View style={s.headerSpacer}/></View>
}
export function MiniAction({label,onPress,icon}:{label:string;onPress:()=>void;icon?:keyof typeof Ionicons.glyphMap}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.miniAction}>{icon&&<Ionicons name={icon} size={16} color={colors.brand}/>}<Text style={s.miniActionText}>{label}</Text></Pressable>}
export function AIList({title,items}:{title:string;items?:string[]}){if(!items?.length)return null;return <View style={s.aiList}><Text style={s.replyLabel}>{title}</Text>{items.map((x,i)=><Text key={i} style={s.body}>• {x}</Text>)}</View>}
export function Field(props: any) {
  const { dark, ...inputProps } = props;
  return (
    <View style={s.field}>
      <Text style={[s.label, dark && s.labelOnDark]}>{props.label}</Text>
      <TextInput
        {...inputProps}
        label={undefined}
        style={[s.input, dark && s.inputOnDark]}
        placeholderTextColor={dark ? "#C7D1E7" : "#9AA59F"}
        autoCorrect={props.autoCorrect ?? false}
      />
    </View>
  );
}
export function Button({
  label,
  onPress,
  icon,
  compact,
  disabled,
  kind,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
  disabled?: boolean;
  kind?: "ghost" | "glass";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        compact && s.buttonCompact,
        kind === "ghost" && s.buttonGhost,
        kind === "glass" && s.buttonGlass,
        pressed && !disabled && s.glassPressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={colors.violet}
        />
      )}
      <Text style={s.buttonText}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Segment({
  active,
  label,
  icon,
  dark,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[s.segmentItem, active && s.segmentActive, dark && active && s.segmentActiveOnDark]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={dark ? (active ? colors.white : "#C7D1E7") : (active ? colors.brand : colors.muted)}
      />
      <Text
        style={[
          s.segmentText,
          active && { color: colors.brand },
          dark && s.segmentTextOnDark,
          dark && active && { color: colors.white },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.rowBetween}>
        <Text style={s.sectionTitle}>{title}</Text>
        {action && (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            style={s.linkButton}
            onPress={onAction}
          >
            <Text style={s.link}>{action} →</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}
export function Empty({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={38} color={colors.brand} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}
export function Source({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.source, pressed && s.pressablePressed]}
    >
      <Ionicons name={icon} size={28} color={colors.brand} />
      <Text style={s.sourceText}>{label}</Text>
    </Pressable>
  );
}
export function Action({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        pressed && s.pressablePressed,
        disabled && s.actionDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.brand} />
      ) : (
        <Ionicons name={icon} size={23} color={danger?colors.coral:colors.brand} />
      )}
      <Text style={[s.sourceText,danger&&{color:colors.coral}]}>{label}</Text>
    </Pressable>
  );
}
export function Status({ value }: { value: string }) {
  const bad = value === "low" || value === "high" || value === "unknown";
  return (
    <View style={[s.status, bad && s.statusBad]}>
      <Text style={[s.statusText, bad && { color: colors.amber }]}>
        {value === "high"
          ? "выше"
          : value === "low"
            ? "ниже"
            : value === "normal"
              ? "норма"
              : "проверить"}
      </Text>
    </View>
  );
}
export function Banner({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <View style={s.banner}>
      <Text style={s.bannerText}>{text}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть сообщение"
        hitSlop={12}
        onPress={onClose}
      >
        <Ionicons name="close" size={18} color={colors.red} />
      </Pressable>
    </View>
  );
}
export function Loading({ opacity }: { opacity: Animated.Value }) {
  return (
    <View style={s.loading}>
      <Animated.View style={[s.loadingContent,{opacity}]}><Image source={require("../../assets/shield-mark.png")} resizeMode="contain" style={s.loadingShield}/><Text style={s.loadingTitle}>Ваше здоровье теперь под контролем</Text></Animated.View>
    </View>
  );
}
export const firstName = (x: string) => x.trim().split(/\s+/)[0] || x;
export const initials = (x: string) =>
  x
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
export const date = (x: string) =>
  new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(x));
export const analysisDate = (analysis: Analysis) => analysis.collected_at || analysis.created_at;

export function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[s.choice, active && s.choiceActive]}><Text style={[s.choiceText, active && s.choiceTextActive]}>{label}</Text></Pressable>;
}
export function SurveyScale({ label, value, onChange, positive = false }: { label: string; value?: string; onChange: (value: string) => void; positive?: boolean }) {
  return <View style={s.surveyScale}><Text style={s.label}>{label}</Text><View style={s.choiceRow}>{["rare", "sometimes", "often"].map((option, index) => <Choice key={option} active={value === option} label={(positive ? ["Редко", "Иногда", "Ежедневно"][index] : ["Редко", "Иногда", "Часто"][index]) || option} onPress={() => onChange(option)} />)}</View></View>;
}
