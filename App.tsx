import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal as NativeModal,
  Platform,
  Pressable,
  ScrollView as NativeScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { api, API_URL, restoreToken, setToken } from "./src/api";
import { ActivitySurvey, AIChat, Analysis, ClinicalAssistResult, Consultation, Guide, NutritionSurvey, PatientNote, Role, ScheduleSlot, SupportMessage, User } from "./src/types";
import { colors, shadow } from "./src/theme";

type Tab = "home" | "analyses" | "patients" | "consultations" | "doctors" | "ai" | "guides" | "profile";
type Asset = { uri: string; name: string; mimeType?: string; file?: Blob };
const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || "0.9.5";
const LAST_LOGIN_KEY = "lab.last-login";
const LAST_NAME_KEY = "lab.last-name";
const nutritionImages = [require("./assets/nutrition/young.jpg"),require("./assets/nutrition/middle.jpg"),require("./assets/nutrition/senior.jpg")];
type AgeBand = "under20" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s" | "80s";
const activityImages: Record<AgeBand, number[]> = {
  under20: [require("./assets/activity/age/under20-1.jpg"), require("./assets/activity/age/under20-2.jpg")],
  "20s": [require("./assets/activity/age/20s-1.jpg"), require("./assets/activity/age/20s-2.jpg")],
  "30s": [require("./assets/activity/age/30s-1.jpg"), require("./assets/activity/age/30s-2.jpg")],
  "40s": [require("./assets/activity/age/40s-1.jpg"), require("./assets/activity/age/40s-2.jpg")],
  "50s": [require("./assets/activity/age/50s-1.jpg"), require("./assets/activity/age/50s-2.jpg")],
  "60s": [require("./assets/activity/age/60s-1.jpg"), require("./assets/activity/age/60s-2.jpg")],
  "70s": [require("./assets/activity/age/70s-1.jpg"), require("./assets/activity/age/70s-2.jpg")],
  "80s": [require("./assets/activity/age/80s-1.jpg"), require("./assets/activity/age/80s-2.jpg")],
};
const activityBand = (age: number): AgeBand => age < 20 ? "under20" : age < 30 ? "20s" : age < 40 ? "30s" : age < 50 ? "40s" : age < 60 ? "50s" : age < 70 ? "60s" : age < 80 ? "70s" : "80s";
const ScrollView = React.forwardRef<React.ComponentRef<typeof NativeScrollView>, React.ComponentProps<typeof NativeScrollView>>((props, ref) => (
  <NativeScrollView {...props} ref={ref} bounces={false} alwaysBounceVertical={false} />
));
function Modal(props: React.ComponentProps<typeof NativeModal>) {
  if (!props.visible) return null;
  if (Platform.OS === "web") return <View style={s.webModalRoot}>{props.children}</View>;
  return <NativeModal {...props} />;
}
function SystemChrome({ dark, background, canvas = background }: { dark: boolean; background: string; canvas?: string }) {
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
    document.documentElement.style.background = canvas;
    document.body.style.background = canvas;
  }, [background, canvas]);
  return <StatusBar style={dark ? "light" : "dark"} translucent backgroundColor="transparent" />;
}
const icon: Record<Tab, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  analyses: "flask-outline",
  patients: "people-outline",
  consultations: "chatbubbles-outline",
  doctors: "calendar-outline",
  ai: "sparkles-outline",
  guides: "library-outline",
  profile: "person-outline",
};
const labels: Record<Tab, string> = {
  home: "Главная",
  analyses: "Анализы",
  patients: "Пациенты",
  consultations: "Визиты",
  doctors: "Запись",
  ai: "AI",
  guides: "Guides",
  profile: "Профиль",
};
const tabsFor = (role: Role): Tab[] => role === "doctor"
  ? ["home", "patients", "ai", "guides", "profile"]
  : ["home", "analyses", "consultations", "doctors", "profile"];

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

function AppContent() {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [upload, setUpload] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [focusVisit, setFocusVisit] = useState<Consultation | null>(null);
  const [focusDoctorID, setFocusDoctorID] = useState("");
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const compact = width < 640;
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.getElementById("root");
    const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (viewport) viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    Object.assign(document.documentElement.style, { width: "100%", height: "100%", overflow: "hidden", overscrollBehavior: "none" });
    Object.assign(document.body.style, { width: "100%", height: "100%", margin: "0", overflow: "hidden", position: "fixed", inset: "0", overscrollBehavior: "none" });
    if (root) Object.assign(root.style, { width: "100%", height: "100%", overflow: "hidden" });
  }, []);
  async function refresh(u = user) {
    if (!u) return;
    const [analysesResult, consultationsResult] = await Promise.allSettled([api.analyses(), api.consultations()]);
    if (analysesResult.status === "fulfilled") setAnalyses(analysesResult.value);
    if (consultationsResult.status === "fulfilled") setConsultations(consultationsResult.value);
    if (analysesResult.status === "rejected" || consultationsResult.status === "rejected") {
      throw new Error("Не все данные удалось обновить. Проверьте соединение и повторите попытку.");
    }
  }
  function requestDelete(item: Analysis) {
    const remove = async () => {
      try {
        await api.deleteAnalysis(item.id);
        if (selected?.id === item.id) setSelected(null);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить анализ");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Удалить «${item.title}» вместе с исходным файлом?`)) void remove();
      return;
    }
    Alert.alert(
      "Удалить анализ?",
      "Карточка и загруженный исходный файл будут удалены без возможности восстановления.",
      [
        { text: "Отмена", style: "cancel" },
        { text: "Удалить", style: "destructive", onPress: () => void remove() },
      ],
    );
  }
  useEffect(() => {
    (async () => {
      const minimumSplash = new Promise((resolve) => setTimeout(resolve, 900));
      try {
        if (await restoreToken()) {
          const u = await api.me();
          setUser(u);
          await refresh(u);
        }
      } catch {
        await setToken("");
      } finally {
        await minimumSplash;
        setBoot(false);
      }
    })();
  }, []);
  if (boot) return <Loading />;
  if (!user)
    return (
      <Auth
        onDone={async (u, t) => {
          await setToken(t);
          setUser(u);
          setTab("home");
          try {
            await refresh(u);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось обновить данные");
          }
        }}
      />
    );
  const content =
    tab === "home" ? (
      <Home
        compact={compact}
        user={user}
        analyses={analyses}
        consultations={consultations}
        onOpen={setSelected}
        onTab={setTab}
        onUser={setUser}
        onOpenVisit={(visit) => { setFocusVisit(visit); setTab("consultations"); }}
        onOpenDoctor={(doctorID) => { setFocusDoctorID(doctorID); setTab("doctors"); }}
      />
    ) : tab === "analyses" ? (
      <Analyses
        compact={compact}
        data={analyses}
        doctor={user.role === "doctor"}
        onOpen={setSelected}
        onDelete={user.role === "patient" ? requestDelete : undefined}
        onUpload={() => setUpload({ uri: "", name: "" })}
      />
    ) : tab === "patients" ? (
      <DoctorPatients patientsAnalyses={analyses} consultations={consultations} onOpen={setSelected} onRefresh={() => refresh()} />
    ) : tab === "consultations" ? (
      <Consultations
        data={consultations}
        user={user}
        onRefresh={() => refresh()}
        initialSelected={focusVisit}
        onTargetHandled={() => setFocusVisit(null)}
        onTargetBack={() => setTab("home")}
      />
    ) : tab === "doctors" ? (
      <DoctorsScreen user={user} onRefresh={() => refresh()} initialDoctorID={focusDoctorID} onTargetHandled={() => setFocusDoctorID("")} onTargetBack={() => setTab("home")} />
    ) : tab === "ai" ? (
      <AIWorkspace />
    ) : tab === "guides" ? (
      <Guides />
    ) : user.role === "patient" ? (
      <SupportChat compact={compact} onBack={() => setTab("home")} />
    ) : (
      <Profile
        user={user}
        onUpdated={setUser}
      />
    );
  const immersiveHeader = tab === "home";
  const screenBackground = colors.paper;
  const chromeColors: readonly [string, string, ...string[]] = immersiveHeader
    ? ["#17214B", "#3C3A86", "#147D83"]
    : [screenBackground, screenBackground];
  const chromeBackground = immersiveHeader ? "#17214B" : screenBackground;
  return (
    <LinearGradient colors={chromeColors} start={{x:0,y:0}} end={{x:1,y:1}} style={s.safe}>
      <SystemChrome dark={immersiveHeader} background={chromeBackground} canvas={screenBackground} />
      <SafeAreaView edges={["top"]} style={s.safeInner}>
      <View style={s.shell}>
        {desktop && <Sidebar user={user} tab={tab} onTab={setTab} />}
        <View style={s.main}>
          {error ? <Banner text={error} onClose={() => setError("")} /> : null}
          <View style={s.content}>{content}</View>
          {!desktop && <Bottom role={user.role} tab={tab} onTab={setTab} />}
        </View>
      </View>
      <UploadModal
        visible={!!upload}
        seed={upload}
        onClose={() => setUpload(null)}
        onDone={async (result) => {
          setUpload(null);
          setTab("analyses");
          setSelected(result);
          try {
            await refresh();
          } catch {
            setError("Результат распознан, но список анализов не обновился.");
          }
        }}
      />
      <Detail
        item={selected}
        user={user}
        onClose={() => setSelected(null)}
        onChanged={async () => {
          setSelected(null);
          await refresh();
        }}
        onError={setError}
      />
      </SafeAreaView>
    </LinearGradient>
  );
}

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
}

function ageFromBirthDate(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > new Date()) return 0;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age >= 0 && age <= 120 ? age : 0;
}

