import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView as NativeScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api";
import { Consultation, SupportMessage } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Empty } from "../../components/ui";
import { ScrollView } from "../../components/platform";

export function SupportChat({ onBack: _onBack, compact = false }: { onBack: () => void; compact?: boolean }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [textValue, setTextValue] = useState("");
  const [busy, setBusy] = useState(false);
  const sendingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<React.ComponentRef<typeof NativeScrollView>>(null);
  async function load() {
    try { setMessages(await api.supportMessages()); }
    catch (error) { Alert.alert("Чат недоступен", error instanceof Error ? error.message : "Не удалось загрузить сообщения"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function send() {
    const value = textValue.trim();
    if (!value || busy || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    try {
      const created = await api.sendSupportMessage(value);
      setMessages((current) => [...current, created]);
      setTextValue("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      Alert.alert("Не удалось отправить", error instanceof Error ? error.message : "Ошибка");
    } finally { sendingRef.current = false; setBusy(false); }
  }
  return <KeyboardAvoidingView testID="support-page" behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.supportPage, compact && s.supportPageCompact]}>
    <ScrollView ref={listRef} style={{flex:1}} contentContainerStyle={s.supportMessages} keyboardShouldPersistTaps="always" onContentSizeChange={() => listRef.current?.scrollToEnd({animated:false})}>
      {loading ? <ActivityIndicator color={colors.violet}/> : !messages.length ? <View style={s.supportEmpty}><View style={s.supportMark}><View style={s.supportMarkBack}/><View style={s.supportMarkFront}><Ionicons name="chatbox-ellipses" size={54} color={colors.white}/></View></View><Text style={s.supportEmptyTitle}>Это чат с Lab</Text><Text style={s.supportEmptyText}>Задайте вопрос о приложении, загрузке анализов или доступе к медицинским данным</Text><View style={s.supportTopics}><View style={s.supportTopic}><Ionicons name="document-text-outline" size={24} color={colors.violet}/></View><View style={s.supportTopic}><Ionicons name="shield-checkmark-outline" size={24} color={colors.violet}/></View><View style={s.supportTopic}><Ionicons name="help-circle-outline" size={25} color={colors.violet}/></View></View></View> : messages.map((message) => <View key={message.id} style={[s.messageBubble,message.sender === "patient" ? s.userBubble : s.assistantBubble,s.supportBubble]}><Text style={[s.body,message.sender === "patient" && {color:colors.white}]}>{message.text}</Text><Text style={[s.messageTime,message.sender === "patient" && {color:"#FFFFFFAA"}]}>{new Date(message.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text></View>)}
    </ScrollView>
    <View nativeID="keyboard-composer-dock" style={s.supportComposer}><View style={s.supportComposerIcon}><Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.ink}/></View><TextInput multiline maxLength={4000} style={[s.chatInput,s.supportInput]} placeholder="Ваш вопрос" value={textValue} onChangeText={setTextValue} onFocus={()=>setTimeout(()=>listRef.current?.scrollToEnd({animated:false}),120)}/><Pressable {...(Platform.OS==="web"?({onMouseDown:(event:any)=>{event.preventDefault();void send()}} as any):{})} accessibilityRole="button" accessibilityLabel="Отправить" disabled={busy||!textValue.trim()} style={[s.sendButton,(busy||!textValue.trim())&&s.supportSendDisabled]} onPress={()=>void send()}>{busy?<ActivityIndicator size="small" color={colors.violet}/>:<Ionicons name="arrow-up" size={22} color={colors.violet}/>}</Pressable></View>
  </KeyboardAvoidingView>;
}

export function consultationMessages(item: Consultation) {
  if (item.messages?.length) return item.messages;
  const messages: Consultation["messages"] = [];
  if (item.question) messages.push({sender:"patient",text:item.question,created_at:item.created_at});
  if (item.reply) messages.push({sender:"doctor",text:item.reply,created_at:item.created_at});
  return messages;
}

export function ConsultationThread({item,viewer,onBack,onRefresh}:{item:Consultation;viewer:"patient"|"doctor";onBack:()=>void;onRefresh:()=>void}) {
  const [textValue,setTextValue]=useState("");
  const [busy,setBusy]=useState(false);
  const listRef=useRef<React.ComponentRef<typeof NativeScrollView>>(null);
  const messages=consultationMessages(item);
  async function send(){const text=textValue.trim();if(!text||busy)return;setBusy(true);try{await api.consultationMessage(item.id,text);setTextValue("");onRefresh()}catch(error){Alert.alert("Сообщение не отправлено",error instanceof Error?error.message:"Ошибка")}finally{setBusy(false)}}
  return <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={s.consultationThread}>
    <View style={s.chatPlainHeader}><Pressable accessibilityLabel="Назад" onPress={onBack} style={s.supportHeaderButton}><Ionicons name="arrow-back" size={25} color={colors.ink}/></Pressable><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.supportTitle}>{viewer==="doctor"?(item.patient_name||"Пользователь"):(item.title||"Диалог с врачом")}</Text><Text numberOfLines={1} style={s.supportStatus}>{item.specialty||new Date(item.created_at).toLocaleDateString("ru-RU")}</Text></View></View>
    <ScrollView ref={listRef} style={{flex:1}} contentContainerStyle={s.supportMessages} keyboardShouldPersistTaps="always" onContentSizeChange={()=>listRef.current?.scrollToEnd({animated:false})}>{messages?.map((message,index)=>{const own=message.sender===viewer;return <View key={`${message.created_at}-${index}`} style={[s.messageBubble,own?s.userBubble:s.assistantBubble,s.supportBubble]}><Text style={[s.body,own&&{color:colors.white}]}>{message.text}</Text><Text style={[s.messageTime,own&&{color:"#FFFFFFAA"}]}>{new Date(message.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text></View>})}</ScrollView>
    <View nativeID="keyboard-composer-dock" style={s.supportComposer}><TextInput multiline maxLength={4000} style={[s.chatInput,s.supportInput]} placeholder="Сообщение" value={textValue} onChangeText={setTextValue}/><Pressable accessibilityLabel="Отправить" disabled={busy||!textValue.trim()} onPress={()=>void send()} style={[s.sendButton,(busy||!textValue.trim())&&s.supportSendDisabled]}>{busy?<ActivityIndicator size="small" color={colors.violet}/>:<Ionicons name="arrow-up" size={22} color={colors.violet}/>}</Pressable></View>
  </KeyboardAvoidingView>;
}

export function PatientDoctorChats({data,initial,onConsumed,onRefresh,compact:_compact}:{data:Consultation[];initial:Consultation|null;onConsumed:()=>void;onRefresh:()=>void;compact:boolean}) {
  const [activeID,setActiveID]=useState("");
  useEffect(()=>{if(initial?.source==="doctor"){setActiveID(initial.id);onConsumed()}},[initial,onConsumed]);
  const threads=data.filter(item=>item.source==="doctor").sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const active=threads.find(item=>item.id===activeID);
  if(active)return <ConsultationThread item={active} viewer="patient" onBack={()=>setActiveID("")} onRefresh={onRefresh}/>;
  return <View style={s.doctorInbox}><ScrollView contentContainerStyle={s.doctorInboxList}>{threads.map(item=><Pressable key={item.id} onPress={()=>setActiveID(item.id)} style={s.supportThread}><View style={s.supportThreadIcon}><Ionicons name="medical-outline" size={21} color={colors.violet}/></View><View style={{flex:1,minWidth:0}}><View style={s.rowBetween}><Text numberOfLines={1} style={s.doctorDirectoryName}>{item.title||item.specialty||"Консультация"}</Text><Text style={s.analysisMeta}>{new Date(item.created_at).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})}</Text></View><Text numberOfLines={1} style={s.analysisMeta}>{consultationMessages(item)?.at(-1)?.text||item.question}</Text></View></Pressable>)}{!threads.length?<Empty icon="chatbubbles-outline" title="Сообщений пока нет" text="Здесь появятся ответы врачей и история консультаций."/>:null}</ScrollView></View>;
}

export function DoctorConsultationInbox({data,compact:_compact,onRefresh}:{data:Consultation[];compact:boolean;onRefresh:()=>void}) {
  const [activeID,setActiveID]=useState("");
  const [query,setQuery]=useState("");
  const threads=data.filter(item=>item.source!=="ai"&&(item.patient_name||"").toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU"))).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const active=threads.find(item=>item.id===activeID);
  if(active)return <ConsultationThread item={active} viewer="doctor" onBack={()=>setActiveID("")} onRefresh={onRefresh}/>;
  return <View style={s.doctorInbox}><View style={s.doctorSearch}><Ionicons name="search" size={20} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={query} onChangeText={setQuery} placeholder="Найти пользователя"/></View><ScrollView contentContainerStyle={s.doctorInboxList}>{threads.map(item=><Pressable key={item.id} onPress={()=>setActiveID(item.id)} style={s.supportThread}><View style={s.supportThreadIcon}><Ionicons name="chatbubbles-outline" size={21} color={colors.violet}/></View><View style={{flex:1,minWidth:0}}><View style={s.rowBetween}><Text numberOfLines={1} style={s.doctorDirectoryName}>{item.patient_name||"Пользователь"}</Text><Text style={s.analysisMeta}>{new Date(item.created_at).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})}</Text></View><Text numberOfLines={1} style={s.analysisMeta}>{consultationMessages(item)?.at(-1)?.text||item.question}</Text></View></Pressable>)}{!threads.length?<Text style={s.patientSearchEmpty}>Запросов и диалогов пока нет</Text>:null}</ScrollView></View>;
}

export function DoctorSupportInbox({compact}:{compact:boolean}) {
  const [messages,setMessages]=useState<SupportMessage[]>([]);
  const [activeUser,setActiveUser]=useState("");
  const [reply,setReply]=useState("");
  const [busy,setBusy]=useState(false);
  const [query,setQuery]=useState("");
  const load=()=>api.supportMessages().then(setMessages).catch(error=>Alert.alert("Чат недоступен",error instanceof Error?error.message:"Не удалось загрузить сообщения"));
  useEffect(()=>{void load()},[]);
  const threads=useMemo(()=>{const grouped=new Map<string,{userId:string;name:string;messages:SupportMessage[];last:SupportMessage}>();messages.forEach(message=>{const existing=grouped.get(message.user_id);if(existing){existing.messages.push(message);existing.last=message}else grouped.set(message.user_id,{userId:message.user_id,name:message.patient_name||"Пользователь",messages:[message],last:message})});return [...grouped.values()].filter(thread=>thread.name.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU"))).sort((a,b)=>b.last.created_at.localeCompare(a.last.created_at))},[messages,query]);
  const active=threads.find(thread=>thread.userId===activeUser);
  async function send(){if(!active||!reply.trim()||busy)return;setBusy(true);try{await api.sendSupportMessage(reply.trim(),active.userId);setReply("");await load()}catch(error){Alert.alert("Не удалось отправить",error instanceof Error?error.message:"Ошибка")}finally{setBusy(false)}}
  if(active)return <KeyboardAvoidingView testID="support-page" behavior={Platform.OS==="ios"?"padding":undefined} style={[s.supportPage,compact&&s.supportPageCompact]}><View style={s.supportHeader}><Pressable accessibilityRole="button" accessibilityLabel="К списку чатов" onPress={()=>setActiveUser("")} style={s.supportHeaderButton}><Ionicons name="arrow-back" size={25} color={colors.ink}/></Pressable><View style={s.supportHeaderTitleOnly}><Text style={s.supportTitle}>{active.name}</Text></View></View><ScrollView contentContainerStyle={s.supportMessages} keyboardShouldPersistTaps="handled">{active.messages.map(message=><View key={message.id} style={[s.messageBubble,message.sender==="support"?s.userBubble:s.assistantBubble,s.supportBubble]}><Text style={[s.body,message.sender==="support"&&{color:colors.white}]}>{message.text}</Text><Text style={[s.messageTime,message.sender==="support"&&{color:"#FFFFFFAA"}]}>{new Date(message.created_at).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</Text></View>)}</ScrollView><View nativeID="keyboard-composer-dock" style={s.supportComposer}><TextInput multiline maxLength={4000} style={[s.chatInput,s.supportInput]} placeholder="Ответ пользователю" value={reply} onChangeText={setReply}/><Pressable accessibilityRole="button" disabled={busy||!reply.trim()} style={[s.sendButton,(busy||!reply.trim())&&{opacity:.35}]} onPress={()=>void send()}>{busy?<ActivityIndicator size="small" color={colors.violet}/>:<Ionicons name="arrow-up" size={22} color={colors.violet}/>}</Pressable></View></KeyboardAvoidingView>;
  return <View style={s.doctorInbox}><View style={s.doctorSearch}><Ionicons name="search" size={20} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={query} onChangeText={setQuery} placeholder="Найти пользователя"/></View><ScrollView contentContainerStyle={s.doctorInboxList}>{threads.map(thread=><Pressable key={thread.userId} onPress={()=>setActiveUser(thread.userId)} style={s.supportThread}><View style={s.supportThreadIcon}><Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.violet}/></View><View style={{flex:1,minWidth:0}}><View style={s.rowBetween}><Text numberOfLines={1} style={s.doctorDirectoryName}>{thread.name}</Text><Text style={s.analysisMeta}>{new Date(thread.last.created_at).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})}</Text></View><Text numberOfLines={1} style={s.analysisMeta}>{thread.last.text}</Text></View></Pressable>)}{!threads.length?<Text style={s.patientSearchEmpty}>Сообщений пока нет</Text>:null}</ScrollView></View>;
}
