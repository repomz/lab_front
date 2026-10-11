import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View } from "react-native";

// Code-native mark: the pulse travels through the right arm and reveals aiLab.
export function BrandMark({size=196,animate=true}:{size?:number;animate?:boolean}) {
  const progress=useRef(new Animated.Value(animate?0:1)).current;
  useEffect(()=>{
    let disposed=false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{
      if(disposed)return;
      if(reduced||!animate){progress.setValue(1);return}
      Animated.timing(progress,{toValue:1,duration:6500,useNativeDriver:Platform.OS!=="web"}).start();
    });
    return ()=>{disposed=true;progress.stopAnimation()};
  },[animate,progress]);
  return <View accessibilityLabel="aiLab" accessibilityRole="image" style={{width:size,height:size,alignSelf:"center"}}>
    <View style={[b.shape,{transform:[{scale:size/196}]}]}>
      <View style={b.vertical}/><View style={b.horizontal}/><View style={b.foldTop}/><View style={b.foldBottom}/><View style={b.foldDiagonal}/><View style={b.foldLeft}/><View style={b.foldLower}/>
      <View style={b.window}><Animated.View style={[b.ticker,{transform:[{translateX:progress.interpolate({inputRange:[0,.8,1],outputRange:[100,-45,-92]})}]}]}>
        <View style={b.pulse}>{([[0,16,20,16],[20,16,25,10],[25,10,30,20],[30,20,36,3],[36,3,42,25],[42,25,48,12],[48,12,53,16],[53,16,78,16]] as const).map(([x,y,x2,y2],i)=><View key={i} style={{position:"absolute",left:(x+x2)/2-Math.hypot(x2-x,y2-y)/2,top:(y+y2)/2,width:Math.hypot(x2-x,y2-y),height:2.5,borderRadius:2,backgroundColor:"white",transform:[{rotate:`${Math.atan2(y2-y,x2-x)}rad`}]}}/>)}</View><Text style={b.word}>aiLab</Text>
      </Animated.View></View>
    </View>
  </View>;
}
const b=StyleSheet.create({
  shape:{position:"absolute",width:196,height:196,left:"50%",top:"50%",marginLeft:-98,marginTop:-98},
  vertical:{position:"absolute",width:68,height:196,left:64,top:0,borderRadius:34,backgroundColor:"#FE145F"},
  horizontal:{position:"absolute",width:196,height:68,left:0,top:64,borderRadius:34,backgroundColor:"#FE145F"},
  foldTop:{position:"absolute",width:132,height:68,left:64,top:64,borderTopRightRadius:34,borderBottomRightRadius:34,backgroundColor:"#CA123E"},
  foldBottom:{position:"absolute",width:68,height:64,left:64,top:132,borderBottomLeftRadius:34,borderBottomRightRadius:34,backgroundColor:"#CA123E"},
  foldDiagonal:{position:"absolute",left:64,top:64,width:0,height:0,borderTopWidth:68,borderRightWidth:68,borderTopColor:"#FE145F",borderRightColor:"transparent"},
  foldLeft:{position:"absolute",left:44,top:64,width:0,height:0,borderTopWidth:68,borderLeftWidth:20,borderTopColor:"#970D34",borderLeftColor:"transparent"},
  foldLower:{position:"absolute",left:64,top:132,width:0,height:0,borderTopWidth:22,borderLeftWidth:68,borderTopColor:"#970D34",borderLeftColor:"transparent"},
  window:{position:"absolute",left:93,top:89,width:93,height:30,overflow:"hidden"},
  ticker:{flexDirection:"row",alignItems:"center",width:200},
  pulse:{width:98,height:30},
  word:{color:"white",fontSize:23,lineHeight:30,fontWeight:"800"},
});