function Auth({ onDone }: { onDone: (u: User, t: string) => void }) {
  const [remembered, setRemembered] = useState(() => Platform.OS === "web" && typeof localStorage !== "undefined" ? localStorage.getItem(LAST_LOGIN_KEY) || "" : "");
  const [rememberedName, setRememberedName] = useState(() => Platform.OS === "web" && typeof localStorage !== "undefined" ? localStorage.getItem(LAST_NAME_KEY) || "" : "");
  const [phase, setPhase] = useState<"welcome" | "pin" | "register" | "about">("welcome");
  const [registerStep, setRegisterStep] = useState<"profile" | "pin">("profile");
  const [form, setForm] = useState({
    email: Platform.OS === "web" && typeof localStorage !== "undefined" ? localStorage.getItem(LAST_LOGIN_KEY) || "" : "",
    pin: "",
    fullName: "",
    specialization: "",
    licenseNumber: "",
    birthDate: "",
    heightCM: "",
    weightKG: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const age = ageFromBirthDate(form.birthDate);
  const profileReady = age > 0 && Number(form.heightCM) > 0 && Number(form.weightKG) > 0;
  const registrationReady = /^\d{4}$/.test(form.pin) && age > 0 && Number(form.heightCM) > 0 && Number(form.weightKG) > 0;
  function remember(user: User) {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
    localStorage.setItem(LAST_LOGIN_KEY, user.email);
    localStorage.setItem(LAST_NAME_KEY, user.role === "doctor" ? "Марат" : firstName(user.full_name));
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
      setForm((current) => ({ ...current, pin: "" }));
    } finally {
      setBusy(false);
    }
  }
  function changePIN(pin: string) {
    setForm((current) => ({ ...current, pin }));
    setError("");
    if (phase === "pin" && pin.length === 4) setTimeout(() => void login(pin), 0);
  }
  async function register() {
    if (!registrationReady || busy) return;
    setBusy(true);
    setError("");
    try {
      const internalLogin = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const r = await api.register({ ...form, email: internalLogin, role: "patient", age, heightCM: Number(form.heightCM), weightKG: Number(form.weightKG) });
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
      localStorage.removeItem(LAST_LOGIN_KEY);
      localStorage.removeItem(LAST_NAME_KEY);
    }
    setRemembered("");
    setRememberedName("");
    setForm((current) => ({ ...current, email: "", pin: "" }));
    setPhase("welcome");
    setError("");
  }
  const backdrop = <><View style={s.authOrbOne}/><View style={s.authOrbTwo}/><View style={[s.authLabSheet,s.authLabSheetOne]}><Ionicons name="document-text-outline" size={25} color="#B9C6FF"/><View><View style={s.authLabLine}/><View style={[s.authLabLine,{width:46}]}/><View style={[s.authLabLine,{width:30}]}/></View></View><View style={[s.authLabSheet,s.authLabSheetTwo]}><Ionicons name="flask-outline" size={25} color="#7DE0D5"/><View><View style={s.authLabLine}/><View style={[s.authLabLine,{width:38}]}/></View></View></>;
  return (
    <LinearGradient colors={["#17214B","#3D367A","#146E78"]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.authOuter}>
      <SystemChrome dark background="#17214B" canvas="#146E78"/>
      <SafeAreaView edges={["top","right","bottom","left"]} style={s.authScreen}>
        {backdrop}
        {phase === "welcome" && <View style={s.authWelcome}>
          <View style={s.authWelcomeCopy}><Text style={s.authWelcomeTitle}>{rememberedName ? `Здравствуйте, ${rememberedName}` : "Добро пожаловать"}</Text><Text style={s.authWelcomeSlogan}>{remembered ? "Ваше здоровье под контролем" : "Все результаты здоровья — в одном месте"}</Text></View>
          <View style={s.authWelcomeActions}>{remembered ? <><Pressable accessibilityRole="button" style={({pressed})=>[s.authLoginGlass,pressed&&{transform:[{scale:.98}],opacity:.7}]} onPress={()=>{setPhase("pin");setForm(current=>({...current,pin:""}));}}><Text style={s.authLoginGlassText}>Войти</Text></Pressable><Pressable accessibilityRole="button" style={({pressed})=>[s.authSwitchUser,pressed&&{opacity:.6}]} onPress={switchUser}><Text style={s.authSwitchUserText}>Сменить пользователя</Text></Pressable></> : <><Button label="Зарегистрироваться" icon="person-add-outline" onPress={()=>{setRegisterStep("profile");setPhase("register");}}/><Pressable accessibilityRole="button" style={s.authSecondaryButton} onPress={()=>setPhase("about")}><Text style={s.authSecondaryText}>О приложении</Text></Pressable><Pressable accessibilityRole="button" style={s.authExistingButton} onPress={()=>{setForm(current=>({...current,email:"marat",pin:""}));setRememberedName("Марат");setPhase("pin");}}><Text style={s.authExistingText}>Вход для врача</Text></Pressable></>}</View>
        </View>}
        {phase === "pin" && <View style={s.authPINScreen}>
          <PinPad value={form.pin} dark onChange={changePIN} loginMode onLogout={forget}/>
          {busy&&<ActivityIndicator color={colors.white}/>} {error?<Text style={s.authPINError}>{error}</Text>:null}
        </View>}
        {phase === "about" && <View style={s.authAbout}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setPhase("welcome")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><Text style={s.authWelcomeTitle}>Lab HEALTH</Text><Text style={s.authAboutText}>Собирает лабораторные исследования в одном месте, выделяет показатели и помогает следить за их динамикой. Автоматическая оценка не заменяет врача.</Text></View>}
        {phase === "register" && registerStep === "profile" && <ScrollView style={s.authRegisterScroll} contentContainerStyle={s.authRegisterBody} keyboardShouldPersistTaps="handled"><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setPhase("welcome")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><Text style={s.authWelcomeTitle}>Регистрация</Text><Text style={s.authRegisterHint}>Создайте профиль пользователя</Text><Field label="Имя" dark value={form.fullName} onChangeText={(fullName:string)=>setForm(current=>({...current,fullName}))}/><Field label="Дата рождения" dark keyboardType="number-pad" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={form.birthDate} onChangeText={(birthDate:string)=>setForm(current=>({...current,birthDate:formatBirthDate(birthDate)}))}/><View style={s.registrationVitals}><Field label="Рост, см" dark keyboardType="decimal-pad" value={form.heightCM} onChangeText={(heightCM:string)=>setForm(current=>({...current,heightCM}))}/><Field label="Вес, кг" dark keyboardType="decimal-pad" value={form.weightKG} onChangeText={(weightKG:string)=>setForm(current=>({...current,weightKG}))}/></View><Button label="Продолжить" icon="arrow-forward" disabled={!profileReady} onPress={()=>setRegisterStep("pin")}/></ScrollView>}
        {phase === "register" && registerStep === "pin" && <View style={s.authRegisterPIN}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.authBack} onPress={()=>setRegisterStep("profile")}><Ionicons name="arrow-back" size={26} color={colors.white}/></Pressable><View><Text style={s.authWelcomeTitle}>Создайте PIN</Text><Text style={s.authRegisterHint}>Четыре цифры для быстрого входа</Text></View><PinPad value={form.pin} dark reveal onChange={changePIN}/>{error?<Text style={s.authPINError}>{error}</Text>:null}<Button label={busy?"Создаём…":"Зарегистрироваться"} disabled={!registrationReady||busy} onPress={()=>void register()}/></View>}
        <Text style={s.authVersionCompact}>LAB HEALTH · v{APP_VERSION}</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PinPad({ value, onChange, dark, loginMode=false, reveal=false, onLogout }: { value: string; onChange: (value: string) => void; dark?: boolean; loginMode?: boolean; reveal?: boolean; onLogout?:()=>void }) {
  const keys: Array<number | "logout" | "face" | "empty"> = [1,2,3,4,5,6,7,8,9,loginMode?"logout":"empty",0,"face"];
  return <View style={s.pinBlock}>
    {reveal ? <View style={s.pinRevealRow}><View accessibilityLabel={`PIN: ${value}`} style={s.pinDigits}>{[0,1,2,3].map(index=><Text key={index} style={s.pinDigit}>{value[index]||"—"}</Text>)}</View><Pressable accessibilityRole="button" accessibilityLabel="Стереть последнюю цифру" onPress={()=>onChange(value.slice(0,-1))} style={s.pinEraseButton}><Ionicons name="backspace-outline" size={31} color={colors.white}/></Pressable></View> : <Pressable accessibilityRole="button" accessibilityLabel="Удалить последнюю цифру" onPress={()=>onChange(value.slice(0,-1))} style={s.pinDotsRow}><View accessibilityLabel={`Введено цифр: ${value.length}`} style={s.pinDots}>{[0,1,2,3].map((index)=><View key={index} style={[s.pinDot,dark&&s.pinDotOnDark,index<value.length&&s.pinDotFilled]}/>)}</View>{value.length>0&&<Ionicons name="backspace-outline" size={21} color="#FFFFFFB5"/>}</Pressable>}
    <View style={s.pinGrid}>{keys.map((key,index)=>{const disabled=key==="face"||key==="empty";const label=key==="logout"?"Выйти":key==="face"?"Face ID":key==="empty"?"":String(key);return <Pressable key={`${key}-${index}`} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({pressed})=>[s.pinKey,dark&&typeof key==="number"&&s.pinKeyOnDark,typeof key!=="number"&&s.pinUtility,disabled&&s.pinUtilityDisabled,pressed&&{opacity:.55}]} onPress={()=>key==="logout"?onLogout?.():typeof key==="number"&&value.length<4&&onChange(`${value}${key}`)}>{typeof key==="number"?<Text style={[s.pinKeyText,dark&&{color:colors.white}]}>{key}</Text>:key==="face"?<><Ionicons name="scan-outline" size={23} color="#FFFFFF64"/><Text style={s.pinUtilityTextDisabled}>Face ID</Text></>:key==="logout"?<Text style={s.pinUtilityText}>Выйти</Text>:null}</Pressable>})}</View>
  </View>;
}

function Home({
  compact,
  user,
  analyses,
  consultations,
  onOpen,
  onTab,
  onUser,
  onOpenVisit,
  onOpenDoctor,
}: {
  compact: boolean;
  user: User;
  analyses: Analysis[];
  consultations: Consultation[];
  onOpen: (a: Analysis) => void;
  onTab: (t: Tab) => void;
  onUser: (u: User) => void;
  onOpenVisit: (visit: Consultation) => void;
  onOpenDoctor: (doctorID: string) => void;
}) {
  const [wellness, setWellness] = useState<"activity" | "nutrition" | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const age = user.patient_profile?.age || 35;
  const ageTone = age < 40 ? "young" : age < 65 ? "middle" : "senior";
  const ageGroup = activityBand(age);
  const latest = analyses[0];
  const latestNeedsAttention = !!latest && (latest.ai_review?.doctor_needed || latest.markers.some((marker) => marker.status === "high" || marker.status === "low"));
  const upcoming = consultations.filter((item) => item.service_type === "appointment" && item.appointment_at && new Date(item.appointment_at) > new Date()).sort((a, b) => (a.appointment_at || "").localeCompare(b.appointment_at || ""))[0];
  const answered = consultations.find((item) => item.status === "answered" && item.reply);
  if (user.role === "doctor") {
    return <DoctorSchedule user={user} compact={compact} />;
  }
  return (
    <View style={[s.patientHome, compact && s.patientHomeCompact]}>
      <View style={[s.patientWelcome, compact && s.patientWelcomeCompact]}>
        <View style={s.welcomeIdentity}>
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть профиль" hitSlop={10} onPress={() => setProfileOpen(true)} style={s.profileGlyph}>
            <Ionicons name="person-outline" size={30} color={colors.white} />
          </Pressable>
          <Text style={[s.welcomeTitle, compact && s.welcomeTitleCompact]}>
            Здравствуйте, {firstName(user.full_name)}
          </Text>
        </View>
        <View style={s.homeUpdates}>
          <Pressable onPress={() => onTab("analyses")} style={[s.homeUpdateMain, s.homeUpdateOnGradient, latestNeedsAttention && s.homeUpdateAlert]}>
            <View style={[s.homeUpdateIcon, latestNeedsAttention && s.homeUpdateIconAlert]}><Ionicons name={latestNeedsAttention ? "alert-circle-outline" : "heart-outline"} size={20} color={latestNeedsAttention ? colors.coral : colors.aqua}/></View>
            <View style={{flex:1}}><Text style={s.homeUpdateTitle}>{!latest ? "Добавьте первый анализ" : latestNeedsAttention ? "Обратите внимание на последние анализы" : "Ваши последние показатели выглядят хорошо"}</Text><Text numberOfLines={1} style={s.homeUpdateText}>{!latest ? "Соберите историю здоровья в одном месте" : latestNeedsAttention ? "Откройте информацию о состоянии и рекомендации" : "Так держать — продолжайте заботиться о себе"}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
          </Pressable>
          {(upcoming || answered) && <View style={s.homeReminderList}>
            {upcoming && <Pressable onPress={() => upcoming.doctor_id ? onOpenDoctor(upcoming.doctor_id) : onOpenVisit(upcoming)} style={s.homeReminder}><Ionicons name="calendar-outline" size={21} color={colors.violet}/><View style={{flex:1}}><Text style={s.homeReminderLabel}>Приём</Text><Text numberOfLines={1} style={s.homeReminderText}>{new Date(upcoming.appointment_at!).toLocaleString("ru-RU", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</Text></View></Pressable>}
            {answered && <Pressable onPress={() => onOpenVisit(answered)} style={s.homeReminder}><Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.aqua}/><View style={{flex:1}}><Text style={s.homeReminderLabel}>Ответ врача</Text><Text numberOfLines={1} style={s.homeReminderText}>Открыть переписку</Text></View></Pressable>}
          </View>}
        </View>
      </View>
      <View style={[s.homeDiscovery, compact && s.homeDiscoveryCompact]}>
        <WellnessPhotoCard ageBand={ageGroup} onPress={() => setWellness("activity")} />
        <NutritionMediaCard ageTone={ageTone} onPress={() => setWellness("nutrition")} />
      </View>
      <WellnessModal kind={wellness} user={user} analyses={analyses} onClose={() => setWellness(null)} onUser={onUser} />
      <PatientProfileModal visible={profileOpen} user={user} onUpdated={onUser} onClose={() => setProfileOpen(false)} />
    </View>
  );
}

function PatientProfileModal({ visible, user, onUpdated, onClose }: { visible: boolean; user: User; onUpdated: (user: User) => void; onClose: () => void }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.fullScreenModal}>
      <View style={s.profileHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.profileBack} onPress={onClose}><Ionicons name="arrow-back" size={27}/></Pressable>
        <Text style={s.fullScreenTitle}>Профиль</Text><View style={s.headerSpacer}/>
      </View>
      <Profile user={user} onUpdated={onUpdated} />
    </SafeAreaView>
  </Modal>;
}

function WellnessPhotoCard({ ageBand, onPress }: { ageBand: AgeBand; onPress: () => void }) {
  const images = activityImages[ageBand];
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    setIndex(0);
    const rotate = () => Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
      setIndex((value) => (value + 1) % images.length);
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true }).start();
    });
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { rotate(); timer = setTimeout(tick, 12000); };
    timer = setTimeout(tick, 6000);
    return () => { clearTimeout(timer); opacity.stopAnimation(); };
  }, [ageBand, images.length, opacity]);
  const source = images[index] || images[0]!;
  const copy: Record<AgeBand, [string, string]> = {
    under20: ["Движение в радость", "Игры, велосипед и командный спорт"],
    "20s": ["Энергия каждый день", "Бег, тренировки и активный отдых"],
    "30s": ["Активность в ритме жизни", "Велосипед, фитнес и прогулки"],
    "40s": ["Сила и подвижность", "Походы, йога и регулярное движение"],
    "50s": ["Движение каждый день", "Ходьба, вода и умеренные нагрузки"],
    "60s": ["Активное долголетие", "Прогулки и гимнастика на свежем воздухе"],
    "70s": ["Уверенное движение", "Баланс, прогулки и мягкая нагрузка"],
    "80s": ["Бережная активность", "Спокойные прогулки и лёгкие движения"],
  };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.homeMediaCard, pressed && { opacity: 0.88 }]}>
      <Animated.Image source={source} style={[s.homeMediaImage as any, { opacity }]} />
      <LinearGradient colors={["#10182ACC", "#10182A1A"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={s.videoOverlay}>
        <View style={{ flex: 1 }}><Text style={s.videoEyebrow}>АКТИВНЫЙ ОБРАЗ ЖИЗНИ</Text><Text style={s.videoTitle}>{copy[ageBand][0]}</Text><Text style={s.videoSubtitle}>{copy[ageBand][1]}</Text></View>
        <View style={s.videoArrow}><Ionicons name="arrow-forward" size={24} color={colors.white} /></View>
      </LinearGradient>
    </Pressable>
  );
}

function NutritionMediaCard({ ageTone, onPress }: { ageTone: "young" | "middle" | "senior"; onPress: () => void }) {
  const base = ageTone === "young" ? 0 : ageTone === "middle" ? 1 : 2;
  const [offset, setOffset] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const rotate = () => Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
      setOffset((value) => (value + 1) % 3);
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true }).start();
    });
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { rotate(); timer = setTimeout(tick, 12000); };
    timer = setTimeout(tick, 12000);
    return () => { clearTimeout(timer); opacity.stopAnimation(); };
  }, [opacity]);
  const image = nutritionImages[(base + offset) % 3];
  const subtitle = ageTone === "young" ? "Энергия, белок и регулярный режим" : ageTone === "middle" ? "Баланс, клетчатка и разумные порции" : "Простая питательная еда и достаточное питьё";
  return <Pressable onPress={onPress} style={({pressed})=>[s.homeMediaCard,pressed&&{opacity:.86}]}><Animated.Image source={image} style={[s.homeMediaImage as any,{opacity}]}/><LinearGradient colors={["#111827CC","#11182712"]} start={{x:0,y:1}} end={{x:1,y:0}} style={s.videoOverlay}><View style={{flex:1}}><Text style={s.videoEyebrow}>ПРАВИЛЬНОЕ ПИТАНИЕ</Text><Text style={s.videoTitle}>Еда для здоровья</Text><Text style={s.videoSubtitle}>{subtitle}</Text></View><View style={s.videoArrow}><Ionicons name="arrow-forward" size={24} color={colors.white}/></View></LinearGradient></Pressable>;
}

function FoodPart({ icon: foodIcon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; color: string }) {
  return <View style={s.foodPart}><Ionicons name={foodIcon} size={22} color={color} /><Text style={[s.foodValue, { color }]}>{value}</Text><Text style={s.foodLabel}>{label}</Text></View>;
}

function WellnessModal({ kind, user, analyses, onClose, onUser }: { kind: "activity" | "nutrition" | null; user: User; analyses: Analysis[]; onClose: () => void; onUser: (u: User) => void }) {
  const profile = user.patient_profile;
  const [activity, setActivity] = useState<ActivitySurvey>(profile?.activity || { regular_sport: false });
  const [nutrition, setNutrition] = useState<NutritionSurvey>(profile?.nutrition || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setActivity(profile?.activity || { regular_sport: false });
    setNutrition(profile?.nutrition || {});
  }, [kind, profile]);
  if (!kind) return null;
  const recommendation = kind === "activity" ? profile?.activity_recommendation : profile?.nutrition_recommendation;
  async function submit() {
    if (!profile) { setError("Сначала заполните возраст, рост и вес в профиле."); return; }
    setBusy(true); setError("");
    try {
      const result = await api.recommendation(kind!, kind === "activity" ? { activity } : { nutrition });
      onUser(result.user);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось получить рекомендацию"); }
    finally { setBusy(false); }
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.fullScreenModal}>
        <View style={s.fullScreenHeader}><Pressable style={s.iconButton} onPress={onClose}><Ionicons name="arrow-back" size={25} color={colors.ink} /></Pressable><Text style={s.fullScreenTitle}>{kind === "activity" ? "Активный образ жизни" : "Правильное питание"}</Text><View style={s.iconButton}/></View>
        <ScrollView contentContainerStyle={s.wellnessBody} keyboardShouldPersistTaps="handled">
          <View style={s.profileInsight}><Ionicons name="person-circle-outline" size={24} color={colors.brand} /><Text style={s.body}>{profile ? `${profile.age} лет · ИМТ ${profile.bmi} · учтены ${analyses.length} исследований` : "Для персонализации заполните профиль"}</Text></View>
          <Text style={s.surveyTitle}>Короткий опрос</Text>
          {kind === "activity" ? <>
            <Text style={s.label}>Есть регулярный спорт?</Text><View style={s.choiceRow}><Choice active={activity.regular_sport} label="Да" onPress={() => setActivity({ ...activity, regular_sport: true })} /><Choice active={!activity.regular_sport} label="Нет" onPress={() => setActivity({ ...activity, regular_sport: false })} /></View>
            <Field label="Какой вид активности?" placeholder="Ходьба, плавание, зал…" value={activity.sport_type || ""} onChangeText={(value: string) => setActivity({ ...activity, sport_type: value })} />
            <Field label="Работа или основная занятость" placeholder="Работаю, учусь, не работаю…" value={activity.employment || ""} onChangeText={(value: string) => setActivity({ ...activity, employment: value })} />
            <Text style={s.label}>Характер занятости</Text><View style={s.choiceRow}><Choice active={activity.work_activity === "sedentary"} label="Сидячая" onPress={() => setActivity({ ...activity, work_activity: "sedentary" })} /><Choice active={activity.work_activity === "mixed"} label="Смешанная" onPress={() => setActivity({ ...activity, work_activity: "mixed" })} /><Choice active={activity.work_activity === "physical"} label="Физическая" onPress={() => setActivity({ ...activity, work_activity: "physical" })} /></View>
            <Field label="Минут активности в неделю" keyboardType="number-pad" placeholder="150" value={activity.weekly_minutes ? String(activity.weekly_minutes) : ""} onChangeText={(value: string) => setActivity({ ...activity, weekly_minutes: Number(value) })} />
          </> : <>
            <SurveyScale label="Жирная и жареная пища" value={nutrition.fatty_food} onChange={(value) => setNutrition({ ...nutrition, fatty_food: value })} />
            <SurveyScale label="Сладкое и быстрые углеводы" value={nutrition.fast_carbs} onChange={(value) => setNutrition({ ...nutrition, fast_carbs: value })} />
            <SurveyScale label="Овощи и фрукты" value={nutrition.vegetables} onChange={(value) => setNutrition({ ...nutrition, vegetables: value })} positive />
            <SurveyScale label="Регулярность питания" value={nutrition.meal_regularity} onChange={(value) => setNutrition({ ...nutrition, meal_regularity: value })} positive />
          </>}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button label={busy ? "Формируем…" : "Получить рекомендацию ИИ"} disabled={busy} icon="sparkles-outline" onPress={() => void submit()} />
          {recommendation ? <View style={s.aiRecommendation}><View style={s.aiRecommendationHead}><Ionicons name="sparkles" size={21} color={colors.violet} /><Text style={s.reviewTitle}>Персональная рекомендация</Text></View><Text style={s.body}>{recommendation}</Text><Text style={s.aiDisclaimer}>Информация носит образовательный характер и не заменяет врача.</Text></View> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.choice, active && s.choiceActive]}><Text style={[s.choiceText, active && s.choiceTextActive]}>{label}</Text></Pressable>;
}
function SurveyScale({ label, value, onChange, positive = false }: { label: string; value?: string; onChange: (value: string) => void; positive?: boolean }) {
  return <View style={s.surveyScale}><Text style={s.label}>{label}</Text><View style={s.choiceRow}>{["rare", "sometimes", "often"].map((option, index) => <Choice key={option} active={value === option} label={(positive ? ["Редко", "Иногда", "Ежедневно"][index] : ["Редко", "Иногда", "Часто"][index]) || option} onPress={() => onChange(option)} />)}</View></View>;
}
function Analyses({
  compact,
  data,
  doctor,
  onOpen,
  onDelete,
  onUpload,
}: {
  compact: boolean;
  data: Analysis[];
  doctor: boolean;
  onOpen: (a: Analysis) => void;
  onDelete?: (a: Analysis) => void;
  onUpload: () => void;
}) {
  const [mode, setMode] = useState<"research" | "dynamics">("research");
  const [marker, setMarker] = useState("");
  const [dynamicQuery, setDynamicQuery] = useState("");
  const [infoOpen,setInfoOpen]=useState(false);
  const groups = useMemo(() => {
    const grouped = new Map<string, Analysis[]>();
    data.forEach((analysis) => {
      const key = analysis.category || analysis.title || "Лабораторные исследования";
      grouped.set(key, [...(grouped.get(key) || []), analysis]);
    });
    return Array.from(grouped.entries());
  }, [data]);
  const markerSeries = useMemo(() => {
    const result = new Map<string, Array<{ date: string; value: number; unit: string; status: string; reference: string }>>();
    data.forEach((analysis) => analysis.markers.forEach((item) => {
      if (item.value === undefined) return;
      const reference = item.reference_text || [item.reference_min, item.reference_max].filter((value) => value !== undefined).join(" — ") || "—";
      result.set(item.name, [...(result.get(item.name) || []), { date: analysis.created_at, value: item.value, unit: item.unit || "", status: item.status, reference }]);
    }));
    result.forEach((points) => points.sort((a,b) => a.date.localeCompare(b.date)));
    return result;
  }, [data]);
  const dynamicEntries = useMemo(() => Array.from(markerSeries.entries()).map(([name, points]) => ({ name, points, latest: points[points.length - 1]! })).filter((entry) => entry.name.toLocaleLowerCase("ru-RU").includes(dynamicQuery.trim().toLocaleLowerCase("ru-RU"))).sort((a,b) => a.name.localeCompare(b.name,"ru-RU")), [markerSeries, dynamicQuery]);
  const series = marker ? markerSeries.get(marker) || [] : [];
  const overall = data.find((analysis) => analysis.ai_review?.doctor_needed)?.ai_review || data[0]?.ai_review;
  return (
    <View style={s.analysisPage}>
    <ScrollView contentContainerStyle={[s.scroll, s.analysisScrollContent, compact && s.scrollCompact]}>
      {!doctor ? <Pressable disabled={!overall} onPress={()=>setInfoOpen(true)} style={[s.healthInfoButton,overall?.doctor_needed&&s.healthSummaryAlert]}><View style={s.healthSummaryHead}><Ionicons name={overall?.doctor_needed?"medical-outline":"sparkles-outline"} size={22} color={overall?.doctor_needed?colors.coral:colors.violet}/><View style={{flex:1}}><Text style={s.reviewTitle}>Информация о вашем состоянии</Text><Text style={s.analysisMeta}>{overall ? "Сводка по результатам и динамике показателей" : "Появится после первого распознавания"}</Text></View>{overall && <Ionicons name="chevron-forward" size={21} color={colors.muted}/>}</View></Pressable>:null}
      {!doctor && <View style={s.segment}><Segment active={mode === "research"} label="Исследования" icon="documents-outline" onPress={() => setMode("research")} /><Segment active={mode === "dynamics"} label="Динамика" icon="stats-chart-outline" onPress={() => setMode("dynamics")} /></View>}
      {data.length && (doctor || mode === "research") ? (
        <View style={s.analysisGroups}>{groups.map(([group, items]) => <View key={group} style={s.analysisGroup}><View style={s.groupTitleRow}><Text style={s.groupTitle}>{group}</Text><Text style={s.groupCount}>{items.length}</Text></View><View style={s.compactCardGrid}>{items.map((analysis) => <AnalysisCard key={analysis.id} item={analysis} onPress={() => onOpen(analysis)} onDelete={onDelete ? () => onDelete(analysis) : undefined} />)}</View></View>)}</View>
      ) : data.length && mode === "dynamics" ? (
        <View style={s.dynamicsScreen}>
          <Text style={s.dynamicHistoryTitle}>Выберите показатель</Text>
          <View style={s.doctorSearch}><Ionicons name="search" size={20} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={dynamicQuery} onChangeText={setDynamicQuery} placeholder="Например, креатинин"/></View>
          <View style={s.dynamicCards}>{dynamicEntries.map((entry) => <DynamicMarkerCard key={entry.name} name={entry.name} points={entry.points} onPress={() => setMarker(entry.name)}/>)}</View>
          {!dynamicEntries.length && <Empty icon="stats-chart-outline" title="Показатель не найден" text="Измените запрос или загрузите исследование с этим показателем."/>}
        </View>
      ) : (
        <Empty
          icon="documents-outline"
          title="Здесь появится история"
          text="Поддерживаются фотографии, изображения из галереи и PDF."
        />
      )}
      <Modal visible={infoOpen} animationType="slide" onRequestClose={()=>setInfoOpen(false)}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={()=>setInfoOpen(false)}><Ionicons name="arrow-back" size={25}/></Pressable><Text style={s.fullScreenTitle}>Ваше состояние</Text><View style={s.iconButton}/></View><ScrollView contentContainerStyle={s.fullScreenBody}>{data.map((analysis)=><View key={analysis.id} style={s.aiRecommendation}><View style={s.rowBetween}><Text style={s.reviewTitle}>{analysis.title}</Text><Text style={s.analysisMeta}>{date(analysis.created_at)}</Text></View><Text style={s.body}>{analysis.ai_review?.summary||"Автоматическая сводка отсутствует."}</Text>{analysis.ai_review?.lifestyle?.map((x,i)=><Text key={`l-${i}`} style={s.body}>• {x}</Text>)}{analysis.ai_review?.nutrition?.map((x,i)=><Text key={`n-${i}`} style={s.body}>• {x}</Text>)}{analysis.ai_review?.suggested_specialty?<Text style={s.specialtyLine}>Обсудить со специалистом: {analysis.ai_review.suggested_specialty}</Text>:null}</View>)}<Text style={s.aiDisclaimer}>Информация сформирована автоматически по распознанным данным и не является диагнозом. Сверяйте значения с оригинальными бланками.</Text></ScrollView></SafeAreaView></Modal>
      <Modal visible={!!marker} animationType="slide" onRequestClose={()=>setMarker("")}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={()=>setMarker("")}><Ionicons name="arrow-back" size={25}/></Pressable><Text numberOfLines={1} style={s.fullScreenTitle}>{marker}</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.dynamicDetailBody}>{series.length ? <><View style={s.dynamicCurrent}><Text style={s.dynamicCurrentValue}>{series[series.length-1]?.value} {series[series.length-1]?.unit}</Text><Text style={s.analysisMeta}>Последний результат · {date(series[series.length-1]!.date)}</Text></View><DynamicsChart series={series}/><Text style={s.dynamicHistoryTitle}>История результатов</Text><View style={s.dynamicHistory}>{[...series].reverse().map((point,index)=><View key={`${point.date}-${index}`} style={s.dynamicHistoryRow}><View><Text style={s.dynamicHistoryDate}>{date(point.date)}</Text><Text style={[s.dynamicHistoryStatus,point.status!=="normal"&&{color:colors.coral}]}>{markerStatusText(point.status)} · {point.reference}</Text></View><Text style={s.dynamicHistoryValue}>{point.value} {point.unit}</Text></View>)}</View></>:null}</ScrollView></SafeAreaView></Modal>
    </ScrollView>
    {!doctor && !infoOpen && !marker && <View style={[s.uploadDock, Platform.OS === "web" && s.uploadDockWeb]}><Button label="Загрузить анализ" icon="cloud-upload-outline" onPress={onUpload}/></View>}
    </View>
  );
}

