import { StyleSheet } from "react-native";

export const authDesign=StyleSheet.create({
  welcome:{flex:1,width:"100%",maxWidth:480,alignSelf:"center",paddingHorizontal:24,paddingTop:64,paddingBottom:30,alignItems:"center",gap:32},
  smallWelcome:{paddingTop:22,gap:20},
  title:{fontSize:29,lineHeight:35,fontWeight:"800",textAlign:"center",color:"#19172D"},
  hint:{fontSize:15,lineHeight:21,textAlign:"center",color:"#56545B",marginTop:5},
  actions:{width:"100%",gap:14,marginTop:18},
  primary:{height:52,borderRadius:28,alignItems:"center",justifyContent:"center",backgroundColor:"#211A49"},
  primaryText:{color:"white",fontSize:16,fontWeight:"700"},
  secondary:{height:52,borderRadius:28,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#211A49"},
  secondaryText:{color:"#211A49",fontSize:15,fontWeight:"700"},
  slogan:{color:"#211A49",fontSize:20,lineHeight:28,textAlign:"center",fontWeight:"600"},
  smallBrand:{paddingTop:14,paddingBottom:10},
});

// Shared names keep existing PIN/registration behavior while replacing its theme.
export const authRefreshStyles=StyleSheet.create({
  authOuter:{flex:1,backgroundColor:"#FAFAFC",overflow:"hidden"},
  authWelcomeTitle:{color:"#211A49",fontSize:29,lineHeight:36,fontWeight:"800"},
  authWelcomeSlogan:{color:"#56545B",fontSize:17,lineHeight:24},
  authPINTitle:{color:"#211A49",fontSize:23,lineHeight:30,fontWeight:"800",textAlign:"center"},
  authPINHint:{color:"#66616E",fontSize:16},
  authRegisterHint:{color:"#66616E",fontSize:16,lineHeight:23},
  authRegisterTitle:{color:"#211A49",fontSize:27,fontWeight:"800"},
  authExistingText:{color:"#686074",fontSize:13,fontWeight:"600"},
  authPINError:{color:"#AF204B",fontSize:14,textAlign:"center",lineHeight:20},
  authBack:{width:46,height:46,borderRadius:23,alignItems:"center",justifyContent:"center",backgroundColor:"#F0EDF4"},
  authLoginGlass:{minHeight:52,borderRadius:28,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center",backgroundColor:"#211A49"},
  authLoginGlassText:{color:"white",fontSize:16,fontWeight:"700"},
  authAboutTitle:{color:"#211A49",fontSize:28,fontWeight:"800"},
  authAboutText:{color:"#55515F",fontSize:16,lineHeight:25},
  authAboutDisclaimer:{color:"#716B79",fontSize:13,lineHeight:20},
  authRoleTitle:{color:"#211A49",fontSize:19,fontWeight:"700"},
  authRoleText:{color:"#716B79",fontSize:14,lineHeight:20},
  authRoleCard:{padding:18,borderRadius:24,borderWidth:1,borderColor:"#E3DFEA",backgroundColor:"#FFF",flexDirection:"row",alignItems:"center",gap:14},
  pinDigit:{width:29,color:"#211A49",fontSize:30,fontWeight:"800",textAlign:"center"},
  pinKey:{width:"100%",height:"100%",borderRadius:26,alignItems:"center",justifyContent:"center",backgroundColor:"#F0EDF5"},
  pinKeyText:{fontSize:28,color:"#211A49",fontWeight:"600"},
  pinDotFilled:{borderColor:"#211A49",backgroundColor:"#211A49"},
  pinUtilityText:{color:"#211A49",fontSize:14,fontWeight:"600"},
  pinUtilityTextDisabled:{color:"#AAA5AF",fontSize:12},
});
