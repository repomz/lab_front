import React from "react";
import { Alert, Platform } from "react-native";

export function startDictation(setValue: React.Dispatch<React.SetStateAction<string>>, setListening: (v:boolean)=>void) { if(Platform.OS!=="web"){Alert.alert("Диктовка","Нажмите микрофон на системной клавиатуре.");return} const w=window as any;const R=w.SpeechRecognition||w.webkitSpeechRecognition;if(!R){Alert.alert("Диктовка недоступна","Используйте микрофон клавиатуры.");return}const r=new R();r.lang="ru-RU";r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);r.onresult=(e:any)=>setValue(v=>`${v}${v?" ":""}${e.results?.[0]?.[0]?.transcript||""}`);r.start() }