function DynamicMarkerCard({ name, points, onPress }: { name: string; points: Array<{ date: string; value: number; unit: string; status: string; reference: string }>; onPress: () => void }) {
  const latest = points[points.length - 1]!;
  const recent = points.slice(-3);
  const values = recent.map((point) => point.value);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const abnormal = latest.status !== "normal";
  return <Pressable accessibilityRole="button" accessibilityLabel={`Открыть динамику: ${name}`} onPress={onPress} style={({pressed})=>[s.dynamicMarkerCard,pressed&&s.pressablePressed]}>
    <View style={s.dynamicMiniChart}>{[0,1,2].map((index)=>{const point=recent[index];const height=point?24+((point.value-min)/span)*46:18;return <View key={index} style={s.dynamicMiniTrack}><View style={[s.dynamicMiniBar,{height},point&&point.status!=="normal"&&s.dynamicMiniBarAlert]}/></View>})}</View>
    <View style={s.dynamicMarkerCopy}><Text style={s.dynamicCardDate}>{date(latest.date)}</Text><Text style={s.dynamicCardTitle}>{name}: <Text style={s.dynamicCardValue}>{latest.value} {latest.unit}</Text></Text><Text numberOfLines={1} style={[s.dynamicCardReference,abnormal&&{color:colors.coral}]}>{abnormal ? (latest.status === "high" ? "▲ Выше нормы" : latest.status === "low" ? "▼ Ниже нормы" : "Проверить") : "● В норме"} ({latest.reference})</Text></View>
    <View style={s.dynamicCardArrow}><Ionicons name="chevron-forward" size={23} color={colors.ink}/></View>
  </Pressable>;
}

function DynamicsChart({ series }: { series: Array<{ date: string; value: number; unit: string; status: string }> }) {
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return <View style={s.chartCard}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartBars}>{series.map((point,index) => { const height = 52 + ((point.value - min) / span) * 118; return <View key={`${point.date}-${index}`} style={s.chartColumn}><Text style={s.chartValue}>{point.value}</Text><View style={[s.chartBar, { height }, point.status !== "normal" && s.chartBarAlert]} /><Text style={s.chartDate}>{new Date(point.date).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"2-digit"})}</Text></View>; })}</ScrollView><Text style={s.chartUnit}>{series[0]?.unit}</Text></View>;
}
function AnalysisCard({
  item,
  onPress,
  onDelete,
}: {
  item: Analysis;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть результат: ${item.title}`}
      style={({ pressed }) => [
        s.analysisCard,
        pressed && { opacity: 0.78 },
      ]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.analysisTitle}>{date(item.created_at)}</Text>
      </View>
      <View style={s.analysisCardActions}>
        {onDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Удалить ${item.title}`}
            hitSlop={8}
            style={({ pressed }) => [
              s.deleteCardButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.coral} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
function Consultations({
  data,
  user,
  onRefresh,
  initialSelected,
  onTargetHandled,
  onTargetBack,
}: {
  data: Consultation[];
  user: User;
  onRefresh: () => void;
  initialSelected?: Consultation | null;
  onTargetHandled?: () => void;
  onTargetBack?: () => void;
}) {
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [openedFromHome, setOpenedFromHome] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!initialSelected) return;
    setSelected(data.find((item) => item.id === initialSelected.id) || initialSelected);
    setOpenedFromHome(true);
    onTargetHandled?.();
  }, [initialSelected, data, onTargetHandled]);
  function closeSelected() {
    setSelected(null);
    if (openedFromHome) {
      setOpenedFromHome(false);
      onTargetBack?.();
    }
  }
  async function askAI() {
    if (!question.trim()) return;
    setAsking(true);
    try { await api.aiConsult(question.trim()); setQuestion(""); setExpanded(false); onRefresh(); }
    catch (e) { Alert.alert("Не удалось получить ответ", e instanceof Error ? e.message : "Ошибка"); }
    finally { setAsking(false); }
  }
  function dictate() {
    if (Platform.OS !== "web") { Alert.alert("Диктовка", "Используйте микрофон на системной клавиатуре устройства."); return; }
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { Alert.alert("Диктовка недоступна", "Этот браузер не поддерживает распознавание речи. Можно использовать микрофон клавиатуры."); return; }
    const recognition = new Recognition(); recognition.lang = "ru-RU"; recognition.interimResults = false;
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => { const transcript = event.results?.[0]?.[0]?.transcript || ""; setQuestion((current) => `${current}${current ? " " : ""}${transcript}`); };
    recognition.start();
  }
  return <>
    <ScrollView contentContainerStyle={s.scroll}>
      {user.role === "patient" && <Pressable onPress={()=>setExpanded(true)} style={s.complaintPrompt}><View style={s.complaintIcon}><Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.violet}/></View><View style={{flex:1}}><Text style={s.complaintTitle}>Что вас беспокоит?</Text><Text style={s.complaintPlaceholder} numberOfLines={1}>Опишите или продиктуйте жалобы…</Text></View><Ionicons name="chevron-forward" size={21} color={colors.muted}/></Pressable>}
      {data.length ? <View style={s.consultList}>{data.map(c=><Pressable key={c.id} onPress={()=>setSelected(c)} style={[s.consultRow,c.source==="ai"?s.aiConsultCard:s.doctorConsultCard]}><View style={[s.consultRowIcon,{backgroundColor:c.source==="ai"?"#EFEAFF":colors.mint}]}><Ionicons name={c.source==="ai"?"sparkles":"medkit-outline"} size={20} color={c.source==="ai"?colors.violet:colors.aqua}/></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.analysisTitle}>{c.title||"Консультация"}</Text><Text style={s.analysisMeta}>{date(c.created_at)} · {c.status==="answered"?"есть ответ":"ожидает ответа"}</Text></View></Pressable>)}</View> : <Empty icon="chatbubbles-outline" title="Визитов пока нет" text="Здесь появятся ваши обращения, записи и ответы."/>}
    </ScrollView>
    <Modal visible={expanded} animationType="slide" onRequestClose={()=>setExpanded(false)}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable style={s.iconButton} onPress={()=>setExpanded(false)}><Ionicons name="arrow-back" size={24}/></Pressable><Text style={s.fullScreenTitle}>Новая консультация</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.fullScreenBody} keyboardShouldPersistTaps="handled"><TextInput autoFocus multiline style={[s.input,s.complaintInput,s.largeComposer]} placeholder="Когда появились симптомы, где болит, что усиливает или облегчает состояние…" value={question} onChangeText={setQuestion}/><Pressable onPress={dictate} style={[s.micButton,listening&&s.micButtonActive]}><Ionicons name={listening?"radio":"mic-outline"} size={22} color={listening?colors.white:colors.violet}/><Text style={[s.micText,listening&&{color:colors.white}]}>{listening?"Слушаю…":"Продиктовать"}</Text></Pressable><Button label={asking?"Анализируем…":"Получить ответ"} disabled={asking||!question.trim()} onPress={()=>void askAI()}/><Text style={s.aiDisclaimer}>Не заменяет врача. При экстренных симптомах вызывайте 112.</Text></ScrollView></SafeAreaView></Modal>
    <Modal visible={!!selected} animationType="slide" onRequestClose={closeSelected}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={closeSelected}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={1} style={s.fullScreenTitle}>{selected?.title||"Консультация"}</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.fullScreenBody}><Text style={s.analysisMeta}>{selected?date(selected.created_at):""}</Text><View style={s.patientRecord}><Text style={s.replyLabel}>Ваш вопрос</Text><Text style={s.body}>{selected?.question}</Text></View>{selected?.reply?<View style={s.replyBox}><Text style={s.replyLabel}>{selected.source==="ai"?"Рекомендация":"Ответ врача"}</Text><Text style={s.body}>{selected.reply}</Text>{selected.specialty?<Text style={s.specialtyLine}>Специалист: {selected.specialty}</Text>:null}</View>:<Text style={s.cardHint}>Ответ ещё не получен.</Text>}</ScrollView></SafeAreaView></Modal>
  </>;
}

