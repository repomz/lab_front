import React,{useEffect,useState} from 'react';
import {Alert as NativeAlert,AlertButton,AlertOptions,Platform,Pressable,Text,View} from 'react-native';
import {Modal,ScrollView} from './platform';

type Notice={title:string;message?:string;buttons:AlertButton[];options?:AlertOptions};
let publish:((notice:Notice)=>void)|undefined;
const pending:Notice[]=[];
export const Alert={alert(title:string,message?:string,buttons?:AlertButton[],options?:AlertOptions){
  if(Platform.OS!=='web'){NativeAlert.alert(title,message,buttons,options);return}
  const notice={title,message,buttons:buttons?.length?buttons:[{text:'Понятно'}],options};
  if(publish)publish(notice);else pending.push(notice);
}};
export function FeedbackHost(){
  const [queue,setQueue]=useState<Notice[]>([]);
  useEffect(()=>{publish=notice=>setQueue(items=>[...items,notice]);setQueue(pending.splice(0));return()=>{publish=undefined}},[]);
  const current=queue[0];
  const dismiss=()=>{const cancel=current?.buttons.find(button=>button.style==='cancel');if(cancel){setQueue(items=>items.slice(1));cancel.onPress?.()}else if(current?.buttons.length===1){setQueue(items=>items.slice(1));current.options?.onDismiss?.()}};
  return <Modal visible={!!current} transparent onRequestClose={dismiss}><View style={{flex:1,backgroundColor:'#211A4966',justifyContent:'center',padding:20}}><View style={{maxWidth:480,width:'100%',maxHeight:'90%',alignSelf:'center',borderRadius:24,backgroundColor:'#FAFAFC',padding:24,gap:16}}>
    <Text accessibilityRole="header" style={{fontSize:20,fontWeight:'700',color:'#211A49'}}>{current?.title}</Text>
    <ScrollView style={{flexShrink:1}}><Text style={{fontSize:15,lineHeight:22,color:'#474250'}}>{current?.message}</Text></ScrollView>
    <View style={{gap:8}}>{current?.buttons.map((button,index)=><Pressable key={index} accessibilityRole="button" onPress={()=>{setQueue(items=>items.slice(1));button.onPress?.()}} style={{minHeight:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:button.style==='destructive'?'#A4214B':'#EDE9F7'}}><Text style={{fontSize:15,fontWeight:'600',color:button.style==='destructive'?'white':'#211A49'}}>{button.text||'Понятно'}</Text></Pressable>)}</View>
  </View></View></Modal>;
}
