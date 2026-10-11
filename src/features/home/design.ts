import { Platform, StyleSheet } from "react-native";

export const homeDesign = StyleSheet.create({
  screen:{flex:1,width:"100%"},
  content:{width:"100%",maxWidth:1120,alignSelf:"center",paddingHorizontal:24,paddingTop:18,paddingBottom:130,flexGrow:1},
  greetingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:20,marginBottom:24},
  greeting:{fontSize:29,lineHeight:34,fontWeight:"800",color:"#201A46",flex:1,letterSpacing:-.6},
  menu:{width:52,height:52,borderRadius:26,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#FFFFFF",backgroundColor:"#FFFFFFA0",...(Platform.OS==="web"?{boxShadow:"0 1px 3px #18152F14, inset 0 2px 2px #FFF"}:{})},
  notice:{padding:17,borderRadius:28,backgroundColor:"#FBEFF5",minHeight:94,marginBottom:36,gap:8},
  noticeRow:{flexDirection:"row",gap:12,alignItems:"flex-start"},
  noticeText:{flex:1,fontSize:15,lineHeight:21,fontWeight:"600",color:"#24212D"},
  details:{alignSelf:"flex-end",fontSize:14,fontWeight:"700",color:"#24212D",textDecorationLine:"underline"},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:16},
  card:{width:"46%",flexGrow:1,minHeight:160,borderRadius:34,padding:16,backgroundColor:"#FFFFFF99",borderWidth:1,borderColor:"#FFFFFF",gap:9,shadowColor:"#292735",shadowOpacity:.18,shadowRadius:18,shadowOffset:{width:0,height:14},...(Platform.OS==="web"?{boxShadow:"0 16px 30px #2523312B, inset 0 2px 3px #FFFFFF",backdropFilter:"blur(16px)"}:{})},
  cardLarge:{minHeight:220,padding:25,borderRadius:42},
  cardTitle:{fontSize:16,fontWeight:"700",color:"#201A46",marginTop:10,letterSpacing:-.5},
  cardText:{fontSize:13,lineHeight:19,color:"#56545A"},
  dock:{position:"absolute",bottom:18,left:24,right:24,flexDirection:"row",alignItems:"center",justifyContent:"space-between",pointerEvents:"box-none"} as any,
  nav:{height:58,width:172,borderRadius:32,flexDirection:"row",borderWidth:1,borderColor:"#FFFFFF",backgroundColor:"#FFFFFFBA",...(Platform.OS==="web"?{backdropFilter:"blur(20px)",boxShadow:"inset 0 2px 3px #FFF, 0 2px 6px #201A4610"}:{})},
  navItem:{flex:1,alignItems:"center",justifyContent:"center",borderRadius:30},
  navActive:{backgroundColor:"#FFFFFF80"},
  add:{width:58,height:58,borderRadius:29,backgroundColor:"#211A49",alignItems:"center",justifyContent:"center"},
});
