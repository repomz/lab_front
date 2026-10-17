import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../api";
import { AIChat } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Button, Empty, firstName } from "../../components/ui";
import { Modal, ScrollView } from "../../components/platform";
import { startDictation } from "../../utils/dictation";
import { aiDesign as d } from "./design";

const suggestions=[
  {icon:"document-text-outline",text:"Объяснить результаты анализов"},
  {icon:"chatbubble-ellipses-outline",text:"Какие вопросы задать врачу?"},
  {icon:"clipboard-outline",text:"Как подготовиться к обследованию?"},
  {icon:"heart-outline",text:"Обсудить симптомы"},
] as const;
const chatDate=(chat:AIChat)=>new Date(chat.created_at).toLocaleString("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});

export function AIWorkspace({name="",listRequest=0,onUpload}:{name?:string;listRequest?:number;onUpload?:()=>void}){
  const [chats,setChats]=useState<AIChat[]>([]);
  const [active,setActive]=useState<AIChat|null>(null);
  const [message,setMessage]=useState("");
  const [title,setTitle]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [listOpen,setListOpen]=useState(false);
  const [listening,setListening]=useState(false);
  const [error,setError]=useState("");
  const [listError,setListError]=useState("");
  const [deleting,setDeleting]=useState("");
  const sending=useRef(false);
  const requestID=useRef(0);
  const mounted=useRef(true);
  const seenListRequest=useRef(listRequest);
  const insets=useSafeAreaInsets();
  const messageScroll=useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestID.current++}},[]);
  useEffect(()=>{if(listRequest!==seenListRequest.current){seenListRequest.current=listRequest;setListOpen(true)}},[listRequest]);
  useEffect(()=>{if(listOpen)void load()},[listOpen]);
  async function load(){
    setLoading(true);setListError("");
    try{const rows=await api.aiChats();if(mounted.current)setChats(rows.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)))}
    catch(e){if(mounted.current)setListError(e instanceof Error?e.message:"Не удалось загрузить список")}
    finally{if(mounted.current)setLoading(false)}
  }
  async function open(chat:AIChat){
    if(sending.current)return;
    const id=++requestID.current;setLoading(true);setListError("");
    try{const full=await api.aiChat(chat.id);if(mounted.current&&requestID.current===id){setActive(full);setTitle(full.title);setMessage("");setError("");setListOpen(false)}}
    catch(e){if(mounted.current)setListError(e instanceof Error?e.message:"Не удалось открыть чат")}
    finally{if(mounted.current)setLoading(false)}
  }
  function newChat(){if(sending.current)return;requestID.current++;setActive(null);setTitle("");setMessage("");setError("");setListOpen(false)}
  async function send(){
    if(sending.current||!message.trim())return;
    const text=message.trim();sending.current=true;setBusy(true);setError("");setMessage("");
    try{
      const chat=active||await api.createAIChat();
      if(!mounted.current)return;
      setActive(chat);setTitle(chat.title);
      await api.aiMessage(chat.id,text);
      const updated=await api.aiChat(chat.id);
      if(mounted.current)setActive(updated);
    }catch(e){if(mounted.current){setMessage(text);setError(e instanceof Error?e.message:"AI временно недоступен")}}
    finally{sending.current=false;if(mounted.current)setBusy(false)}
  }
  async function rename(){
    const value=title.trim();if(!active||!value||value===active.title)return;
    const id=active.id;
    try{await api.renameAIChat(id,value);if(mounted.current)setActive(current=>current?.id===id?{...current,title:value}:current)}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Не удалось переименовать чат")}
  }
  function remove(chat:AIChat){
    const perform=async()=>{
      if(sending.current||deleting)return;setDeleting(chat.id);setListError("");
      try{await api.deleteAIChat(chat.id);if(mounted.current){setChats(rows=>rows.filter(row=>row.id!==chat.id));if(active?.id===chat.id){setActive(null);setTitle("");setMessage("")}}}
      catch(e){if(mounted.current)setListError(e instanceof Error?e.message:"Не удалось удалить чат")}
      finally{if(mounted.current)setDeleting("")}
    };
    const question=`Удалить чат от ${chatDate(chat)}? Переписку нельзя будет восстановить.`;
    if(Platform.OS==="web"){if(window.confirm(question))void perform()}
    else Alert.alert("Удалить чат?",question,[{text:"Отмена",style:"cancel"},{text:"Удалить",style:"destructive",onPress:()=>void perform()}]);
  }
  const composer=<View style={d.composer}><View style={d.inputShell}>
    {onUpload&&<Pressable accessibilityRole="button" accessibilityLabel="Добавить документ" disabled={busy} onPress={onUpload} style={d.inputIcon}><Ionicons name="add" size={24} color="#6E8791"/></Pressable>}
    <TextInput accessibilityLabel="Сообщение AI" multiline style={d.input} placeholder="Спросите о здоровье…" value={message} onChangeText={setMessage} editable={!busy}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Диктовка" disabled={busy||listening} style={d.inputIcon} onPress={()=>startDictation(setMessage,setListening)}><Ionicons name={listening?"radio":"mic-outline"} size={22} color="#6E8791"/></Pressable>
  </View><Pressable accessibilityRole="button" accessibilityLabel="Отправить сообщение" disabled={busy||!message.trim()} onPress={()=>void send()} style={[d.send,(busy||!message.trim())&&{opacity:.5}]}>{busy?<ActivityIndicator color="white"/>:<Ionicons name="arrow-up" size={25} color="white"/>}</Pressable></View>;
  return <View style={d.page}>
    <LinearGradient pointerEvents="none" colors={["#CDEFFC","#E6F7FD","#FFFFFF"]} style={d.background}/>
    <KeyboardAvoidingView testID="ai-chat-page" style={d.page} behavior={Platform.OS==="ios"?"padding":undefined}>
      <View style={d.header}>
        {active?<Pressable accessibilityRole="button" accessibilityLabel="Новая консультация" disabled={busy} style={d.iconButton} onPress={newChat}><Ionicons name="add" size={23} color={colors.ink}/></Pressable>:<View style={{width:44}}/>}
        {active?<TextInput accessibilityLabel="Название чата" style={d.chatTitle} value={title} onChangeText={setTitle} onBlur={()=>void rename()} editable={!busy}/>:<Text style={d.heading}>AI-консультант</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Список чатов" style={d.iconButton} onPress={()=>setListOpen(true)}><Ionicons name="menu-outline" size={23} color={colors.ink}/></Pressable>
      </View>
      {!!error&&<Text accessibilityRole="alert" style={d.error}>{error}</Text>}
      {active?<>
        <ScrollView ref={messageScroll} style={{flex:1}} contentContainerStyle={d.conversation} keyboardShouldPersistTaps="handled" onContentSizeChange={()=>messageScroll.current?.scrollToEnd({animated:true})}>
          {active.messages.map((m,i)=><View key={i} style={[s.messageBubble,m.role==="user"?s.userBubble:s.assistantBubble]}><Text style={[s.body,m.role==="user"&&{color:colors.white}]}>{m.content}</Text><Text style={[s.messageTime,m.role==="user"&&{color:"#FFFFFFAA"}]}>{new Date(m.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text></View>)}
          {busy&&<View accessibilityLabel="AI готовит ответ" style={[s.messageBubble,s.assistantBubble]}><ActivityIndicator color={colors.violet}/><Text style={d.note}>Готовим ответ…</Text></View>}
        </ScrollView>
        <View nativeID="keyboard-composer-dock" style={[d.chatComposer,{marginBottom:94+insets.bottom}]}>{composer}</View>
      </>:<ScrollView contentContainerStyle={[d.hero,{paddingBottom:120+insets.bottom}]} keyboardShouldPersistTaps="handled">
        <View style={d.heart}><Ionicons name="heart" size={105} color="#E63743"/><Ionicons name="pulse" size={100} color="white" style={d.pulse}/></View>
        <View><Text style={d.greeting}>{name?`Здравствуйте, ${firstName(name)}!`:"Здравствуйте!"}</Text><Text style={d.question}>Чем могу помочь?</Text></View>
        {composer}
        <View style={d.suggestions}>{suggestions.map(item=><Pressable key={item.text} accessibilityRole="button" onPress={()=>setMessage(item.text)} style={d.suggestion}><Ionicons name={item.icon} size={24} color="#34505A"/><Text style={d.suggestionText}>{item.text}</Text></Pressable>)}</View>
        <Text style={d.note}>AI помогает разобраться в информации, но не заменяет врача.</Text>
      </ScrollView>}
    </KeyboardAvoidingView>
    <Modal visible={listOpen} animationType="slide" onRequestClose={()=>setListOpen(false)}><SafeAreaView style={s.fullScreenModal}>
      <View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Закрыть список" style={s.iconButton} onPress={()=>{requestID.current++;setListOpen(false)}}><Ionicons name="arrow-back" size={24}/></Pressable><Text style={s.fullScreenTitle}>Чаты с AI</Text><View style={s.headerSpacer}/></View>
      <ScrollView contentContainerStyle={d.listContent}>
        <Button label="Новая консультация" icon="add" disabled={busy||loading} onPress={newChat}/>
        {!!listError&&<><Text accessibilityRole="alert" style={d.error}>{listError}</Text><Button label="Повторить загрузку" onPress={()=>void load()}/></>}
        {loading?<ActivityIndicator color={colors.violet}/>:chats.map(chat=><View key={chat.id} style={d.listRow}><Pressable accessibilityRole="button" accessibilityLabel={`Открыть чат от ${chatDate(chat)}: ${chat.title}`} disabled={busy||!!deleting} style={d.listOpen} onPress={()=>void open(chat)}><Text style={d.listDate}>{chatDate(chat)}</Text><Text numberOfLines={1} style={d.listTitle}>{chat.title||"Консультация с AI"}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Удалить чат от ${chatDate(chat)}`} disabled={busy||!!deleting} style={d.iconButton} onPress={()=>remove(chat)}>{deleting===chat.id?<ActivityIndicator/>:<Ionicons name="trash-outline" size={22} color={colors.coral}/>}</Pressable></View>)}
        {!loading&&!listError&&!chats.length&&<Empty icon="chatbubbles-outline" title="Диалогов пока нет" text="Задайте первый вопрос — переписка появится здесь с датой."/>}
      </ScrollView>
    </SafeAreaView></Modal>
  </View>;
}