function weekStart(seed = new Date()) { const d = new Date(seed); const day = (d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day); return d; }
function addDays(seed: Date, days: number) { const d=new Date(seed); d.setDate(d.getDate()+days); return d; }
function slotKey(value: Date | string) { const d=new Date(value); d.setSeconds(0,0); return d.toISOString(); }
const weekDays = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function DoctorSchedule({ user, compact }: { user: User; compact: boolean }) {
  const [week,setWeek]=useState(weekStart()); const [slots,setSlots]=useState<ScheduleSlot[]>([]); const [selected,setSelected]=useState<Set<string>>(new Set()); const [edit,setEdit]=useState(false); const [busy,setBusy]=useState(false);
  const from=week.toISOString(), to=addDays(week,7).toISOString();
  const load=async()=>{try{const list=await api.schedule(user.id,from,to);setSlots(list);setSelected(new Set(list.filter(x=>x.status==="available").map(x=>slotKey(x.start_at))))}catch(e){Alert.alert("Расписание недоступно",e instanceof Error?e.message:"Ошибка")}};
  useEffect(()=>{void load()},[from,to]);
  const rows=Array.from({length:24},(_,i)=>{const minutes=8*60+i*30;return {h:Math.floor(minutes/60),m:minutes%60}});
  function toggle(d:number,h:number,m:number){if(!edit)return;const value=addDays(week,d);value.setHours(h,m,0,0);if(value<=new Date())return;const key=slotKey(value);if(slots.some(x=>slotKey(x.start_at)===key&&x.status==="booked"))return;setSelected(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})}
  function beginEdit(){if(addDays(week,7).getTime()-Date.now()<48*60*60*1000)setWeek(addDays(week,7));setEdit(true)}
  async function save(){setBusy(true);try{await api.saveSchedule(from,to,[...selected]);setEdit(false);await load()}catch(e){Alert.alert("Не удалось сохранить",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  return <View style={[s.schedulePage, compact && s.schedulePageCompact]}><LinearGradient colors={["#17214B","#3C3A86","#147D83"]} style={[s.doctorWelcome,compact&&s.doctorWelcomeCompact]}><View><Text style={s.welcomeOver}>РАСПИСАНИЕ</Text><Text style={s.doctorWelcomeTitle}>Здравствуйте, Марат</Text></View><Pressable style={s.scheduleEdit} onPress={()=>edit?void save():beginEdit()}><Ionicons name={edit?"checkmark":"create-outline"} size={19} color={colors.white}/><Text style={s.scheduleEditText}>{busy?"Сохраняем…":edit?"Готово":"Изменить"}</Text></Pressable></LinearGradient>
    <View style={s.weekToolbar}><Pressable style={s.iconButton} onPress={()=>setWeek(addDays(week,-7))}><Ionicons name="chevron-back" size={22}/></Pressable><Pressable onPress={()=>setWeek(weekStart())}><Text style={s.weekTitle}>{week.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — {addDays(week,6).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</Text></Pressable><Pressable style={s.iconButton} onPress={()=>setWeek(addDays(week,7))}><Ionicons name="chevron-forward" size={22}/></Pressable></View>
    {edit&&<View style={s.editHint}><Ionicons name="information-circle-outline" size={20} color={colors.violet}/><Text style={s.aiDisclaimer}>Выберите будущие ячейки. Прошедшее время недоступно.</Text></View>}
    <ScrollView horizontal style={s.calendarHorizontal} contentContainerStyle={{minWidth:760}}><View><View style={s.calendarHeader}><View style={s.timeColumn}/>{weekDays.map((label,i)=><View key={label} style={s.dayHeader}><Text style={s.dayName}>{label}</Text><Text style={s.dayNumber}>{addDays(week,i).getDate()}</Text></View>)}</View><ScrollView style={s.calendarVertical} nestedScrollEnabled>{rows.map(({h,m})=><View key={`${h}-${m}`} style={s.calendarRow}><View style={s.timeColumn}><Text style={s.timeText}>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}</Text></View>{weekDays.map((_,d)=>{const value=addDays(week,d);value.setHours(h,m,0,0);const past=value<=new Date();const key=slotKey(value);const booked=slots.find(x=>slotKey(x.start_at)===key&&x.status==="booked");const available=selected.has(key)&&!past;return <Pressable key={d} disabled={past} onPress={()=>toggle(d,h,m)} style={[s.calendarCell,past&&s.pastCell,available&&s.availableCell,booked&&s.bookedCell]}><Text numberOfLines={2} style={[s.cellText,(available||booked)&&{color:colors.white}]}>{booked?(booked.patient_name||"Пациент"):available?"Доступно":""}</Text></Pressable>})}</View>)}</ScrollView></View></ScrollView>
  </View>
}

function startDictation(setValue: React.Dispatch<React.SetStateAction<string>>, setListening: (v:boolean)=>void) { if(Platform.OS!=="web"){Alert.alert("Диктовка","Нажмите микрофон на системной клавиатуре.");return} const w=window as any;const R=w.SpeechRecognition||w.webkitSpeechRecognition;if(!R){Alert.alert("Диктовка недоступна","Используйте микрофон клавиатуры.");return}const r=new R();r.lang="ru-RU";r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);r.onresult=(e:any)=>setValue(v=>`${v}${v?" ":""}${e.results?.[0]?.[0]?.transcript||""}`);r.start() }

function DoctorPatients({ patientsAnalyses, consultations, onOpen, onRefresh }: { patientsAnalyses: Analysis[]; consultations: Consultation[]; onOpen: (a: Analysis) => void; onRefresh:()=>void }) {
  const [patients,setPatients]=useState<User[]>([]);const [selectedPatient,setSelectedPatient]=useState<User|null>(null);const [notes,setNotes]=useState<PatientNote[]>([]);const [note,setNote]=useState("");const [busy,setBusy]=useState(false);const [listening,setListening]=useState(false);
  const [ai,setAI]=useState<ClinicalAssistResult|null>(null);const [aiBusy,setAIBusy]=useState(false);const [answer,setAnswer]=useState<Record<string,string>>({});
  useEffect(()=>{api.patients().then(setPatients).catch(()=>setPatients([]))},[]);useEffect(()=>{if(selectedPatient)api.patientNotes(selectedPatient.id).then(setNotes).catch(()=>setNotes([]))},[selectedPatient]);
  const patientAnalyses=selectedPatient?patientsAnalyses.filter(a=>a.owner_id===selectedPatient.id):[];
  const requests=selectedPatient?consultations.filter(c=>c.patient_id===selectedPatient.id&&c.source!=="ai"):[];
  async function save(){if(!selectedPatient||!note.trim())return;setBusy(true);try{await api.addPatientNote(selectedPatient.id,note.trim());setNote("");setNotes(await api.patientNotes(selectedPatient.id))}catch(e){Alert.alert("Не удалось сохранить",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  async function generateAI(){if(!selectedPatient)return;setAIBusy(true);try{setAI(await api.clinicalAssist({patientID:selectedPatient.id,objective:"",clinical:"Оцени доступные анализы и вопросы пациента. Дай структурированное резюме, красные флаги, обследования и тактику для врача."}))}catch(e){Alert.alert("AI недоступен",e instanceof Error?e.message:"Ошибка")}finally{setAIBusy(false)}}
  async function replyTo(c:Consultation){const text=answer[c.id]?.trim();if(!text)return;setBusy(true);try{await api.reply(c.id,text);setAnswer({...answer,[c.id]:""});onRefresh()}catch(e){Alert.alert("Ответ не отправлен",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  return <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">{!selectedPatient?<><View style={s.doctorGrid}>{patients.map(p=><Pressable key={p.id} style={s.doctorDirectoryCard} onPress={()=>setSelectedPatient(p)}><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{p.full_name}</Text><Text style={s.specialtyLine}>{p.patient_profile?`${p.patient_profile.age} лет · ИМТ ${p.patient_profile.bmi}`:"Профиль не заполнен"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>)}</View>{!patients.length&&<Empty icon="people-outline" title="Пациентов пока нет" text="Пациент появится после записи или запроса услуги."/>}</>:<><Pressable style={s.backLink} onPress={()=>{setSelectedPatient(null);setAI(null)}}><Ionicons name="arrow-back" size={18} color={colors.brand}/><Text style={s.link}>Все пациенты</Text></Pressable><View style={s.patientRecord}><Text style={s.eyebrow}>КАРТА ПАЦИЕНТА</Text><Text style={s.cardTitle}>{selectedPatient.full_name}</Text>{selectedPatient.patient_profile&&<Text style={s.analysisMeta}>{selectedPatient.patient_profile.age} лет · {selectedPatient.patient_profile.height_cm} см · {selectedPatient.patient_profile.weight_kg} кг · ИМТ {selectedPatient.patient_profile.bmi}</Text>}</View><Text style={s.surveyTitle}>Анализы</Text><View style={s.compactCardGrid}>{patientAnalyses.map(a=><AnalysisCard key={a.id} item={a} onPress={()=>onOpen(a)}/>)}</View>{!patientAnalyses.length&&<Text style={s.cardHint}>Нет открытых врачу исследований.</Text>}<Text style={s.surveyTitle}>Вопросы пациента</Text>{requests.map(c=><View key={c.id} style={s.noteCard}><View style={s.rowBetween}><Text style={s.replyLabel}>{c.title||"Консультация"}</Text><Text style={s.analysisMeta}>{date(c.created_at)}</Text></View><Text style={s.body}>{c.question}</Text>{c.reply?<View style={s.replyBox}><Text style={s.replyLabel}>Ваш ответ</Text><Text style={s.body}>{c.reply}</Text></View>:<><TextInput multiline style={[s.input,s.replyInput]} placeholder="Ответ пациенту…" value={answer[c.id]||""} onChangeText={v=>setAnswer({...answer,[c.id]:v})}/><View style={s.complaintActions}><Pressable style={s.micButton} onPress={()=>{const setter:React.Dispatch<React.SetStateAction<string>>=value=>setAnswer(current=>({...current,[c.id]:typeof value==="function"?value(current[c.id]||""):value}));startDictation(setter,setListening)}}><Ionicons name="mic-outline" size={20} color={colors.violet}/></Pressable><Button compact disabled={busy||!answer[c.id]?.trim()} label="Ответить" onPress={()=>void replyTo(c)}/></View></>}</View>)}{!requests.length&&<Text style={s.cardHint}>Новых вопросов нет.</Text>}<View style={s.rowBetween}><Text style={s.surveyTitle}>Резюме AI</Text><Button compact label={aiBusy?"Анализ…":ai?"Обновить":"Сформировать"} disabled={aiBusy} onPress={()=>void generateAI()}/></View>{ai&&<View style={s.aiSummaryCard}><Text style={s.body}>{ai.assessment}</Text><AIList title="Красные флаги" items={ai.red_flags}/><AIList title="Что проверить" items={ai.suggested_checks}/><AIList title="Тактика" items={ai.tactics}/><AIList title="Источники" items={ai.guideline_refs}/><Text style={s.aiDisclaimer}>{ai.limitations}</Text></View>}<View style={s.noteComposer}><Text style={s.surveyTitle}>Заключение в карту</Text><TextInput multiline style={[s.input,s.noteInput]} placeholder="Заключение, рекомендации и дальнейшая тактика…" value={note} onChangeText={setNote}/><View style={s.complaintActions}><Pressable style={[s.micButton,listening&&s.micButtonActive]} onPress={()=>startDictation(setNote,setListening)}><Ionicons name={listening?"radio":"mic-outline"} size={21} color={listening?colors.white:colors.violet}/><Text style={[s.micText,listening&&{color:colors.white}]}>{listening?"Слушаю…":"Продиктовать"}</Text></Pressable><Button compact disabled={busy||!note.trim()} label={busy?"Сохраняем…":"Сохранить"} onPress={()=>void save()}/></View></View>{notes.map(n=><View key={n.id} style={s.noteCard}><View style={s.rowBetween}><Text style={s.replyLabel}>Заключение</Text><Text style={s.analysisMeta}>{date(n.created_at)}</Text></View><Text style={s.body}>{n.text}</Text></View>)}</>}</ScrollView>
}

function AIWorkspace(){const [chats,setChats]=useState<AIChat[]>([]);const [active,setActive]=useState<AIChat|null>(null);const [message,setMessage]=useState("");const [title,setTitle]=useState("");const [busy,setBusy]=useState(false);const [listening,setListening]=useState(false);const load=()=>api.aiChats().then(setChats).catch(()=>setChats([]));useEffect(()=>{void load()},[]);async function open(chat:AIChat){setActive(await api.aiChat(chat.id));setTitle(chat.title)}async function create(){const c=await api.createAIChat();setActive(c);setTitle(c.title);void load()}async function send(){if(!active||!message.trim())return;const text=message.trim();setMessage("");setBusy(true);try{await api.aiMessage(active.id,text);setActive(await api.aiChat(active.id));void load()}catch(e){setMessage(text);Alert.alert("AI недоступен",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}async function rename(){if(active&&title.trim()){await api.renameAIChat(active.id,title.trim());setActive({...active,title:title.trim()});void load()}}async function remove(){if(!active)return;await api.deleteAIChat(active.id);setActive(null);void load()}
  return <><ScrollView contentContainerStyle={s.scroll}><View style={s.aiWorkspaceHeader}><View style={s.aiWorkspaceCopy}><Text style={s.sectionTitle}>Беседы с AI</Text><Text style={s.sectionIntro}>Клиническое рассуждение и подготовка вопросов. Решение всегда принимает врач.</Text></View><Button compact icon="add" label="Новая консультация" onPress={()=>void create()}/></View>{chats.map(c=><Pressable key={c.id} style={s.aiChatCard} onPress={()=>void open(c)}><View style={s.aiChatIcon}><Ionicons name="sparkles" size={22} color={colors.white}/></View><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{c.title}</Text><Text style={s.analysisMeta}>{new Date(c.updated_at).toLocaleString("ru-RU")}</Text><Text numberOfLines={2} style={s.analysisSummary}>{c.messages?.[0]?.content||"Новая беседа"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>)}{!chats.length&&<Empty icon="sparkles-outline" title="Бесед пока нет" text="Создайте консультацию, чтобы обсудить клинический вопрос с AI."/>}</ScrollView><Modal visible={!!active} animationType="slide" onRequestClose={()=>setActive(null)}><SafeAreaView style={s.chatPage}><View style={s.chatHeader}><Pressable style={s.iconButton} onPress={()=>setActive(null)}><Ionicons name="arrow-back" size={24}/></Pressable><TextInput style={s.chatTitleInput} value={title} onChangeText={setTitle} onBlur={()=>void rename()}/><Pressable style={s.iconButton} onPress={()=>void remove()}><Ionicons name="trash-outline" size={22} color={colors.coral}/></Pressable></View><ScrollView style={{flex:1}} contentContainerStyle={s.messages}>{active?.messages.map((m,i)=><View key={i} style={[s.messageBubble,m.role==="user"?s.userBubble:s.assistantBubble]}><Text style={[s.body,m.role==="user"&&{color:colors.white}]}>{m.content}</Text><Text style={[s.messageTime,m.role==="user"&&{color:"#FFFFFFAA"}]}>{new Date(m.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text></View>)}{busy&&<View style={[s.messageBubble,s.assistantBubble]}><ActivityIndicator color={colors.violet}/></View>}</ScrollView><View style={s.chatComposer}><Pressable style={s.iconButton} onPress={()=>startDictation(setMessage,setListening)}><Ionicons name={listening?"radio":"mic-outline"} size={23} color={colors.violet}/></Pressable><TextInput multiline style={s.chatInput} placeholder="Сообщение AI…" value={message} onChangeText={setMessage}/><Pressable disabled={busy||!message.trim()} style={s.sendButton} onPress={()=>void send()}><Ionicons name="arrow-up" size={22} color={colors.white}/></Pressable></View></SafeAreaView></Modal></>
}

function Guides(){
  const [query,setQuery]=useState("");const [catalog,setCatalog]=useState<Guide[]>([]);const [active,setActive]=useState<Guide|null>(null);const [synced,setSynced]=useState("");const [busy,setBusy]=useState(false);const reader=useRef<React.ComponentRef<typeof NativeScrollView>>(null);const positions=useRef<Record<string,number>>({});
  const load=async(sync=false)=>{setBusy(true);try{const r=sync?await api.syncGuides():await api.guides();setCatalog(r.items);setSynced(r.synced_at)}catch(e){Alert.alert("Guides недоступны",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}};useEffect(()=>{void load()},[]);
  async function open(item:Guide){setBusy(true);try{setActive(await api.guide(item.id));positions.current={}}catch(e){Alert.alert("Документ недоступен",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  const filtered=catalog.filter(g=>`${g.title} ${g.code} ${g.category} ${g.specialties?.join(" ")} ${g.developers?.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0,120);
  return <><ScrollView contentContainerStyle={s.scroll}><View style={s.rowBetween}><Text style={s.sectionIntro}>Взрослая кардиология и терапия</Text><Pressable style={s.iconButton} onPress={()=>void load(true)}>{busy?<ActivityIndicator/>:<Ionicons name="refresh" size={21} color={colors.brand}/>}</Pressable></View><View style={s.doctorSearch}><Ionicons name="search" size={21} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={query} onChangeText={setQuery} placeholder="Название, МКБ или раздел…"/></View><View style={s.guidelineGrid}>{filtered.map(g=><Pressable key={g.id} style={s.guidelineCard} onPress={()=>void open(g)}><View style={s.wellnessIcon}><Ionicons name="book-outline" size={23} color={colors.brand}/></View><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{g.title}</Text><Text style={s.analysisMeta}>{[g.code,g.specialties?.join(", "),g.status].filter(Boolean).join(" · ")}</Text>{g.published_at?<Text style={s.guidePublished}>Опубликовано {date(g.published_at)}</Text>:null}</View><Ionicons name="chevron-forward" size={20} color={colors.brand}/></Pressable>)}</View><View style={s.clinicalNotice}><Ionicons name="shield-checkmark-outline" size={22} color={colors.amber}/><Text style={s.aiDisclaimer}>Перед решением сверяйте редакцию и применимость с официальным оригиналом.</Text></View></ScrollView>
  <Modal visible={!!active} animationType="slide" onRequestClose={()=>setActive(null)}><SafeAreaView style={s.guideReader}><View style={s.chatHeader}><Pressable style={s.iconButton} onPress={()=>setActive(null)}><Ionicons name="arrow-back" size={24}/></Pressable><View style={{flex:1}}><Text numberOfLines={1} style={s.doctorDirectoryName}>{active?.title}</Text><Text style={s.analysisMeta}>{[active?.code,active?.status].filter(Boolean).join(" · ")}</Text></View><Pressable style={s.iconButton} onPress={()=>active&&void Linking.openURL(active.source_url)}><Ionicons name="open-outline" size={22} color={colors.brand}/></Pressable></View><ScrollView ref={reader} contentContainerStyle={s.guideBody}><View style={s.guideContents}><Text style={s.cardTitle}>Содержание</Text>{active?.sections?.map((section,index)=><Pressable key={section.id} style={s.contentsRow} onPress={()=>reader.current?.scrollTo({y:positions.current[section.id]||0,animated:true})}><Text style={s.contentsNumber}>{index+1}</Text><Text style={s.contentsTitle}>{section.title}</Text></Pressable>)}</View>{active?.sections?.map(section=><View key={section.id} onLayout={e=>{positions.current[section.id]=e.nativeEvent.layout.y}} style={s.guideSection}><Text style={s.guideSectionTitle}>{section.title}</Text><Text selectable style={s.guideText}>{section.content}</Text><Pressable style={s.backToContents} onPress={()=>reader.current?.scrollTo({y:0,animated:true})}><Ionicons name="arrow-up" size={16} color={colors.brand}/><Text style={s.link}>К содержанию</Text></Pressable></View>)}</ScrollView></SafeAreaView></Modal></>
}

function DoctorsScreen({ user, onRefresh, initialDoctorID, onTargetHandled, onTargetBack }: { user: User; onRefresh: () => void; initialDoctorID?: string; onTargetHandled?: () => void; onTargetBack?: () => void }) {
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [action, setAction] = useState<"profile" | "consultation" | "appointment">("profile");
  const [question, setQuestion] = useState("Прошу прокомментировать результаты и дальнейшие действия.");
  const [availableSlots, setAvailableSlots] = useState<ScheduleSlot[]>([]);
  const [appointmentAt, setAppointmentAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [slotsBusy, setSlotsBusy] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [personalConsent, setPersonalConsent] = useState(false);
  const [medicalConsent, setMedicalConsent] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{ serviceType: "consultation" | "appointment" | "home_visit"; at?: string } | null>(null);

  useEffect(() => {
    if (user.role === "patient") api.doctors("").then(setDoctors).catch(() => setDoctors([]));
  }, [user.role]);
  useEffect(() => {
    if (!doctors.length || selectedDoctor) return;
    const doctor = doctors.find((item) => item.id === initialDoctorID)
      || doctors.find((item) => /марат/i.test(item.full_name))
      || doctors[0];
    if (!doctor) return;
    setSelectedDoctor(doctor);
    setAction("profile");
    if (initialDoctorID) onTargetHandled?.();
  }, [initialDoctorID, doctors, onTargetHandled, selectedDoctor]);
  useEffect(() => {
    if (!selectedDoctor || action !== "appointment") return;
    const from = new Date();
    setSlotsBusy(true);
    setSlotsError("");
    api.schedule(selectedDoctor.id, from.toISOString(), addDays(from, 32).toISOString())
      .then((list) => setAvailableSlots(list.filter((slot) => slot.status === "available" && new Date(slot.start_at) > from)))
      .catch((error) => setSlotsError(error instanceof Error ? error.message : "Расписание недоступно"))
      .finally(() => setSlotsBusy(false));
  }, [selectedDoctor, action]);

  function request(serviceType: "consultation" | "appointment" | "home_visit", at?: string) {
    if (!selectedDoctor) return;
    if (serviceType === "appointment" && !at) {
      Alert.alert("Выберите время", "Выберите свободную ячейку врача.");
      return;
    }
    if (!personalConsent || !medicalConsent) {
      setPendingRequest({ serviceType, at });
      return;
    }
    void submitRequest(serviceType, at);
  }
  async function submitRequest(serviceType: "consultation" | "appointment" | "home_visit", at?: string) {
    if (!selectedDoctor) return;
    setBusy(true);
    try {
      await api.requestDoctor({ doctorID: selectedDoctor.id, question, serviceType, appointmentAt: at, personalDataConsent: personalConsent, medicalDataConsent: medicalConsent });
      setPendingRequest(null);
      setPersonalConsent(false);
      setMedicalConsent(false);
      onRefresh();
      Alert.alert(serviceType === "appointment" ? "Вы записаны" : "Запрос отправлен");
    } catch (error) {
      Alert.alert("Не удалось отправить", error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  function close() { setSelectedDoctor(null); setAction("profile"); setPendingRequest(null); setPersonalConsent(false); setMedicalConsent(false); onTargetBack?.(); }
  if (user.role === "doctor") return <ScrollView contentContainerStyle={s.scroll}><Empty icon="medical-outline" title="Каталог коллег" text="Раздел готовится." /></ScrollView>;

  return <>
    <View style={s.directBookingLoader}>{doctors.length ? null : <ActivityIndicator color={colors.brand}/>}</View>
    <Modal visible={!!selectedDoctor} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.fullScreenModal}>
        {pendingRequest && <View style={s.consentWarning}>
          <View style={s.consentWarningHead}><Ionicons name="warning-outline" size={22} color={colors.amber}/><Text style={s.consentWarningTitle}>Доступ будет ограничен</Text></View>
          <Text style={s.consentWarningText}>{!personalConsent && !medicalConsent ? "Врач не получит ваши персональные данные и результаты обследований." : !personalConsent ? "Врач не получит персональные данные и сведения профиля." : "Врач не получит результаты анализов и других обследований."}</Text>
          <View style={s.consentWarningActions}><Button compact kind="ghost" label="Отмена" onPress={() => setPendingRequest(null)}/><Button compact label="Отправить" disabled={busy} onPress={() => void submitRequest(pendingRequest.serviceType, pendingRequest.at)}/></View>
        </View>}
        <View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={action === "profile" ? close : () => setAction("profile")}><Ionicons name="arrow-back" size={24}/></Pressable><Text style={s.fullScreenTitle}>{action === "profile" ? "Профиль врача" : action === "appointment" ? "Запись на приём" : "Запрос консультации"}</Text><View style={s.headerSpacer}/></View>
        <ScrollView contentContainerStyle={s.fullScreenBody} keyboardShouldPersistTaps="handled">
          <View style={s.doctorProfileHero}><AvatarView user={selectedDoctor!} size={84}/><Text style={s.cardTitle}>{selectedDoctor?.full_name}</Text><Text style={s.specialtyLine}>{selectedDoctor?.specialization}</Text>{selectedDoctor?.verified && <Text style={s.verifiedText}>✓ Профиль подтверждён</Text>}</View>
          {action === "profile" ? <>
            <View style={s.patientRecord}><Text style={s.replyLabel}>О враче</Text><Text style={s.body}>Специальность: {selectedDoctor?.specialization || "не указана"}</Text><Text style={s.body}>Лицензия: {selectedDoctor?.license_number || "не указана"}</Text><Text style={s.body}>Выезд на дом: {selectedDoctor?.home_visits ? "доступен" : "не заявлен"}</Text></View>
            <View style={s.doctorProfileActions}><Button label="Запросить консультацию" icon="chatbubble-outline" onPress={() => setAction("consultation")}/><Button label="Записаться на приём" icon="calendar-outline" kind="ghost" onPress={() => setAction("appointment")}/>{selectedDoctor?.home_visits && <Button label="Вызвать на дом" icon="home-outline" kind="ghost" disabled={busy} onPress={() => void request("home_visit")}/>}</View>
          </> : action === "consultation" ? <>
            <Field label="Вопрос врачу" multiline value={question} onChangeText={setQuestion}/>
            <ConsentControls personal={personalConsent} medical={medicalConsent} onPersonal={setPersonalConsent} onMedical={setMedicalConsent}/>
            <Button label={busy ? "Отправляем…" : "Отправить запрос"} disabled={busy} onPress={() => request("consultation")}/>
          </> : <>
            {slotsBusy ? <ActivityIndicator color={colors.brand}/> : slotsError ? <Text style={s.error}>{slotsError}</Text> : availableSlots.length ? <View style={s.slotGroups}>{availableSlots.map((slot) => <Choice key={slot.id} active={appointmentAt === slot.start_at} label={new Date(slot.start_at).toLocaleString("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} onPress={() => setAppointmentAt(slot.start_at)}/>)}</View> : <Empty icon="calendar-outline" title="Будущих часов пока нет" text="Врач ещё не открыл новые ячейки."/>}
            <Field label="Комментарий (необязательно)" multiline value={question} onChangeText={setQuestion}/>
            <ConsentControls personal={personalConsent} medical={medicalConsent} onPersonal={setPersonalConsent} onMedical={setMedicalConsent}/>
            <Button label={busy ? "Записываем…" : "Подтвердить запись"} disabled={busy || !appointmentAt} onPress={() => request("appointment", appointmentAt)}/>
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}

function ConsentControls({ personal, medical, onPersonal, onMedical }: { personal: boolean; medical: boolean; onPersonal: (value: boolean) => void; onMedical: (value: boolean) => void }) {
  const [legal, setLegal] = useState<"personal" | "medical" | null>(null);
  const row = (kind: "personal" | "medical", checked: boolean, label: string, onChange: (value: boolean) => void) => <View style={s.consentRow}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Отметить: ${label}`} accessibilityState={{ checked }} hitSlop={8} onPress={() => onChange(!checked)} style={[s.consentBox, checked && s.consentBoxChecked]}>{checked && <Ionicons name="checkmark" size={16} color={colors.white}/>}</Pressable>
    <Pressable accessibilityRole="button" onPress={() => setLegal(kind)} style={s.consentTextButton}><Text style={s.consentLabel}>{label}</Text><Text style={s.consentOpen}>Открыть полный текст</Text></Pressable>
  </View>;
  const personalText = "Настоящим я свободно, своей волей и в своём интересе даю оператору приложения Lab Health согласие на обработку моих персональных данных в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».\n\nПеречень данных: фамилия, имя и отчество (если указаны), возраст, контактные и регистрационные данные, сведения профиля, история обращений, записи на приём и технические сведения, необходимые для работы учётной записи.\n\nЦели обработки: регистрация и идентификация пользователя, организация записи и консультаций, отображение информации выбранному пользователем врачу, обеспечение безопасности и исполнение запросов пользователя.\n\nРазрешённые действия: сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, предоставление выбранному врачу, блокирование и удаление. Обработка может выполняться с использованием средств автоматизации.\n\nСогласие действует до достижения указанных целей либо до его отзыва. Я вправе отозвать согласие обращением к оператору. Отзыв не отменяет обработку, допустимую или обязательную по закону. Я подтверждаю, что согласие является конкретным, предметным, информированным, сознательным и однозначным.";
  const medicalText = "Настоящим я даю согласие на предоставление выбранному мною врачу доступа к сведениям о состоянии здоровья, составляющим врачебную тайну, в соответствии со статьёй 13 Федерального закона № 323-ФЗ «Об основах охраны здоровья граждан в Российской Федерации».\n\nДоступ включает загруженные лабораторные анализы и иные обследования, распознанные показатели, исходные документы, историю показателей и сформированные по ним резюме.\n\nЦель доступа: рассмотрение моего запроса на консультацию или запись, подготовка врачом ответа, заключения и рекомендаций. Доступ предоставляется только выбранному врачу и не означает разрешение на распространение сведений неопределённому кругу лиц.\n\nЯ понимаю, что при отсутствии этого согласия врач не увидит мои анализы и обследования. Согласие действует до отзыва либо прекращения целей предоставления доступа. Я могу отозвать его через обращение к оператору; ранее совершённые на законном основании действия остаются правомерными.";
  return <>
    <View style={s.consentGroup}>
      {row("personal", personal, "Согласие на обработку персональных данных", onPersonal)}
      {row("medical", medical, "Согласие на предоставление доступа к данным обследований", onMedical)}
    </View>
    <Modal visible={!!legal} animationType="slide" onRequestClose={() => setLegal(null)}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityLabel="Назад" style={s.iconButton} onPress={() => setLegal(null)}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={2} style={s.fullScreenTitle}>{legal === "medical" ? "Доступ к данным обследований" : "Обработка персональных данных"}</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.legalBody}><Text selectable style={s.legalText}>{legal === "medical" ? medicalText : personalText}</Text></ScrollView></SafeAreaView></Modal>
  </>;
}

function Profile({ user, onUpdated }: { user: User; onUpdated: (u: User) => void }) {
  const profile = user.patient_profile;
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || "");
  const [address, setAddress] = useState(user.residential_address || "");
  const [age, setAge] = useState(profile ? String(profile.age) : "");
  const [height, setHeight] = useState(profile ? String(profile.height_cm) : "");
  const [weight, setWeight] = useState(profile ? String(profile.weight_kg) : "");
  const [busy, setBusy] = useState(false);
  async function chooseAvatar(source:"camera"|"gallery"){
    const permission=source==="camera"?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){Alert.alert("Нет доступа",source==="camera"?"Разрешите доступ к камере.":"Разрешите доступ к галерее.");return}
    const result=source==="camera"?await ImagePicker.launchCameraAsync({mediaTypes:["images"],quality:.85,allowsEditing:true,aspect:[1,1]}):await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:.85,allowsEditing:true,aspect:[1,1]});
    if(result.canceled)return;const x=result.assets[0];if(!x)return;setBusy(true);try{onUpdated(await api.uploadAvatar({uri:x.uri,name:x.fileName||`avatar-${Date.now()}.jpg`,mimeType:x.mimeType||"image/jpeg",file:x.file}))}catch(e){Alert.alert("Фото не загружено",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}
  }
  async function saveProfile() {
    setBusy(true);
    try {
      let updated = await api.updateContactProfile({ fullName, phone, residentialAddress: address });
      if (user.role === "patient") updated = await api.updatePatientProfile({ age: Number(age), heightCM: Number(height), weightKG: Number(weight), activity: profile?.activity || { regular_sport: false }, nutrition: profile?.nutrition || {} });
      onUpdated(updated);
      Alert.alert("Готово", "Данные профиля сохранены.");
    }
    catch (e) { Alert.alert("Не удалось сохранить", e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
  return (
    <ScrollView contentContainerStyle={s.profileScreen}>
      <View style={s.profileIdentity}><View style={s.profileIdentityIcon}>{user.role === "doctor" ? <AvatarView user={user} size={58}/> : <Ionicons name="person-outline" size={31} color={colors.brand}/>}</View><View style={{flex:1}}><Text style={s.profileIdentityName}>{user.full_name}</Text><Text style={s.profileIdentityRole}>{user.role === "doctor" ? user.specialization : "Пользователь"}</Text></View></View>
      <Text style={s.profileSectionTitle}>Личные данные</Text>
      <ProfileLine label="Имя" value={fullName} onChangeText={setFullName}/>
      <ProfileLine label="Почта" value={user.email} editable={false}/>
      <ProfileLine label="Мобильный телефон" value={phone} placeholder="+7 900 000-00-00" keyboardType="phone-pad" onChangeText={setPhone}/>
      <ProfileLine label="Адрес проживания" value={address} placeholder="Город, улица, дом, квартира" onChangeText={setAddress}/>
      {user.role === "doctor" && <><Text style={s.profileSectionTitle}>Фотография</Text><View style={s.profilePhotoActions}><MiniAction label="Камера" icon="camera-outline" onPress={()=>void chooseAvatar("camera")}/><MiniAction label="Галерея" icon="images-outline" onPress={()=>void chooseAvatar("gallery")}/></View></>}
      {user.role === "patient" && <><Text style={s.profileSectionTitle}>Показатели здоровья</Text><ProfileLine label="Возраст" value={age} keyboardType="number-pad" onChangeText={setAge}/><ProfileLine label="Рост" suffix="см" value={height} keyboardType="decimal-pad" onChangeText={setHeight}/><ProfileLine label="Вес" suffix="кг" value={weight} keyboardType="decimal-pad" onChangeText={setWeight}/>{profile ? <View style={s.profileInfoLine}><Text style={s.profileInfoLabel}>Индекс массы тела</Text><Text style={s.profileInfoValue}>{profile.bmi}</Text></View> : null}</>}
        {user.role === "doctor" && !user.verified && (
          <View style={s.verifyNote}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={colors.amber}
            />
            <Text style={s.verifyText}>
              Профиль врача ожидает подтверждения лицензии.
            </Text>
          </View>
        )}
      <View style={s.profileSave}><Button label={busy ? "Сохраняем…" : "Сохранить изменения"} disabled={busy} onPress={() => void saveProfile()} /></View>
    </ScrollView>
  );
}

function ProfileLine({ label, suffix, ...props }: any) {
  return <View style={s.profileLine}><Text style={s.profileLineLabel}>{label}</Text><View style={s.profileLineValue}><TextInput {...props} style={s.profileLineInput} placeholderTextColor={colors.muted}/>{suffix ? <Text style={s.profileLineSuffix}>{suffix}</Text> : null}</View></View>;
}

function UploadModal({
  visible,
  seed,
  onClose,
  onDone,
}: {
  visible: boolean;
  seed: Asset | null;
  onClose: () => void;
  onDone: (result: Analysis) => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (visible) {
      setAsset(seed?.uri ? seed : null);
      setError("");
      setProgress(0);
    }
  }, [visible, seed]);
  useEffect(() => {
    if (!busy) return;
    setProgress(0.08);
    const timer = setInterval(() => {
      setProgress((current) => {
        if (current < 0.28) return Math.min(0.28, current + 0.045);
        if (current < 0.62) return Math.min(0.62, current + 0.024);
        if (current < 0.86) return Math.min(0.86, current + 0.012);
        return Math.min(0.94, current + 0.003);
      });
    }, 700);
    return () => clearInterval(timer);
  }, [busy]);
  async function camera() {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      setError("Разрешите доступ к камере в настройках устройства.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!r.canceled) {
      const x = r.assets[0];
      if (x)
        setAsset({
          uri: x.uri,
          name: x.fileName || `analysis-${Date.now()}.jpg`,
          mimeType: x.mimeType || "image/jpeg",
          file: x.file,
        });
    }
  }
  async function gallery() {
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Разрешите доступ к фотографиям в настройках устройства.");
        return;
      }
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (!r.canceled) {
      const x = r.assets[0];
      if (x)
        setAsset({
          uri: x.uri,
          name: x.fileName || `analysis-${Date.now()}.jpg`,
          mimeType: x.mimeType || "image/jpeg",
          file: x.file,
        });
    }
  }
  async function files() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!r.canceled) {
      const x = r.assets[0];
      if (x)
        setAsset({
          uri: x.uri,
          name: x.name,
          mimeType: x.mimeType,
          file: x.file,
        });
    }
  }
  async function submit() {
    if (!asset) {
      setError("Сначала выберите файл.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.upload(asset);
      setProgress(1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.fullScreenModal}>
        <View style={[s.uploadSheet, compact && s.uploadSheetCompact]}>
          <View style={s.rowBetween}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              hitSlop={10}
              style={s.iconButton}
              onPress={onClose}
            >
              <Ionicons name="arrow-back" size={25} color={colors.ink} />
            </Pressable>
            <Text style={s.fullScreenTitle}>Добавить результат</Text><View style={s.headerSpacer}/>
          </View>
          <Text style={s.cardHint}>Сфотографируйте бланк или выберите изображение/PDF.</Text>
          <View style={s.sourceRow}>
            <Source icon="camera-outline" label="Камера" onPress={camera} />
            <Source icon="images-outline" label="Галерея" onPress={gallery} />
            <Source icon="folder-open-outline" label="Файлы" onPress={files} />
          </View>
          {asset && (
            <View style={s.fileChosen}>
              <Ionicons
                name="document-attach-outline"
                size={24}
                color={colors.brand}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.analysisTitle} numberOfLines={1}>
                  {asset.name}
                </Text>
                <Text style={s.analysisMeta}>Готов к загрузке</Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={25}
                color={colors.brand}
              />
            </View>
          )}
          <Text style={s.autoTitleHint}>Название определим автоматически по показателям: ОАК, биохимия, гормоны или исследование мочи.</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          {busy && (
            <View style={s.progressPanel} accessibilityRole="progressbar">
              <View style={s.progressHead}>
                <View style={s.progressLabelRow}>
                  <ActivityIndicator size="small" color={colors.brand} />
                  <Text style={s.progressLabel}>
                    {progress < 0.3
                      ? "Загружаем документ"
                      : progress < 0.7
                        ? "Распознаём показатели"
                        : progress < 1
                          ? "Проверяем результат"
                          : "Готово"}
                  </Text>
                </View>
                <Text style={s.progressPercent}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <LinearGradient
                  colors={[colors.brand, colors.aqua, colors.violet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]}
                />
              </View>
              <Text style={s.progressHint}>Процент приблизительный и зависит от качества снимка.</Text>
            </View>
          )}
          <Button
            label={busy ? "Распознаём…" : "Загрузить и распознать"}
            disabled={busy}
            onPress={submit}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function escapeHTML(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function analysisReportHTML(analysis: Analysis) {
  const rows = analysis.markers.length
    ? analysis.markers
        .map((marker) => {
          const reference =
            marker.reference_text ||
            [marker.reference_min, marker.reference_max]
              .filter((value) => value !== undefined)
              .join(" — ") ||
            "Не указан";
          const result = `${marker.value ?? marker.text_value ?? "—"}${marker.unit ? ` ${marker.unit}` : ""}`;
          return `<tr><td>${escapeHTML(marker.name)}</td><td class="value">${escapeHTML(result)}</td><td>${escapeHTML(reference)}</td><td><span class="status ${marker.status}">${escapeHTML(markerStatusText(marker.status))}</span></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="4" class="empty">Показатели не распознаны</td></tr>';
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1c2330; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 12px; }
  .header { margin: -18mm -14mm 20px; padding: 22px 14mm 18px; color: white; background: linear-gradient(120deg, #1e315d, #395aa6, #187b83); }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
  h1 { margin: 7px 0 3px; font-size: 22px; }
  .meta { color: #657086; margin: 4px 0 18px; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 9px; color: #263553; background: #eaf0f8; border: 1px solid #d5deeb; text-align: left; font-size: 11px; }
  td { padding: 10px 9px; border: 1px solid #dbe2ec; vertical-align: middle; }
  tr { break-inside: avoid; }
  .value { font-weight: 700; white-space: nowrap; }
  .status { display: inline-block; padding: 4px 7px; border-radius: 8px; color: #176452; background: #e4f5ef; font-size: 10px; font-weight: 700; white-space: nowrap; }
  .status.high, .status.low, .status.unknown { color: #9a5b12; background: #fff1da; }
  .empty { padding: 24px; color: #657086; text-align: center; }
  .note { margin-top: 20px; color: #657086; font-size: 10px; line-height: 1.5; }
</style></head><body>
  <div class="header"><div class="brand">Lab · медицинские документы</div><h1>Результаты лабораторного анализа</h1></div>
  <h2>${escapeHTML(analysis.title)}</h2>
  <div class="meta">Дата загрузки: ${escapeHTML(date(analysis.created_at))}</div>
  <table><thead><tr><th>Показатель</th><th>Результат</th><th>Референс</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="note">Документ содержит автоматически распознанные данные. Сверяйте значения с оригинальным бланком и обсуждайте медицинские решения с врачом.</div>
</body></html>`;
}

function markerStatusText(value: string) {
  return value === "high"
    ? "Выше нормы"
    : value === "low"
      ? "Ниже нормы"
      : value === "normal"
        ? "Норма"
        : "Проверить";
}

function Detail({
  item,
  user,
  onClose,
  onChanged,
  onError,
}: {
  item: Analysis | null;
  user: User;
  onClose: () => void;
  onChanged: () => void;
  onError: (x: string) => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 520;
  const [exporting, setExporting] = useState<"share" | "view" | "print" | null>(null);
  const [pdfURI, setPdfURI] = useState("");
  if (!item) return null;
  const active = item;
  const review = active.ai_review?.summary || "";
  async function nativeReport() {
    const result = await Print.printToFileAsync({
      html: analysisReportHTML(active),
      margins: { top: 28, right: 28, bottom: 28, left: 28 },
    });
    return result.uri;
  }
  async function shareWebReport() {
    const response = await fetch(api.reportURL(active.id));
    if (!response.ok) throw new Error("Не удалось сформировать PDF");
    const blob = await response.blob();
    const file = new File([blob], `analysis-${active.id}.pdf`, {
      type: "application/pdf",
    });
    const webNavigator = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (
      webNavigator.share &&
      (!webNavigator.canShare || webNavigator.canShare({ files: [file] }))
    ) {
      await webNavigator.share({
        title: active.title,
        text: "Результаты лабораторного анализа в PDF",
        files: [file],
      });
      return;
    }
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function performReportAction(kind: "share" | "view" | "print") {
    if (exporting) return;
    setExporting(kind);
    try {
      if (Platform.OS === "web") {
        if (kind === "view") {
          setPdfURI(api.reportURL(active.id));
        } else if (kind === "print") {
          await Linking.openURL(api.reportURL(active.id));
        } else {
          await shareWebReport();
        }
        return;
      }
      const uri = await nativeReport();
      if (kind === "view") {
        setPdfURI(uri);
        await Linking.openURL(uri);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Передать ${active.title}`,
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      } else {
        throw new Error("Передача файлов недоступна на этом устройстве");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось подготовить PDF";
      if (!/cancel|abort/i.test(message)) onError(message);
    } finally {
      setExporting(null);
    }
  }
  return (
    <>
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={["top"]} style={s.fullScreenModal}>
        <View style={s.fullScreenInner}>
          <View style={s.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{date(active.created_at)}</Text>
              <Text style={s.cardTitle}>{active.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              hitSlop={10}
              style={s.iconButton}
              onPress={onClose}
            >
              <Ionicons name="arrow-back" size={25} />
            </Pressable>
          </View>
          <ScrollView
            style={s.detailScroll}
            contentContainerStyle={[
              s.detailBody,
              compact && s.detailBodyCompact,
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {active.markers.length ? (
              active.markers.map((m, i) => (
                <View
                  key={`${m.name}-${i}`}
                  style={[
                    s.markerTableRow,
                    (m.status === "high" || m.status === "low") && s.markerTableRowAlert,
                  ]}
                >
                  <Text numberOfLines={2} style={s.markerTableName}>{m.name}</Text>
                  <Text numberOfLines={1} style={s.markerTableValue}>{m.value ?? m.text_value} {m.unit}</Text>
                  <Text numberOfLines={2} style={s.markerTableReference}>
                    {m.reference_text ||
                        [m.reference_min, m.reference_max]
                          .filter((x) => x !== undefined)
                          .join(" — ") ||
                        "—"}
                  </Text>
                </View>
              ))
            ) : (
              <Empty
                icon="scan-outline"
                title="Показатели не распознаны"
                text="Проверьте качество снимка или добавьте более чёткий файл."
              />
            )}
          </ScrollView>
          {compact && review ? <View style={s.detailSummaryBox}><Text numberOfLines={7} style={s.detailSummaryText}>{review}</Text></View> : null}
          <View style={[s.detailFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={s.actionRow}>
              <Action
                icon="share-outline"
                label="Передать"
                busy={exporting === "share"}
                disabled={!!exporting}
                onPress={() => void performReportAction("share")}
              />
              <Action icon="document-text-outline" label="Просмотр" busy={exporting === "view"} disabled={!!exporting} onPress={() => void performReportAction("view")}/>
              {Platform.OS === "web" && !compact && <Action icon="print-outline" label="Печать" busy={exporting === "print"} disabled={!!exporting} onPress={() => void performReportAction("print")}/>}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
    <Modal visible={!!pdfURI} animationType="slide" onRequestClose={()=>setPdfURI("")}>
      <SafeAreaView style={s.pdfViewerPage}>
        <View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={()=>setPdfURI("")}><Ionicons name="arrow-back" size={25}/></Pressable><Text numberOfLines={1} style={s.fullScreenTitle}>PDF · {active.title}</Text><View style={s.headerSpacer}/></View>
        {Platform.OS === "web" ? React.createElement("iframe", { src: pdfURI, title: `PDF ${active.title}`, style: { flex: 1, width: "100%", height: "100%", border: 0, backgroundColor: "#F6F4FA" } }) : <View style={s.nativePdfReturn}><Ionicons name="document-text-outline" size={58} color={colors.violet}/><Text style={s.cardTitle}>PDF открыт в просмотрщике устройства</Text><Text style={s.cardHint}>После возврата в Lab HEALTH нажмите стрелку назад, чтобы закрыть просмотр.</Text><Button label="Открыть PDF ещё раз" icon="open-outline" onPress={()=>void Linking.openURL(pdfURI)}/></View>}
      </SafeAreaView>
    </Modal>
    </>
  );
}

function SupportChat({ onBack, compact = false }: { onBack: () => void; compact?: boolean }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [textValue, setTextValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!value || busy) return;
    setBusy(true);
    try {
      const created = await api.sendSupportMessage(value);
      setMessages((current) => [...current, created]);
      setTextValue("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      Alert.alert("Не удалось отправить", error instanceof Error ? error.message : "Ошибка");
    } finally { setBusy(false); }
  }
  const visibleMessages = searchValue.trim() ? messages.filter((message) => message.text.toLocaleLowerCase("ru-RU").includes(searchValue.trim().toLocaleLowerCase("ru-RU"))) : messages;
  return <KeyboardAvoidingView testID="support-page" behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.supportPage, compact && s.supportPageCompact]}>
    <View style={s.supportHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={onBack} style={s.supportHeaderButton}><Ionicons name="arrow-back" size={27} color={colors.ink}/></Pressable><Text style={s.supportTitle}>Чат с Lab HEALTH</Text><Pressable accessibilityRole="button" accessibilityLabel="Поиск по сообщениям" onPress={()=>setSearchOpen((value)=>!value)} style={s.supportHeaderButton}><Ionicons name={searchOpen?"close":"search"} size={26} color={colors.ink}/></Pressable></View>
    {searchOpen && <View style={s.supportSearch}><Ionicons name="search" size={19} color={colors.muted}/><TextInput autoFocus style={s.supportSearchInput} placeholder="Поиск в чате" value={searchValue} onChangeText={setSearchValue}/></View>}
    <ScrollView ref={listRef} style={{flex:1}} contentContainerStyle={s.supportMessages} onContentSizeChange={() => listRef.current?.scrollToEnd({animated:false})}>
      {loading ? <ActivityIndicator color={colors.aqua}/> : !messages.length ? <View style={s.supportEmpty}><View style={s.supportMark}><View style={s.supportMarkBack}/><View style={s.supportMarkFront}><Ionicons name="chatbox-ellipses" size={54} color={colors.white}/></View></View><Text style={s.supportEmptyTitle}>Это чат с Lab HEALTH</Text><Text style={s.supportEmptyText}>Задайте вопрос о приложении, загрузке анализов или доступе к медицинским данным</Text><View style={s.supportTopics}><View style={s.supportTopic}><Ionicons name="document-text-outline" size={24} color={colors.aqua}/></View><View style={s.supportTopic}><Ionicons name="shield-checkmark-outline" size={24} color={colors.aqua}/></View><View style={s.supportTopic}><Ionicons name="help-circle-outline" size={25} color={colors.aqua}/></View></View></View> : visibleMessages.map((message) => <View key={message.id} style={[s.messageBubble,message.sender === "patient" ? s.userBubble : s.assistantBubble,s.supportBubble]}><Text style={[s.body,message.sender === "patient" && {color:colors.white}]}>{message.text}</Text><Text style={[s.messageTime,message.sender === "patient" && {color:"#FFFFFFAA"}]}>{new Date(message.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text></View>)}
    </ScrollView>
    <View style={s.supportComposer}><View style={s.supportComposerIcon}><Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.ink}/></View><TextInput multiline maxLength={4000} style={[s.chatInput,s.supportInput]} placeholder="Ваш вопрос" value={textValue} onChangeText={setTextValue}/><Pressable accessibilityRole="button" accessibilityLabel="Отправить" disabled={busy||!textValue.trim()} style={[s.sendButton,(busy||!textValue.trim())&&s.supportSendDisabled]} onPress={()=>void send()}>{busy?<ActivityIndicator size="small" color={colors.white}/>:<Ionicons name="arrow-up" size={22} color={colors.white}/>}</Pressable></View>
  </KeyboardAvoidingView>;
}

function Sidebar({
  user,
  tab,
  onTab,
}: {
  user: User;
  tab: Tab;
  onTab: (x: Tab) => void;
}) {
  return (
    <View style={s.sidebar}>
      <View style={s.brand}>
        <View style={s.logo}>
          <Ionicons name="pulse" size={24} color="#fff" />
        </View>
        <Text style={s.brandText}>lab</Text>
      </View>
      <View style={s.nav}>
        {tabsFor(user.role).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            onPress={() => onTab(t)}
            style={[s.navItem, tab === t && s.navActive]}
          >
            <Ionicons
              name={user.role === "patient" && t === "profile" ? "chatbubble-ellipses-outline" : icon[t]}
              size={22}
              color={tab === t ? colors.brand : colors.muted}
            />
            <Text style={[s.navText, tab === t && { color: colors.brand }]}>
              {user.role === "patient" && t === "profile" ? "Чат" : labels[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.sidebarUser}>
        <Text style={s.sidebarName} numberOfLines={1}>
          {user.full_name}
        </Text>
        <Text style={s.analysisMeta}>
          {user.role === "doctor" ? user.specialization : "Пользователь"}
        </Text>
      </View>
    </View>
  );
}
function Bottom({ role, tab, onTab }: { role: Role; tab: Tab; onTab: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const tabs = tabsFor(role);
  const activeIndex = Math.max(0, tabs.indexOf(tab));
  const [navWidth, setNavWidth] = useState(0);
  const dropX = useRef(new Animated.Value(0)).current;
  const itemWidth = navWidth > 0 ? (navWidth - 14 - 2 * (tabs.length - 1)) / tabs.length : 0;
  useEffect(() => {
    if (!navWidth) return;
    Animated.spring(dropX, {
      toValue: activeIndex * (itemWidth + 2),
      damping: 15,
      stiffness: 230,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, dropX, itemWidth, navWidth]);
  const dockInsets = Platform.OS === "web"
    ? ({ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6px)", height: 66 } as any)
    : { bottom: Math.max(14, insets.bottom + 6), height: 66 };
  return (
    <View nativeID="mobile-navigation" testID="bottom-nav" style={[s.bottom, dockInsets]} onLayout={(event)=>setNavWidth(event.nativeEvent.layout.width)}>
      {navWidth > 0 && <Animated.View pointerEvents="none" style={[s.bottomDrop,{width:Math.max(0,itemWidth),transform:[{translateX:dropX}]}]}/>}
      {tabs.map((t) => (
        <Pressable
          key={t}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === t }}
          style={({ pressed }) => [
            s.bottomItem,
            tab === t && s.bottomItemActive,
            pressed && { opacity: 0.68 },
          ]}
          onPress={() => onTab(t)}
        >
          <View style={[s.bottomIcon, tab === t && s.bottomIconActive]}><Ionicons
              name={role === "patient" && t === "profile" ? "chatbubble-ellipses-outline" : icon[t]}
              size={23}
              color={tab === t ? colors.brand : colors.muted}
            /></View>
          <Text style={[s.bottomText, tab === t && s.bottomTextActive]}>
            {role === "patient" && t === "profile" ? "Чат" : labels[t]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
function AvatarView({user,size=44}:{user:User;size?:number}){
  const url=api.avatarURL(user);const preset=user.avatar_preset;const presetIcon=(preset==="leaf"?"leaf":preset==="heart"?"heart":preset==="sun"?"sunny":"person") as keyof typeof Ionicons.glyphMap;
  return <View style={[s.avatarView,{width:size,height:size,borderRadius:size*.34}]}>{url?<Image source={{uri:url}} style={{width:size,height:size,borderRadius:size*.34}}/>:preset?<Ionicons name={presetIcon} size={size*.48} color={colors.violet}/>:<Text style={[s.avatarText,{fontSize:size*.32}]}>{initials(user.full_name)}</Text>}</View>
}
function MiniAction({label,onPress,icon}:{label:string;onPress:()=>void;icon?:keyof typeof Ionicons.glyphMap}){return <Pressable onPress={onPress} style={s.miniAction}>{icon&&<Ionicons name={icon} size={16} color={colors.brand}/>}<Text style={s.miniActionText}>{label}</Text></Pressable>}
function AIList({title,items}:{title:string;items?:string[]}){if(!items?.length)return null;return <View style={s.aiList}><Text style={s.replyLabel}>{title}</Text>{items.map((x,i)=><Text key={i} style={s.body}>• {x}</Text>)}</View>}
function Field(props: any) {
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
function Button({
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
  kind?: "ghost";
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
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={kind === "ghost" ? colors.brand : "#fff"}
        />
      )}
      <Text style={[s.buttonText, kind === "ghost" && { color: colors.brand }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Segment({
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
function Section({
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
function Empty({
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
function Source({
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
function Action({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
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
        <Ionicons name={icon} size={23} color={colors.brand} />
      )}
      <Text style={s.sourceText}>{label}</Text>
    </Pressable>
  );
}
function Status({ value }: { value: string }) {
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
function Banner({ text, onClose }: { text: string; onClose: () => void }) {
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
function Loading() {
  return (
    <LinearGradient colors={["#17214B","#3D367A","#146E78"]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.loading}>
      <SystemChrome dark background="#17214B" canvas="#146E78"/>
      <View style={s.loadingOrb}/><Ionicons name="shield-checkmark-outline" size={58} color="#92E4DA"/><Text style={s.loadingTitle}>Ваше здоровье под контролем</Text><ActivityIndicator color="#C6F4EE"/>
    </LinearGradient>
  );
}
const firstName = (x: string) => x.trim().split(/\s+/)[0] || x;
const initials = (x: string) =>
  x
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
const date = (x: string) =>
  new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(x));

const s = StyleSheet.create({
  safe: { flex: 1, width: "100%", backgroundColor: colors.paper, overflow: "hidden" },
  safeHome: { backgroundColor: "#17214B" },
  safeInner: { flex: 1, width: "100%", backgroundColor: "transparent" },
  shell: { flex: 1, width: "100%", flexDirection: "row", overflow: "hidden" },
  main: { flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden", position: "relative" },
  content: { flex: 1, minWidth: 0, maxWidth: "100%" },
  top: {
    height: 58,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topCompact: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.paper,
  },
  homeTop: { backgroundColor: "#17214B", borderBottomWidth: 0 },
  homeTopText: { color: "#D9E3FF" },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.brand,
  },
  eyebrowCompact: { fontSize: 9, letterSpacing: 1.2 },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  pageTitleCompact: { fontSize: 23, letterSpacing: -0.4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCompact: { width: 40, height: 40, borderRadius: 14 },
  avatarText: { fontWeight: "800", color: colors.brand },
  sidebar: {
    width: 245,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    padding: 24,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 44,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1,
  },
  nav: { gap: 8 },
  navItem: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
  },
  navActive: { backgroundColor: colors.mint },
  navText: { fontSize: 15, fontWeight: "600", color: colors.muted },
  sidebarUser: {
    marginTop: "auto",
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sidebarName: { fontWeight: "700", color: colors.ink },
  bottom: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 100,
    height: 66,
    overflow: "hidden",
    flexDirection: "row",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    paddingHorizontal: 7,
    paddingTop: 3,
    gap: 2,
    backgroundColor: "rgba(245,249,251,0.70)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    shadowColor: "#315F73",
    shadowOpacity: .13,
    shadowRadius: 16,
    shadowOffset: {width:0,height:7},
    elevation: 10,
    ...(Platform.OS === "web" ? {
      backdropFilter: "blur(18px) saturate(1.35)",
      WebkitBackdropFilter: "blur(18px) saturate(1.35)",
      boxShadow: "0 7px 24px rgba(24,61,78,0.13), inset 0 1px 0 rgba(255,255,255,0.78)",
    } : {}),
  },
  bottomDrop: {
    position: "absolute",
    left: 7,
    top: 3,
    bottom: 3,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(255,255,255,0.22)",
    shadowColor: "#2E667D",
    shadowOffset: {width:0,height:5},
    shadowOpacity: .18,
    shadowRadius: 10,
    elevation: 5,
    ...(Platform.OS === "web" ? {
      backdropFilter: "blur(14px) saturate(1.8) contrast(1.06)",
      WebkitBackdropFilter: "blur(14px) saturate(1.8) contrast(1.06)",
      boxShadow: "0 4px 15px rgba(22,67,88,0.16), inset 0 1px 0 rgba(255,255,255,0.90)",
    } : {}),
  },
  bottomItem: {
    flex: 1,
    zIndex: 2,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bottomItemActive: { backgroundColor: "transparent" },
  bottomIcon: { minWidth: 42, height: 31, paddingHorizontal: 10, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  bottomIconActive: { backgroundColor: "transparent", transform: [{scale:1.04}] },
  bottomText: { fontSize: 10, lineHeight: 14, fontWeight: "700", color: colors.muted },
  bottomTextActive: { color: colors.brand },
  scroll: {
    padding: 28,
    paddingBottom: 110,
    gap: 24,
    maxWidth: 1180,
    width: "100%",
    alignSelf: "center",
  },
  scrollCompact: { padding: 16, paddingTop: 12, paddingBottom: 28, gap: 20 },
  welcome: {
    borderRadius: 28,
    padding: 30,
    flexDirection: "row",
    overflow: "hidden",
  },
  welcomeCompact: { borderRadius: 22, padding: 20 },
  welcomeOver: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#A9D9C7",
  },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
    marginTop: 8,
    letterSpacing: -0.7,
  },
  welcomeTitleCompact: { fontSize: 25, lineHeight: 30, marginTop: 7 },
  welcomeText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#D6E7E0",
    maxWidth: 630,
    marginTop: 9,
    marginBottom: 20,
  },
  welcomeTextCompact: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  welcomeMark: {
    width: 130,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF12",
    borderRadius: 65,
  },
  welcomeOrb: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -105,
    backgroundColor: "#A78BFA28",
  },
  section: { gap: 14 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.ink },
  sectionIntro: { fontSize: 15, color: colors.muted },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
  },
  analysesIntroCompact: { alignItems: "flex-start", flexWrap: "wrap" },
  link: { color: colors.brand, fontWeight: "700" },
  cardGrid: { gap: 12 },
  analysisCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderWidth: 1,
    borderColor: colors.line,
    width: "100%",
    maxWidth: 540,
    ...shadow,
  },
  analysisCardReady: {
    borderLeftWidth: 4,
    borderLeftColor: colors.aqua,
    backgroundColor: "#FCFEFE",
  },
  analysisCardReview: {
    borderLeftWidth: 4,
    borderLeftColor: colors.violet,
    backgroundColor: "#FDFCFF",
  },
  analysisCardAlert: {
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
    backgroundColor: "#FFFCFC",
  },
  analysisIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  analysisMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    marginTop: 8,
  },
  pillOk: { backgroundColor: colors.mint },
  pillWarn: { backgroundColor: colors.amberSoft },
  pillText: { fontSize: 11, fontWeight: "700", color: colors.brand },
  openResult: {
    marginTop: 9,
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  analysisCardActions: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCardButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.coralSoft,
  },
  empty: {
    padding: 42,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 420,
    marginTop: 5,
  },
  authOuter: { flex: 1, backgroundColor: colors.paper },
  authScreen: { flex: 1, width: "100%", overflow: "hidden", backgroundColor: "transparent" },
  authWelcome: { flex: 1, width: "100%", maxWidth: 620, alignSelf: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 150, paddingBottom: 38 },
  authWelcomeCopy: { gap: 12, maxWidth: 520 },
  authWelcomeTitle: { color: colors.white, fontSize: 34, lineHeight: 40, fontWeight: "900", letterSpacing: -1 },
  authWelcomeSlogan: { color: "#D7E7EA", fontSize: 19, lineHeight: 27, fontWeight: "600", maxWidth: 420 },
  authWelcomeActions: { width: "100%", maxWidth: 430, alignSelf: "center", gap: 10 },
  authLoginGlass: { minHeight: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF08", borderWidth: 1, borderColor: "#FFFFFF1C", ...(Platform.OS === "web" ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.09)" } : {}) },
  authLoginGlassText: { color: colors.white, fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: .2 },
  authSwitchUser: { minHeight: 42, marginTop: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  authSwitchUserText: { color: "#DCE8F2", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  authSecondaryButton: { minHeight: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF18", borderWidth: 1, borderColor: "#FFFFFF28" },
  authSecondaryText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  authExistingButton: { minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  authExistingText: { color: "#D8E4FF", fontSize: 13, fontWeight: "700" },
  authPINScreen: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center", justifyContent: "center", paddingHorizontal: 20, paddingBottom: 22 },
  authLoginField: { width: "100%", marginBottom: 12 },
  authPINError: { color: "#FFD0D8", fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 9 },
  authAbout: { flex: 1, width: "100%", maxWidth: 620, alignSelf: "center", padding: 24, paddingTop: 58, gap: 22 },
  authAboutText: { color: "#D7E7EA", fontSize: 17, lineHeight: 27, maxWidth: 530 },
  authBack: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF14" },
  authRegisterScroll: { flex: 1, width: "100%" },
  authRegisterBody: { width: "100%", maxWidth: 540, alignSelf: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 74, gap: 5 },
  authRegisterPIN: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center", justifyContent: "center", paddingHorizontal: 20, paddingBottom: 22, gap: 13 },
  authRegisterHint: { color: "#D7E7EA", fontSize: 14, marginTop: 2, marginBottom: 18 },
  authOuterCompact: { backgroundColor: "#17214B" },
  authPage: { flex: 1, width: "100%", flexDirection: "row", backgroundColor: colors.paper },
  authPageCompact: {
    flexDirection: "column",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  authAside: {
    flex: 1,
    padding: 52,
    justifyContent: "center",
    overflow: "hidden",
  },
  authAsideCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 180,
    width: "100%",
    height: 180,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: "flex-start",
  },
  authOrbOne: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    right: -125,
    top: -115,
    backgroundColor: "#8B5CF63A",
  },
  authOrbTwo: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    left: -100,
    bottom: -90,
    backgroundColor: "#20C4B52C",
  },
  authLabSheet: { position: "absolute", width: 122, height: 76, padding: 13, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF13", borderWidth: 1, borderColor: "#FFFFFF20" },
  authLabSheetOne: { right: -24, top: 20, transform: [{rotate:"8deg"}] },
  authLabSheetTwo: { left: -34, top: 18, transform: [{rotate:"-9deg"}] },
  authLabLine: { width: 54, height: 5, borderRadius: 3, marginVertical: 3, backgroundColor: "#FFFFFF35" },
  authMedicalCross: { position: "absolute", right: 34, top: 178, width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#25AFA044" },
  authVersion: {
    position: "absolute",
    bottom: 11,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#A9D9C7",
  },
  authVersionCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 27,
    height: 27,
    paddingTop: 3,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#A9D9C7",
  },
  authHero: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -1.4,
    color: "#fff",
    maxWidth: 540,
    marginTop: 35,
  },
  authHeroCompact: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 12,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.8,
    marginTop: 0,
    maxWidth: 345,
  },
  authSub: {
    fontSize: 16,
    lineHeight: 25,
    color: "#C9E0D7",
    maxWidth: 520,
    marginTop: 18,
  },
  authPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 32,
  },
  authPointText: { color: "#E0EEE8", fontSize: 13 },
  authForm: { flexGrow: 1, justifyContent: "center", padding: 32 },
  authScrollCompact: { flex: 1, width: "100%", backgroundColor: "transparent" },
  authFormCompact: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 22,
  },
  authFormLoginCompact: { paddingTop: 0 },
  authCard: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: colors.white,
    borderRadius: 26,
    padding: 30,
    ...shadow,
  },
  authCardCompact: {
    maxWidth: 520,
    borderRadius: 0,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  authTextLight: { color: colors.white },
  authHintLight: { color: "#CFD8EA" },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  cardHint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 7,
    marginBottom: 18,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.paper,
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
  },
  segmentOnDark: { backgroundColor: "#FFFFFF12", borderWidth: 1, borderColor: "#FFFFFF20" },
  segmentItem: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 10,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentActiveOnDark: { backgroundColor: "#FFFFFF20", shadowOpacity: 0, elevation: 0 },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segmentTextOnDark: { color: "#C7D1E7" },
  field: { gap: 7, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink },
  labelOnDark: { color: "#F3F6FF" },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FBFCFA",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  inputOnDark: {
    borderColor: "#FFFFFF30",
    backgroundColor: "#FFFFFF16",
    color: colors.white,
  },
  button: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
  },
  buttonCompact: { alignSelf: "flex-start", minHeight: 44 },
  buttonGhost: { backgroundColor: colors.mint, marginTop: 26 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  switchText: {
    textAlign: "center",
    color: colors.brand,
    fontWeight: "700",
  },
  switchTextOnDark: { color: "#D8E4FF" },
  pinBlock: { width: "100%", marginBottom: 12 },
  pinDotsRow: { width: "100%", minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 13 },
  pinDots: { height: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 19 },
  pinRevealRow: { width: "100%", maxWidth: 380, minHeight: 64, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 13 },
  pinDigits: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  pinDigit: { width: 29, color: colors.white, fontSize: 30, lineHeight: 37, fontWeight: "800", textAlign: "center" },
  pinEraseButton: { position: "absolute", right: -2, width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF16", borderWidth: 1, borderColor: "#FFFFFF24" },
  pinDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, backgroundColor: "transparent" },
  pinDotOnDark: { borderColor: "#FFFFFF78" },
  pinDotFilled: { borderColor: colors.aqua, backgroundColor: colors.aqua },
  pinGrid: { width: "100%", maxWidth: 380, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  pinKey: { width: "31%", height: 68, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  pinKeyOnDark: { backgroundColor: "#FFFFFF10", borderWidth: 1, borderColor: "#FFFFFF17" },
  pinKeyText: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "600" },
  pinUtility: { gap: 3, backgroundColor: "transparent" },
  pinUtilityDisabled: { opacity: .72 },
  pinUtilityText: { color: "#E1E9F6", fontSize: 12, fontWeight: "800" },
  pinUtilityTextDisabled: { color: "#FFFFFF64", fontSize: 10, fontWeight: "700" },
  textButton: {
    minHeight: 48,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  authTextButtonCompact: { minHeight: 36, marginTop: 2 },
  linkButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: colors.red, fontSize: 13, marginBottom: 12 },
  banner: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.redSoft,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bannerText: { color: colors.red, flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#07150F88",
    justifyContent: "flex-end",
  },
  uploadSheet: {
    backgroundColor: colors.white,
    padding: 25,
    paddingBottom: 35,
    maxWidth: 820,
    width: "100%",
    flex: 1,
    alignSelf: "center",
  },
  uploadSheetCompact: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: 20,
  },
  sourceRow: { flexDirection: "row", gap: 10, marginVertical: 12 },
  source: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sourceText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  fileChosen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.mint,
    padding: 13,
    borderRadius: 14,
    marginBottom: 14,
  },
  progressPanel: {
    padding: 14,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  progressLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  progressPercent: { fontSize: 13, fontWeight: "800", color: colors.brand },
  progressTrack: {
    height: 9,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  progressFill: { height: "100%", borderRadius: 5 },
  progressHint: { marginTop: 8, fontSize: 11, color: colors.muted },
  detailSheet: {
    backgroundColor: colors.white,
    maxWidth: 850,
    width: "100%",
    height: "94%",
    alignSelf: "center",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  detailHeader: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
  },
  detailScroll: { flex: 1 },
  detailBody: { padding: 24, paddingBottom: 32 },
  detailBodyCompact: { padding: 16, paddingBottom: 24 },
  detailFooter: {
    paddingHorizontal: 16,
    paddingTop: 11,
    backgroundColor: colors.paper,
  },
  detailSummaryBox: { maxHeight: 144, marginHorizontal: 14, marginTop: 8, padding: 13, borderRadius: 17, backgroundColor: colors.violetSoft, borderWidth: 1, borderColor: "#DDD8F5" },
  detailSummaryText: { color: colors.ink, fontSize: 12, lineHeight: 17 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  pressablePressed: {
    opacity: 0.72,
    backgroundColor: colors.mint,
  },
  body: { fontSize: 14, lineHeight: 21, color: colors.ink },
  detailSection: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 25,
    marginBottom: 10,
  },
  marker: {
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markerCompact: {
    alignItems: "flex-start",
    paddingVertical: 12,
    flexWrap: "wrap",
  },
  markerResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 1,
  },
  markerResultCompact: {
    width: "100%",
    justifyContent: "space-between",
  },
  markerName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  markerValue: { fontSize: 15, fontWeight: "800", color: colors.ink },
  markerTableRow: { minHeight: 45, paddingHorizontal: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center" },
  markerTableRowAlert: { backgroundColor: colors.coralSoft, borderRadius: 10, borderBottomColor: "transparent" },
  markerTableName: { width: "42%", paddingRight: 7, color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  markerTableValue: { width: "29%", textAlign: "center", color: colors.ink, fontSize: 13, fontWeight: "800" },
  markerTableReference: { width: "29%", paddingLeft: 5, textAlign: "right", color: colors.muted, fontSize: 11, lineHeight: 15 },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.mint,
  },
  statusBad: { backgroundColor: colors.amberSoft },
  statusText: { fontSize: 10, fontWeight: "800", color: colors.brand },
  actionRow: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionDisabled: { opacity: 0.58 },
  doctorChip: {
    minWidth: 220,
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  doctorChipActive: { borderColor: colors.brand, backgroundColor: colors.mint },
  smallAvatar: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  smallAvatarText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  doctorName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  replyInput: {
    height: 85,
    textAlignVertical: "top",
    paddingTop: 12,
    marginVertical: 12,
  },
  consultCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  consultStatus: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
  },
  consultQuestion: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 14,
  },
  replyBox: {
    backgroundColor: colors.mint,
    padding: 15,
    borderRadius: 14,
    marginTop: 14,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    marginBottom: 5,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 15,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.mint,
    marginTop: 8,
  },
  roleText: { fontSize: 12, fontWeight: "700", color: colors.brand },
  verifyNote: {
    maxWidth: 520,
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.amberSoft,
    padding: 14,
    borderRadius: 14,
    marginTop: 22,
  },
  verifyText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.amber },
  registrationVitals: { width: "100%", flexDirection: "column", gap: 2 },
  analysisPage: { flex: 1, minWidth: 0, backgroundColor: colors.paper },
  analysisScrollContent: { paddingBottom: 112 },
  uploadDock: { position: "absolute", left: 16, right: 16, bottom: 102, maxWidth: 520, alignSelf: "center", padding: 7, borderRadius: 20, backgroundColor: "#FFFFFFF2", ...shadow },
  uploadDockWeb: { bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" } as any,
  patientHome: { flex: 1, width: "100%", maxWidth: 920, alignSelf: "center", overflow: "hidden", backgroundColor: "transparent" },
  patientHomeCompact: { maxWidth: "100%" },
  patientWelcome: { minHeight: 238, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 42, justifyContent: "center", gap: 15 },
  patientWelcomeCompact: { minHeight: 222, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34, gap: 11 },
  welcomeIdentity: { flexDirection: "row", alignItems: "center", gap: 11 },
  profileGlyph: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
  homeDiscovery: { flex: 1, minHeight: 0, marginTop: -24, padding: 20, paddingBottom: 24, gap: 14, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: "#F3F4FA", overflow: "hidden" },
  homeDiscoveryCompact: { padding: 12, paddingTop: 14, paddingBottom: 110, gap: 11, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  homeUpdates: { gap: 9 },
  homeUpdateMain: { minHeight: 70, padding: 11, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.violetSoft },
  homeUpdateOnGradient: { backgroundColor: "#FFFFFFF2", borderColor: "#FFFFFF4A" },
  homeUpdateAlert: { backgroundColor: "#FFF7F5", borderColor: "#F6D3CC" },
  homeUpdateIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  homeUpdateIconAlert: { backgroundColor: colors.coralSoft },
  homeUpdateTitle: { color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  homeUpdateText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  homeReminderList: { flexDirection: "row", gap: 8 },
  homeReminder: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 15, backgroundColor: "#FFFFFFF2" },
  homeReminderLabel: { color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  homeReminderText: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "700", marginTop: 1 },
  wellnessCardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  wellnessIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.violetSoft },
  wellnessTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  wellnessSubtitle: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
  nutritionHomeCard: { minHeight: 160, borderRadius: 24, padding: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, ...shadow },
  foodInfographic: { flexDirection: "row", gap: 8, marginTop: 16 },
  foodPart: { flex: 1, minHeight: 68, borderRadius: 16, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  foodValue: { fontSize: 18, fontWeight: "900" },
  foodLabel: { fontSize: 11, color: colors.muted },
  homeMediaCard: { flex: 1, minHeight: 0, borderRadius: 24, overflow: "hidden", backgroundColor: colors.brandDark, ...shadow },
  homeMediaImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", resizeMode: "cover" },
  videoOverlay: { ...StyleSheet.absoluteFillObject, padding: 17, flexDirection: "row", alignItems: "flex-end" },
  videoEyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: "900", color: "#C9D6FF" },
  videoTitle: { fontSize: 23, fontWeight: "900", color: colors.white, marginTop: 4 },
  videoSubtitle: { color: "#EEF3FF", fontSize: 14, marginTop: 3 },
  videoArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF24", alignItems: "center", justifyContent: "center" },
  wellnessSheet: { width: "100%", maxWidth: 720, maxHeight: "92%", alignSelf: "center", marginTop: "auto", backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  wellnessBody: { gap: 15, paddingVertical: 18, paddingBottom: 40 },
  profileInsight: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: colors.blueSoft, borderRadius: 15, padding: 13 },
  surveyTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  choiceActive: { backgroundColor: colors.blueSoft, borderColor: colors.brand },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  choiceTextActive: { color: colors.brand },
  surveyScale: { gap: 8 },
  aiRecommendation: { padding: 17, borderRadius: 18, backgroundColor: colors.violetSoft, gap: 10 },
  aiRecommendationHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDisclaimer: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  reviewTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  healthSummary: { padding: 17, borderRadius: 19, backgroundColor: colors.aquaSoft, borderLeftWidth: 4, borderLeftColor: colors.aqua, gap: 8 },
  healthSummaryAlert: { backgroundColor: colors.coralSoft, borderLeftColor: colors.coral },
  healthSummaryHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  specialtyLine: { color: colors.brand, fontSize: 12, fontWeight: "700", marginTop: 7 },
  analysisGroups: { gap: 22 },
  analysisGroup: { gap: 10 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  groupCount: { minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, textAlign: "center", borderRadius: 10, overflow: "hidden", backgroundColor: colors.blueSoft, color: colors.brand, fontWeight: "800", fontSize: 11 },
  compactCardGrid: { gap: 10 },
  dynamicsScreen: { gap: 14 },
  dynamicFilters: { gap: 8, paddingVertical: 3, paddingRight: 12 },
  dynamicSort: { minHeight: 43, paddingHorizontal: 15, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.ink },
  dynamicSortText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  dynamicCards: { gap: 11 },
  dynamicMarkerCard: { minHeight: 132, padding: 16, borderRadius: 25, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: colors.line, ...shadow },
  dynamicMiniChart: { width: 78, height: 82, flexDirection: "row", alignItems: "flex-end", gap: 7 },
  dynamicMiniTrack: { flex: 1, height: 82, borderRadius: 12, overflow: "hidden", justifyContent: "flex-end", backgroundColor: "#EEF4F4" },
  dynamicMiniBar: { width: "100%", minHeight: 16, borderRadius: 12, backgroundColor: colors.aqua },
  dynamicMiniBarAlert: { backgroundColor: colors.coral },
  dynamicMarkerCopy: { flex: 1, minWidth: 0, gap: 5 },
  dynamicCardDate: { color: colors.muted, fontSize: 12 },
  dynamicCardTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: "600" },
  dynamicCardValue: { fontWeight: "900" },
  dynamicCardReference: { color: colors.aqua, fontSize: 12, fontWeight: "700" },
  dynamicCardArrow: { width: 42, height: 50, borderRadius: 15, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  dynamicDetailBody: { width: "100%", maxWidth: 820, alignSelf: "center", padding: 18, paddingBottom: 100, gap: 18 },
  dynamicCurrent: { minHeight: 94, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, ...shadow },
  dynamicCurrentValue: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  dynamicHistoryTitle: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 4 },
  dynamicHistory: { borderRadius: 23, overflow: "hidden", backgroundColor: colors.white, ...shadow },
  dynamicHistoryRow: { minHeight: 78, paddingHorizontal: 17, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  dynamicHistoryDate: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  dynamicHistoryStatus: { color: colors.aqua, fontSize: 11, marginTop: 5 },
  dynamicHistoryValue: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  chartCard: { minHeight: 285, padding: 16, borderRadius: 24, backgroundColor: colors.white, ...shadow },
  chartBars: { minHeight: 230, minWidth: "100%", flexDirection: "row", alignItems: "flex-end", gap: 18, paddingHorizontal: 10 },
  chartColumn: { alignItems: "center", justifyContent: "flex-end", width: 66 },
  chartValue: { fontSize: 11, fontWeight: "800", color: colors.ink, marginBottom: 5 },
  chartBar: { width: 34, minHeight: 30, borderRadius: 13, backgroundColor: colors.aqua },
  chartBarAlert: { backgroundColor: colors.coral },
  chartDate: { fontSize: 9, color: colors.muted, marginTop: 7, textAlign: "center" },
  chartUnit: { textAlign: "center", fontSize: 11, color: colors.muted, marginTop: 8 },
  analysisSummary: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  analysisStateText: { color: colors.aqua, fontWeight: "800", fontSize: 11, marginTop: 6 },
  autoTitleHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.blueSoft, padding: 12, borderRadius: 13 },
  complaintComposer: { borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.violetSoft, padding: 14, ...shadow },
  complaintComposerExpanded: { borderColor: colors.violet },
  complaintPrompt: { flexDirection: "row", alignItems: "center", gap: 11 },
  complaintIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.violetSoft },
  complaintTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  complaintPlaceholder: { color: colors.muted, fontSize: 12, marginTop: 2 },
  complaintInput: { minHeight: 130, marginTop: 15, textAlignVertical: "top", paddingTop: 13 },
  complaintActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 },
  micButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.violetSoft },
  micButtonActive: { backgroundColor: colors.violet },
  micText: { fontSize: 12, fontWeight: "800", color: colors.violet },
  aiConsultCard: { borderLeftWidth: 4, borderLeftColor: colors.violet, backgroundColor: "#FEFCFF" },
  doctorConsultCard: { borderLeftWidth: 4, borderLeftColor: colors.aqua },
  consultType: { flexDirection: "row", alignItems: "center", gap: 6 },
  consultCardTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 12 },
  doctorSearch: { minHeight: 54, borderRadius: 17, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  doctorSearchInput: { flex: 1, minWidth: 0, fontSize: 16, color: colors.ink, outlineStyle: "none" } as any,
  doctorGrid: { gap: 11 },
  doctorDirectoryCard: { minHeight: 86, padding: 15, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 13, ...shadow },
  doctorAvatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  doctorDirectoryName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  doctorOptions: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  doctorOption: { fontSize: 10, fontWeight: "800", color: colors.brand, backgroundColor: colors.blueSoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  doctorRequestSheet: { width: "100%", maxWidth: 680, maxHeight: "88%", alignSelf: "center", marginTop: "auto", backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 17 },
  serviceButtons: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  profileVitals: { width: "100%", gap: 13, marginBottom: 18 },
  profileHeader: { minHeight: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper },
  profileBack: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  profileScreen: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 22, paddingTop: 10, paddingBottom: 124 },
  profileIdentity: { minHeight: 94, flexDirection: "row", alignItems: "center", gap: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  profileIdentityIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.violetSoft },
  profileIdentityName: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  profileIdentityRole: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  profileSectionTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: "900", marginTop: 28, marginBottom: 6 },
  profileLine: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  profileLineLabel: { width: "38%", color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  profileLineValue: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  profileLineInput: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 0, color: colors.ink, fontSize: 16, fontWeight: "700", outlineStyle: "none", backgroundColor: "transparent" } as any,
  profileLineSuffix: { color: colors.muted, fontSize: 13, marginLeft: 6 },
  profileInfoLine: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.line },
  profileInfoLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  profileInfoValue: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  profileSave: { marginTop: 30, marginBottom: 20 },
  bmiCard: { width: "100%", borderRadius: 16, padding: 14, backgroundColor: colors.aquaSoft },
  bmiValue: { fontSize: 19, fontWeight: "900", color: colors.aqua },
  patientRecord: { borderRadius: 22, padding: 20, backgroundColor: colors.blueSoft, gap: 6 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start" },
  clinicalNotice: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.amberSoft },
  consiliumResult: { borderRadius: 22, padding: 19, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 10, ...shadow },
  clinicalBlock: { gap: 3, marginTop: 8 },
  guidelineGrid: { gap: 11 },
  guidelineCard: { minHeight: 84, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, ...shadow },
  schedulePage: { flex: 1, padding: 18, gap: 12, maxWidth: 1280, width: "100%", alignSelf: "center" },
  schedulePageCompact: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 110 },
  doctorWelcome: { minHeight: 84, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  doctorWelcomeCompact: { minHeight: 74, borderRadius: 18, paddingHorizontal: 16 },
  doctorWelcomeTitle: { color: colors.white, fontSize: 21, fontWeight: "800", marginTop: 4 },
  scheduleEdit: { minHeight: 42, borderRadius: 14, backgroundColor: "#FFFFFF20", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 7 },
  scheduleEditText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  weekToolbar: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
  weekTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  editHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.violetSoft, borderRadius: 14, padding: 10 },
  calendarHorizontal: { flex: 1, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  calendarVertical: { maxHeight: 560 },
  calendarHeader: { height: 58, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  timeColumn: { width: 62, alignItems: "center", justifyContent: "center" },
  dayHeader: { width: 98, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.line },
  dayName: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  dayNumber: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  calendarRow: { minHeight: 54, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  timeText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  calendarCell: { width: 98, margin: 3, borderRadius: 10, borderLeftWidth: 1, borderLeftColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  availableCell: { backgroundColor: colors.aqua },
  bookedCell: { backgroundColor: colors.violet },
  cellText: { color: colors.muted, fontSize: 10, fontWeight: "800", textAlign: "center", padding: 3 },
  noteComposer: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16 },
  noteInput: { minHeight: 120, textAlignVertical: "top", paddingTop: 13, marginTop: 12 },
  noteCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderLeftWidth: 4, borderLeftColor: colors.aqua, ...shadow },
  aiChatCard: { minHeight: 92, padding: 15, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 13, ...shadow },
  aiChatIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.violet },
  aiWorkspaceHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  aiWorkspaceCopy: { flex: 1, minWidth: 220, maxWidth: 680, gap: 2 },
  chatPage: { flex: 1, backgroundColor: colors.paper },
  chatHeader: { minHeight: 68, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  chatTitleInput: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.ink, padding: 10 },
  messages: { padding: 16, gap: 10, maxWidth: 900, width: "100%", alignSelf: "center" },
  messageBubble: { maxWidth: "82%", borderRadius: 20, padding: 13 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.brand, borderBottomRightRadius: 6 },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: colors.white, borderBottomLeftRadius: 6, ...shadow },
  messageTime: { color: colors.muted, fontSize: 9, marginTop: 6, alignSelf: "flex-end" },
  chatComposer: { minHeight: 76, padding: 10, flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  chatInput: { flex: 1, minWidth: 0, maxHeight: 120, minHeight: 48, borderRadius: 17, backgroundColor: colors.paper, paddingHorizontal: 15, paddingVertical: 12, color: colors.ink, fontSize: 16, lineHeight: 21 },
  sendButton: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.violet, alignItems: "center", justifyContent: "center" },
  supportPage: { flex: 1, minHeight: 0, backgroundColor: colors.paper },
  supportPageCompact: { paddingBottom: 106 },
  supportHeader: { minHeight: 74, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.paper },
  supportHeaderButton: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  supportTitle: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: "900" },
  supportSearch: { marginHorizontal: 16, marginBottom: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.paper },
  supportSearchInput: { flex: 1, minWidth: 0, fontSize: 16, color: colors.ink, outlineStyle: "none" } as any,
  supportMessages: { flexGrow: 1, padding: 16, paddingBottom: 24, gap: 10, maxWidth: 900, width: "100%", alignSelf: "center", justifyContent: "flex-end" },
  supportBubble: { minWidth: 92 },
  supportEmpty: { flex: 1, minHeight: 430, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, paddingBottom: 18 },
  supportMark: { width: 158, height: 132, marginBottom: 26 },
  supportMarkBack: { position: "absolute", left: 8, top: 0, width: 98, height: 82, borderRadius: 27, backgroundColor: "#DDF6F8" },
  supportMarkFront: { position: "absolute", right: 0, bottom: 0, width: 112, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.aqua, ...shadow },
  supportEmptyTitle: { color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: "900", textAlign: "center" },
  supportEmptyText: { maxWidth: 420, color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: "center", marginTop: 10 },
  supportTopics: { flexDirection: "row", gap: 12, marginTop: 22 },
  supportTopic: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6F6" },
  supportLogoutText: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 22 },
  supportComposer: { minHeight: 76, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  supportComposerIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F6F6" },
  supportInput: { borderWidth: 1.5, borderColor: "#BAC7C8", backgroundColor: colors.white },
  supportSendDisabled: { opacity: 0, width: 0, marginLeft: -8 },
  directBookingLoader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  pdfViewerPage: { flex: 1, backgroundColor: colors.paper },
  nativePdfReturn: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 16 },
  guidePublished: { color: colors.aqua, fontSize: 10, fontWeight: "800", marginTop: 5 },
  guideReader: { flex: 1, backgroundColor: colors.paper },
  guideBody: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 80, gap: 18 },
  guideContents: { borderRadius: 22, padding: 18, backgroundColor: colors.white, gap: 8, ...shadow },
  contentsRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  contentsNumber: { width: 28, color: colors.violet, fontSize: 12, fontWeight: "900" },
  contentsTitle: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  guideSection: { borderRadius: 22, padding: 20, backgroundColor: colors.white, ...shadow },
  guideSectionTitle: { color: colors.ink, fontSize: 21, lineHeight: 27, fontWeight: "900", marginBottom: 14 },
  guideText: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  backToContents: { minHeight: 44, marginTop: 18, flexDirection: "row", gap: 7, alignItems: "center", alignSelf: "flex-start" },
  webModalRoot: { position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999, backgroundColor: colors.paper } as any,
  fullScreenModal: { flex: 1, backgroundColor: colors.paper },
  fullScreenInner: { flex: 1, width: "100%", maxWidth: 1100, alignSelf: "center", backgroundColor: colors.paper },
  fullScreenHeader: { minHeight: 62, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  fullScreenTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.ink },
  headerSpacer: { width: 44, height: 44 },
  fullScreenBody: { width: "100%", maxWidth: 820, alignSelf: "center", padding: 18, paddingBottom: 90, gap: 16 },
  largeComposer: { minHeight: 240 },
  avatarView: { backgroundColor: colors.violetSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  miniAction: { minHeight: 34, paddingHorizontal: 9, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: colors.blueSoft },
  miniActionText: { fontSize: 10, fontWeight: "800", color: colors.brand },
  doctorActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  consultList: { gap: 7 },
  consultRow: { minHeight: 58, paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  consultRowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  pastCell: { backgroundColor: "#EEF0F3", opacity: .48 },
  healthInfoButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.violetSoft, borderRadius: 18, padding: 14 },
  doctorProfileHero: { alignItems: "center", gap: 7, paddingVertical: 18 },
  doctorProfileActions: { gap: 10 },
  consentGroup: { gap: 9, marginVertical: 2 },
  consentRow: { minHeight: 48, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 11 },
  consentBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  consentBoxChecked: { borderColor: colors.brand, backgroundColor: colors.brand },
  consentLabel: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  consentTextButton: { flex: 1, minHeight: 42, justifyContent: "center" },
  consentOpen: { color: colors.brand, fontSize: 11, fontWeight: "700", marginTop: 2 },
  consentWarning: { position: "absolute", zIndex: 20, top: 10, left: 12, right: 12, maxWidth: 680, alignSelf: "center", padding: 15, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.amberSoft, ...shadow },
  consentWarningHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  consentWarningTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  consentWarningText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 7 },
  consentWarningActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 11 },
  legalBody: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 22, paddingBottom: 80 },
  legalText: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  verifiedText: { color: colors.aqua, fontWeight: "800", fontSize: 12 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotGroups: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  profileHero: { minHeight: 210, borderRadius: 26, padding: 22, alignItems: "center", justifyContent: "center", gap: 8 },
  profileHeroName: { color: colors.white, fontSize: 22, fontWeight: "900", textAlign: "center" },
  profileHeroMeta: { color: "#DDE8F4", fontSize: 13, fontWeight: "700" },
  profilePhotoActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  presetRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  presetButton: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.violetSoft, alignItems: "center", justifyContent: "center" },
  presetButtonActive: { backgroundColor: colors.violet },
  aiSummaryCard: { borderRadius: 20, padding: 18, gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.violetSoft },
  aiList: { gap: 5 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    overflow: "hidden",
    backgroundColor: "#17214B",
  },
  loadingOrb: { position: "absolute", width: 360, height: 360, borderRadius: 180, right: -170, top: -120, backgroundColor: "#8B5CF63A" },
  loadingTitle: { maxWidth: 300, color: colors.white, fontSize: 27, lineHeight: 34, fontWeight: "900", textAlign: "center", letterSpacing: -.6 },
});
