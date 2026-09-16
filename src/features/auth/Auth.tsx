import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, setToken } from "../../api";
import { User } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { Choice, Field, firstName } from "../../components/ui";
import { ScrollView } from "../../components/platform";
import { APP_VERSION, LAST_LOGIN_KEY, LAST_NAME_KEY, PATIENT_LOGIN_KEY, PATIENT_NAME_KEY, doctorSpecialties } from "../../config";
import { ageFromBirthDate, formatBirthDate } from "../profile/utils";

export function Auth({ onDone }: { onDone: (u: User, t: string) => void }) {
  const entranceOpacity = useRef(new Animated.Value(1)).current;
  const { width: authWidth } = useWindowDimensions();
  const desktopAuth = authWidth >= 900;
  const wideAuth = authWidth >= 1800;
  const initialLogin = useMemo(() => {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return "";
    return localStorage.getItem(LAST_LOGIN_KEY) || localStorage.getItem(PATIENT_LOGIN_KEY) || "";
  }, []);
  const initialName = useMemo(() => {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return "";
    return localStorage.getItem(LAST_NAME_KEY) || localStorage.getItem(PATIENT_NAME_KEY) || "";
  }, []);
  const [remembered, setRemembered] = useState(initialLogin);
  const [rememberedName, setRememberedName] = useState(initialName);
  const [phase, setPhase] = useState<"welcome" | "login" | "pin" | "register" | "about">("welcome");
  const [registerStep, setRegisterStep] = useState<"role" | "profile" | "details" | "doctor" | "pin">("role");
  const [form, setForm] = useState({
    email: initialLogin,
    pin: "",
    fullName: "",
    specialization: "",
    licenseNumber: "",
    birthDate: "",
    gender: "" as ""|"female"|"male",
    heightCM: "",
    weightKG: "",
    role: "patient" as "patient"|"doctor",
    city: "",
    about: "",
    experience: "",
    services: "",
    workplace: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pinErrorNonce, setPinErrorNonce] = useState(0);
  const loginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileReady = form.fullName.trim().length > 0 && /^[a-zA-Zа-яА-ЯёЁ0-9._-]{1,32}$/.test(form.email.trim());
  const registrationAge = ageFromBirthDate(form.birthDate);
  const detailsReady = form.role === "doctor" ? !!form.specialization.trim() : registrationAge >= 18 && registrationAge <= 120 && !!form.gender;
  const registrationReady = /^\d{4}$/.test(form.pin) && profileReady && detailsReady;
  function remember(user: User) {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
    localStorage.setItem(LAST_LOGIN_KEY, user.email);
    localStorage.setItem(LAST_NAME_KEY, firstName(user.full_name));
    if (user.role === "patient") { localStorage.setItem(PATIENT_LOGIN_KEY, user.email); localStorage.setItem(PATIENT_NAME_KEY, firstName(user.full_name)); }
  }
  async function login(pin: string) {
    if (busy || !form.email.trim() || !/^\d{4}$/.test(pin)) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.login(form.email, pin);
      remember(r.user);
      onDone(r.user, r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setPinErrorNonce((current) => current + 1);
      if (Platform.OS === "web" && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([45, 35, 45]);
      setForm((current) => ({ ...current, pin: "" }));
    } finally {
      setBusy(false);
    }
  }
  function changePIN(pin: string) {
    if (busy) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    setForm((current) => ({ ...current, pin }));
    setError("");
    if (loginTimer.current) clearTimeout(loginTimer.current);
    // The last dot must be visibly committed before network work starts. This keeps
    // the keypad feeling immediate even when the connection is not.
    if (phase === "pin" && pin.length === 4) loginTimer.current = setTimeout(() => void login(pin), 110);
  }
  useEffect(() => () => { if (loginTimer.current) clearTimeout(loginTimer.current); }, []);
  async function register() {
    if (!registrationReady || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.register({ email: form.email.trim(), pin: form.pin, role: form.role, fullName: form.fullName.trim(), birthDate: form.role === "patient" ? form.birthDate : "", gender: (form.role === "patient" ? form.gender : "male") as "female"|"male", specialization: form.specialization });
      if (form.role === "doctor") {
        await setToken(r.token);
        const updated = await api.updateDoctorProfile({fullName:form.fullName.trim(),specialization:form.specialization,city:form.city,about:form.about,workplace:form.workplace,experience:form.experience.split("\n"),services:form.services.split("\n"),schedule_step:30,visible_days:6});
        r.user = updated;
      }
      remember(r.user);
      onDone(r.user, r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  }
  function forget() {
    setForm((current) => ({ ...current, pin: "" }));
    setPhase("welcome");
    setError("");
  }
  function switchUser() {
	if (Platform.OS === "web" && typeof localStorage !== "undefined") {
	  localStorage.removeItem(PATIENT_LOGIN_KEY);
	  localStorage.removeItem(PATIENT_NAME_KEY);
	  localStorage.removeItem(LAST_LOGIN_KEY);
	  localStorage.removeItem(LAST_NAME_KEY);
	}
    setRemembered("");
    setRememberedName("");
    setForm((current) => ({ ...current, email: "", pin: "" }));
    setPhase("welcome");
    setError("");
  }
  return (
    <View style={s.authLayer}>
      <Animated.View style={[s.authContent,{opacity:entranceOpacity}]}>
      <SafeAreaView edges={["top","right","bottom","left"]} style={s.authScreen}>
        {phase === "welcome" && <View style={[s.authWelcome,desktopAuth&&s.authWelcomeDesktop,wideAuth&&s.authWelcomeWide]}>
          <View style={[s.authWelcomeCopy,desktopAuth&&s.authWelcomeCopyDesktop,wideAuth&&s.authWelcomeCopyWide]}>{desktopAuth&&<View style={s.authDesktopBrand}><View style={s.authDesktopBrandMark}><Ionicons name="pulse" size={25} color={colors.white}/></View><Text style={s.authDesktopBrandText}>Lab</Text></View>}<Text style={[s.authWelcomeTitle,desktopAuth&&s.authWelcomeTitleDesktop,wideAuth&&s.authWelcomeTitleWide]}>{rememberedName ? `Здравствуйте, ${rememberedName}` : "Добро пожаловать"}</Text><Text style={[s.authWelcomeSlogan,desktopAuth&&s.authWelcomeSloganDesktop,wideAuth&&s.authWelcomeSloganWide]}>{remembered ? "Ваше здоровье под контролем" : "Все результаты здоровья — в одном месте"}</Text>{desktopAuth&&<Text style={[s.authDesktopLead,wideAuth&&s.authDesktopLeadWide]}>Анализы, динамика показателей и связь с врачом — в едином защищённом пространстве.</Text>}</View>
          <View style={[s.authWelcomeActions,desktopAuth&&s.authWelcomeActionsDesktop,wideAuth&&s.authWelcomeActionsWide]}>{desktopAuth&&<><Text style={s.authDesktopPanelTitle}>Продолжить работу</Text><Text style={s.authDesktopPanelHint}>Войдите в существующий профиль или создайте новый.</Text></>}{remembered ? <><AuthGlassAction label="Войти" onPress={()=>{setPhase("pin");setForm(current=>({...current,email:remembered,pin:""}));}}/><Pressable accessibilityRole="button" style={({pressed})=>[s.authSwitchUser,pressed&&{opacity:.6}]} onPress={switchUser}><Text style={s.authSwitchUserText}>Сменить пользователя</Text></Pressable></> : <><AuthGlassAction label="Войти" onPress={()=>{setError("");setForm(current=>({...current,email:"",pin:""}));setPhase("login");}}/><Pressable accessibilityRole="button" style={({pressed})=>[s.authCompactRegister,desktopAuth&&s.authCompactRegisterDesktop,pressed&&{opacity:.65}]} onPress={()=>{setError("");setRegisterStep("role");setPhase("register");}}><Ionicons name="person-add-outline" size={17} color={colors.white}/><Text style={s.authCompactRegisterText}>Зарегистрироваться</Text></Pressable><Pressable accessibilityRole="button" style={s.authAboutLink} onPress={()=>setPhase("about")}><Text style={s.authExistingText}>О приложении</Text></Pressable>{error?<Text style={s.authPINError}>{error}</Text>:null}</>}</View>
        </View>}
        {phase === "login" && <KeyboardAvoidingView testID="auth-entry-page" style={s.authRegisterKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}><View nativeID="auth-entry-content" style={s.authLoginEntry}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setPhase("welcome")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><View><Text style={s.authWelcomeTitle}>Вход</Text><Text style={s.authRegisterHint}>Введите логин пользователя</Text></View><Field label="Логин" dark autoFocus autoCapitalize="none" autoCorrect={false} value={form.email} onChangeText={(email:string)=>{setError("");setForm(current=>({...current,email}))}}/>{error?<Text style={s.authPINError}>{error}</Text>:null}<AuthGlassAction label="Продолжить" icon="arrow-forward" disabled={!form.email.trim()} onPress={()=>{const login=form.email.trim();setForm(current=>({...current,email:login,pin:""}));setPhase("pin")}}/></View></KeyboardAvoidingView>}
        {phase === "pin" && <View style={s.authPINScreen}>
          <View style={s.authPINHeading}><Text style={s.authPINTitle}>Здравствуйте, {rememberedName || form.email}</Text><Text style={s.authPINHint}>Введите свой PIN</Text></View>
          <PinPad value={form.pin} dark onChange={changePIN} loginMode onLogout={forget} disabled={busy} errorNonce={pinErrorNonce}/>
          <View style={s.authPINFeedback}>{busy?<ActivityIndicator color={colors.white}/>:error?<Text accessibilityRole="alert" style={s.authPINError}>{error}</Text>:null}</View>
        </View>}
        {phase === "about" && <View style={s.authAbout}><View style={s.authAboutHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setPhase("welcome")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><Text style={s.authAboutTitle}>О приложении</Text></View><Text style={s.authAboutText}>Lab собирает результаты лабораторных анализов и других обследований в едином профиле здоровья. Можно хранить документы из разных медицинских учреждений, отслеживать динамику показателей и получать первоначальное автоматическое резюме.</Text><Text style={s.authAboutText}>Приложение позволяет добавлять разные виды обследований, включая УЗИ, систематизировать их и получать информационную автоматическую оценку. Через онлайн-поликлинику можно обратиться к врачу за консультацией или выбрать доступное время приёма.</Text><Text style={s.authAboutDisclaimer}>Автоматическая оценка носит информационный характер, не является диагнозом и не заменяет консультацию врача.</Text></View>}
        {phase === "register" && registerStep === "role" && <View style={s.authRegisterSimple}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setPhase("welcome")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><View><Text style={s.authWelcomeTitle}>Кто вы?</Text><Text style={s.authRegisterHint}>Выберите вариант регистрации</Text></View><View style={s.authRoleChoices}><AuthRoleChoice icon="person-outline" title="Пользователь" text="Анализы, динамика и консультации" onPress={()=>{setForm(current=>({...current,role:"patient"}));setRegisterStep("profile")}}/><AuthRoleChoice icon="medkit-outline" title="Врач" text="Приём, пациенты и профессиональный профиль" onPress={()=>{setForm(current=>({...current,role:"doctor"}));setRegisterStep("profile")}}/></View></View>}
        {phase === "register" && registerStep === "profile" && <KeyboardAvoidingView testID="auth-entry-page" style={s.authRegisterKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}><View nativeID="auth-entry-content" style={s.authRegisterSimple}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setRegisterStep("role")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><View><Text style={s.authWelcomeTitle}>{form.role==="doctor"?"Профиль врача":"Создайте профиль"}</Text><Text style={s.authRegisterHint}>ФИО будет видно в приложении, логин нужен для входа</Text></View><Field label={form.role==="doctor"?"ФИО":"Имя"} dark autoFocus value={form.fullName} onChangeText={(fullName:string)=>setForm(current=>({...current,fullName}))}/><Field label="Логин" dark autoCapitalize="none" autoCorrect={false} value={form.email} onChangeText={(email:string)=>setForm(current=>({...current,email}))}/><AuthGlassAction label="Продолжить" icon="arrow-forward" disabled={!profileReady} onPress={()=>setRegisterStep(form.role==="doctor"?"doctor":"details")}/></View></KeyboardAvoidingView>}
        {phase === "register" && registerStep === "details" && <KeyboardAvoidingView testID="auth-entry-page" style={s.authRegisterKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}><View nativeID="auth-entry-content" style={s.authRegisterSimple}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setRegisterStep("profile")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><View><Text style={s.authWelcomeTitle}>О вас</Text><Text style={s.authRegisterHint}>Для персональных материалов о здоровье</Text></View><Field label="Дата рождения" dark autoFocus value={form.birthDate} placeholder="ДД.ММ.ГГГГ" keyboardType="number-pad" maxLength={10} onChangeText={(birthDate:string)=>setForm(current=>({...current,birthDate:formatBirthDate(birthDate)}))}/><View><Text style={s.authFieldLabel}>Пол</Text><View style={s.authGenderRow}>{([['female','Женский'],['male','Мужской']] as const).map(([value,label])=><Pressable key={value} accessibilityRole="button" onPress={()=>setForm(current=>({...current,gender:value}))} style={({pressed})=>[s.authGenderChoice,form.gender===value&&s.authGenderChoiceActive,pressed&&s.glassPressed]}><Text style={[s.authGenderChoiceText,form.gender===value&&s.authGenderChoiceTextActive]}>{label}</Text></Pressable>)}</View></View><AuthGlassAction label="Продолжить" icon="arrow-forward" disabled={!detailsReady} onPress={()=>setRegisterStep("pin")}/></View></KeyboardAvoidingView>}
        {phase === "register" && registerStep === "doctor" && <KeyboardAvoidingView testID="auth-entry-page" style={s.authRegisterKeyboard} behavior={Platform.OS === "ios"?"padding":undefined}><ScrollView contentContainerStyle={s.authDoctorBuilder} keyboardShouldPersistTaps="handled"><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setRegisterStep("profile")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><Text style={s.authWelcomeTitle}>О вашей практике</Text><Text style={s.authRegisterHint}>Профиль можно будет изменить после регистрации</Text><Text style={s.authFieldLabel}>Специальность</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.specialtyScroller}>{doctorSpecialties.map(item=><Choice key={item} active={form.specialization===item} label={item} onPress={()=>setForm(current=>({...current,specialization:item}))}/>)}</ScrollView><Field label="Город" dark value={form.city} onChangeText={(city:string)=>setForm(current=>({...current,city}))}/><Field label="Место работы" dark value={form.workplace} onChangeText={(workplace:string)=>setForm(current=>({...current,workplace}))}/><Field label="О себе" dark multiline numberOfLines={3} value={form.about} onChangeText={(about:string)=>setForm(current=>({...current,about}))}/><Field label="Опыт — один пункт на строку" dark multiline numberOfLines={3} value={form.experience} onChangeText={(experience:string)=>setForm(current=>({...current,experience}))}/><Field label="Услуги — один пункт на строку" dark multiline numberOfLines={3} value={form.services} onChangeText={(services:string)=>setForm(current=>({...current,services}))}/><AuthGlassAction label="Продолжить" icon="arrow-forward" disabled={!detailsReady} onPress={()=>setRegisterStep("pin")}/></ScrollView></KeyboardAvoidingView>}
        {phase === "register" && registerStep === "pin" && <View style={s.authRegisterPIN}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setRegisterStep(form.role==="doctor"?"doctor":"details")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><View><Text style={s.authWelcomeTitle}>Создайте PIN</Text><Text style={s.authRegisterHint}>Четыре цифры для быстрого входа</Text></View><PinPad value={form.pin} dark reveal onChange={changePIN}/>{error?<Text style={s.authPINError}>{error}</Text>:null}<AuthGlassAction label={busy?"Создаём…":"Зарегистрироваться"} disabled={!registrationReady||busy} onPress={()=>void register()}/></View>}
        <Text style={s.authVersionCompact}>Lab · v{APP_VERSION}</Text>
      </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function AuthGlassAction({label,onPress,icon,disabled}:{label:string;onPress:()=>void;icon?:keyof typeof Ionicons.glyphMap;disabled?:boolean}){
  return <Pressable accessibilityRole="button" disabled={disabled} style={({pressed})=>[s.authLoginGlass,disabled&&{opacity:.38},pressed&&!disabled&&s.glassPressed]} onPress={onPress}>{icon&&<Ionicons name={icon} size={19} color={colors.white}/>}<Text style={s.authLoginGlassText}>{label}</Text></Pressable>;
}

function AuthRoleChoice({icon:iconName,title,text,onPress}:{icon:keyof typeof Ionicons.glyphMap;title:string;text:string;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[s.authRoleChoice,pressed&&s.glassPressed]}>
    <View style={s.authRoleIcon}><Ionicons name={iconName} size={28} color={colors.white}/></View>
    <View style={{flex:1}}><Text style={s.authRoleTitle}>{title}</Text><Text style={s.authRoleText}>{text}</Text></View>
    <Ionicons name="chevron-forward" size={22} color="#FFFFFFB5"/>
  </Pressable>;
}

function PinPad({ value, onChange, dark, loginMode=false, reveal=false, onLogout, disabled=false, errorNonce=0 }: { value: string; onChange: (value: string) => void; dark?: boolean; loginMode?: boolean; reveal?: boolean; onLogout?:()=>void; disabled?:boolean; errorNonce?:number }) {
  const keys: Array<number | "logout" | "face" | "empty"> = [1,2,3,4,5,6,7,8,9,loginMode?"logout":"empty",0,"face"];
  const shake=useRef(new Animated.Value(0)).current;
  const valueRef=useRef(value);
  useEffect(()=>{valueRef.current=value},[value]);
  const commit=(next:string)=>{valueRef.current=next;onChange(next)};
  useEffect(()=>{
    if (!errorNonce) return;
    Animated.sequence([-10,9,-7,5,-3,0].map((toValue,index)=>Animated.timing(shake,{toValue,duration:index===5?45:52,useNativeDriver:Platform.OS!=="web"}))).start();
  },[errorNonce,shake]);
  return <View style={s.pinBlock}>
    {reveal ? <View style={s.pinRevealRow}><View accessibilityLabel={`PIN: ${value}`} style={s.pinDigits}>{[0,1,2,3].map(index=><Text key={index} style={s.pinDigit}>{value[index]||"—"}</Text>)}</View><Pressable accessibilityRole="button" accessibilityLabel="Стереть последнюю цифру" disabled={disabled} onPress={()=>commit(valueRef.current.slice(0,-1))} style={s.pinEraseButton}><Ionicons name="backspace-outline" size={31} color={colors.white}/></Pressable></View> : <Animated.View style={{transform:[{translateX:shake}]}}><Pressable accessibilityRole="button" accessibilityLabel="Удалить последнюю цифру" disabled={disabled||!value.length} onPress={()=>commit(valueRef.current.slice(0,-1))} style={s.pinDotsRow}><View accessibilityLabel={`Введено цифр: ${value.length}`} style={s.pinDots}>{[0,1,2,3].map((index)=><PinIndicator key={index} filled={index<value.length} dark={dark}/>)}</View>{value.length>0&&<Ionicons name="backspace-outline" size={22} color="#FFFFFFC8"/>}</Pressable></Animated.View>}
    <View style={s.pinGrid}>{keys.map((key,index)=><PinKey key={`${key}-${index}`} item={key} dark={dark} disabled={disabled||key==="face"||key==="empty"} onPress={()=>{if(key==="logout")onLogout?.();else if(typeof key==="number"&&valueRef.current.length<4)commit(`${valueRef.current}${key}`)}}/>)}</View>
  </View>;
}

function PinIndicator({filled,dark}:{filled:boolean;dark?:boolean}) {
  const scale=useRef(new Animated.Value(filled?1:0.86)).current;
  useEffect(()=>{
    Animated.spring(scale,{toValue:filled?1:0.86,damping:11,stiffness:420,mass:.45,useNativeDriver:Platform.OS!=="web"}).start();
  },[filled,scale]);
  return <Animated.View style={[s.pinDot,dark&&s.pinDotOnDark,filled&&s.pinDotFilled,{transform:[{scale}]}]}/>;
}

function PinKey({item,dark,disabled,onPress}:{item:number|"logout"|"face"|"empty";dark?:boolean;disabled:boolean;onPress:()=>void}) {
  const scale=useRef(new Animated.Value(1)).current;
  const [active,setActive]=useState(false);
  const pressIn=()=>{setActive(true);Animated.timing(scale,{toValue:.965,duration:42,useNativeDriver:Platform.OS!=="web"}).start()};
  const pressOut=()=>{setActive(false);Animated.spring(scale,{toValue:1,damping:15,stiffness:460,mass:.38,useNativeDriver:Platform.OS!=="web"}).start()};
  const label=item==="logout"?"Выйти":item==="face"?"Face ID":item==="empty"?"":String(item);
  const numeric=typeof item==="number";
  return <View style={s.pinKeySlot}><Pressable testID={`pin-key-${label||"empty"}`} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} style={s.pinKeyTouch}>
    <Animated.View pointerEvents="none" style={[s.pinKey,numeric&&dark&&s.pinKeyOnDark,!numeric&&s.pinUtility,disabled&&s.pinUtilityDisabled,active&&numeric&&s.pinKeyPressed,{transform:[{scale}]}]}>
      {numeric?<Text style={[s.pinKeyText,dark&&{color:colors.white}]}>{item}</Text>:item==="face"?<><Ionicons name="scan-outline" size={23} color="#FFFFFF64"/><Text style={s.pinUtilityTextDisabled}>Face ID</Text></>:item==="logout"?<Text style={s.pinUtilityText}>Выйти</Text>:null}
    </Animated.View>
  </Pressable></View>;
}
