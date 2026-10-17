import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Modal as NativeModal, Platform, ScrollView as NativeScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "../styles";

export const ScrollView = React.forwardRef<React.ComponentRef<typeof NativeScrollView>, React.ComponentProps<typeof NativeScrollView>>(({ style, ...props }, ref) => (
  <NativeScrollView
    {...props}
    ref={ref}
    style={[s.scrollViewport, style]}
    bounces={false}
    alwaysBounceVertical={false}
    alwaysBounceHorizontal={false}
    overScrollMode="never"
  />
));
export function Modal(props: React.ComponentProps<typeof NativeModal>) {
  if (!props.visible) return null;
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return <WebModal onClose={props.onRequestClose as (()=>void)|undefined}>{props.children}</WebModal>;
  }
  return <NativeModal {...props} />;
}
const modalStack:HTMLElement[]=[];
const originalInert=new Map<HTMLElement,boolean>();
function syncModalInert(){
  if(!modalStack.length){originalInert.forEach((value,node)=>{node.inert=value});originalInert.clear();return}
  const top=modalStack[modalStack.length-1];
  for(const node of Array.from(document.body.children))if(node instanceof HTMLElement){
    if(!originalInert.has(node))originalInert.set(node,node.inert);
    node.inert=node!==top;
  }
}
function WebModal({children,onClose}:React.PropsWithChildren<{onClose?:()=>void}>){
  const ref=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const node=ref.current;if(!node)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    modalStack.push(node);syncModalInert();
    node.focus();
    const key=(event:KeyboardEvent)=>{
      if(node.inert)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current?.();return}
      if(event.key!=='Tab')return;
      const items=Array.from(node.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')).filter(el=>el.tabIndex>=0&&!el.hasAttribute('disabled')&&el.getClientRects().length>0&&!el.closest('[inert]'));
      const first=items[0],last=items[items.length-1];
      if(!first){event.preventDefault();node.focus()}
      else if(event.shiftKey&&(document.activeElement===first||document.activeElement===node)){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&(document.activeElement===last||!node.contains(document.activeElement))){event.preventDefault();first.focus()}
    };
    node.addEventListener('keydown',key);
    return()=>{node.removeEventListener('keydown',key);const index=modalStack.indexOf(node);if(index>=0)modalStack.splice(index,1);syncModalInert();if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus()};
  },[]);
  return createPortal(<div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} style={{position:'fixed',inset:0,zIndex:9999,display:'flex',flexDirection:'column',outline:'none'}}>{children}</div>,document.body);
}
export function SystemChrome({ dark, background, canvas = background, canvasGradient = false }: { dark: boolean; background: string; canvas?: string; canvasGradient?: boolean | "light" }) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    // WebKit versions that ignore overscroll-behavior still rubber-band at
    // scroll boundaries. Permit gestures only when a scrollable ancestor has
    // room in that direction, including portalled modals and text areas.
    let lastX = 0, lastY = 0;
    const start = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length === 1 && touch) { lastX = touch.clientX; lastY = touch.clientY; }
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - lastX, dy = touch.clientY - lastY;
      lastX = touch.clientX; lastY = touch.clientY;
      const horizontal = Math.abs(dx) > Math.abs(dy), delta = horizontal ? dx : dy;
      if (!delta) return;
      for (const node of event.composedPath()) {
        if (!(node instanceof HTMLElement)) continue;
        const style = getComputedStyle(node);
        const overflow = horizontal ? style.overflowX : style.overflowY;
        if (!/auto|scroll/.test(overflow)) continue;
        const max = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
        const position = horizontal ? node.scrollLeft : node.scrollTop;
        if (max > 1 && (delta > 0 ? position > 0 : position < max - 1)) return;
        // A scroll view at its boundary must not drag the view behind a modal.
        if (max > 1) break;
      }
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const ensureMeta = (name: string, content: string) => {
      let node = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!node) {
        node = document.createElement("meta");
        node.name = name;
        document.head.appendChild(node);
      }
      node.content = content;
    };
    const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (viewport && !viewport.content.includes("viewport-fit=cover")) viewport.content = `${viewport.content}, viewport-fit=cover`;
    ensureMeta("theme-color", background);
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    const image = canvasGradient === "light"
      ? "linear-gradient(135deg, #FFFFFF 0%, #FAFAFD 48%, #F0F0F5 100%)"
      : canvasGradient
        ? "linear-gradient(180deg, #17214B 0%, #40377C 54%, #176E78 100%)"
        : "none";
    document.documentElement.style.backgroundColor = canvas;
    document.documentElement.style.backgroundImage = image;
    // The physical HTML canvas is the only background owner. Repainting the
    // gradient on body/root restarts it on iOS PWA and exposes a horizontal
    // seam below the floating navigation.
    document.body.style.backgroundColor = "transparent";
    document.body.style.backgroundImage = "none";
    const root = document.getElementById("root");
    if (root) {
      root.style.backgroundColor = "transparent";
      root.style.backgroundImage = "none";
    }
  }, [background, canvas, canvasGradient]);
  return <StatusBar style={dark ? "light" : "dark"} translucent backgroundColor="transparent" />;
}

export function AuthBackdrop() {
  return <LinearGradient pointerEvents="none" colors={["#17214B", "#40377C", "#176E78"]} locations={[0,.54,1]} start={{x:0,y:0}} end={{x:0,y:1}} style={s.fullBleedBackdrop}/>;
}

export function AmbientCanvas() {
  if (Platform.OS === "web") return <View pointerEvents="none" style={s.ambientCanvasWeb}/>;
  return <View pointerEvents="none" style={s.ambientCanvas}>
    <LinearGradient colors={["#F4EFF8", "#F6F4FA", "#EEF7F6"]} locations={[0,.52,1]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject}/>
    <View style={[s.ambientHaze,s.ambientHazeViolet]}/>
    <View style={[s.ambientHaze,s.ambientHazeAqua]}/>
  </View>;
}

export function EducationCanvas() {
  if (Platform.OS === "web") return <View pointerEvents="none" style={s.educationCanvasWeb}/>;
  return <AmbientCanvas/>;
}
