import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, restoreToken, setToken } from "../api";
import { Analysis, Consultation, User } from "../types";
import { colors } from "../theme";
import { s } from "../styles";
import { Banner, Loading } from "../components/ui";
import { AmbientCanvas, AuthBackdrop, SystemChrome } from "../components/platform";
import { Bottom, Sidebar, Tab } from "../navigation/AppNavigation";
import { PROFILE_PROMPT_KEY } from "../config";
import { shouldPromptForProfile } from "../features/profile/utils";
import { DeletionPendingPrompt, Profile, ProfileCompletionModal, ProfileCompletionPrompt } from "../features/profile/Profile";
import { Auth } from "../features/auth/Auth";
import { AIWorkspace } from "../features/ai/AIWorkspace";
import { AnalysisDetail } from "../features/analyses/AnalysisDetail";
import { Analyses, isProcessingAnalysis } from "../features/analyses/AnalysesScreen";
import { Asset, UploadModal } from "../features/analyses/UploadAnalysis";
import { DoctorConsultationInbox, PatientDoctorChats } from "../features/chat/Chats";
import { AdminDashboard, AdminPreviewControl, Home } from "../features/home/HomeScreen";
import { ArticleManager, DoctorPatients, DoctorSchedule, DoctorsScreen } from "../features/clinic/ClinicScreens";






export default function App() {
  return <AppErrorBoundary><SafeAreaProvider><AppContent /></SafeAreaProvider></AppErrorBoundary>;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("Lab UI render failed", error);
  }

  private recover = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign("/");
      return;
    }
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={s.fatalScreen}>
      <AuthBackdrop/>
      <SafeAreaView style={s.fatalSafe}>
        <Ionicons name="refresh-circle-outline" size={52} color={colors.white}/>
        <Text style={s.fatalTitle}>Экран не загрузился</Text>
        <Text style={s.fatalText}>Вернитесь в приложение. Введённые и сохранённые данные не удалятся.</Text>
        <Pressable accessibilityRole="button" style={s.fatalAction} onPress={this.recover}><Text style={s.fatalActionText}>Продолжить</Text></Pressable>
      </SafeAreaView>
    </View>;
  }
}

function AppContent() {
  const [boot, setBoot] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [upload, setUpload] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [focusVisit, setFocusVisit] = useState<Consultation | null>(null);
  const [focusDoctorID, setFocusDoctorID] = useState("");
  const [profilePromptOpen, setProfilePromptOpen] = useState(false);
  const [profileCompletionOpen, setProfileCompletionOpen] = useState(false);
  const [adminSession, setAdminSession] = useState<{user:User;token:string}|null>(null);
	const analysesRef = useRef<Analysis[]>([]);
	const [jobNotice,setJobNotice]=useState<{analysis:Analysis;title:string;text:string}|null>(null);
	const [deletionNoticeHidden,setDeletionNoticeHidden]=useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const wideDesktop = width >= 1600;
  const compact = width < 640;
	useEffect(()=>{
		if(!user?.deletion_scheduled_for)return;
		setDeletionNoticeHidden(false);
		setProfilePromptOpen(false);
		setProfileCompletionOpen(false);
	},[user?.deletion_scheduled_for]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (window.location.pathname !== "/") window.history.replaceState({}, "", "/");
    const root = document.getElementById("root");
    const manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifest) manifest.href = "/manifest.webmanifest";
    const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (viewport) viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    // Keep the preboot canvas and the mounted application on the exact same
    // dynamic viewport geometry. This is the model used by Viewer on iOS PWA.
    const initialGradient = "linear-gradient(180deg, #17214B 0%, #40377C 54%, #176E78 100%)";
    Object.assign(document.documentElement.style, { width: "100%", height: "100%", minHeight: "100%", overflow: "hidden", overscrollBehavior: "none", backgroundColor: "#176E78", backgroundImage: initialGradient });
    Object.assign(document.body.style, { width: "100%", height: "100%", minHeight: "100%", margin: "0", overflow: "hidden", position: "fixed", inset: "0", overscrollBehavior: "none", backgroundColor: "#176E78", backgroundImage: initialGradient });
    if (root) Object.assign(root.style, { width: "100%", height: "100%", minHeight: "100%", overflow: "hidden", backgroundColor: "#176E78", backgroundImage: initialGradient });
  }, []);
  useEffect(()=>{analysesRef.current=analyses},[analyses]);
  const hasActiveOCRJobs=analyses.some(isProcessingAnalysis);
  useEffect(()=>{
	if(!user||user.role!=="patient"||!hasActiveOCRJobs)return;
	let disposed=false;
	let polling=false;
	const poll=async()=>{
		if(polling||disposed)return;
		polling=true;
		try{
			const latest=await api.analyses();
			if(disposed)return;
			const previous=new Map(analysesRef.current.map(item=>[item.id,item]));
			const finished=latest.find(item=>{const before=previous.get(item.id);return !!before&&isProcessingAnalysis(before)&&!isProcessingAnalysis(item)});
			setAnalyses(latest);
			setSelected(current=>current?(latest.find(item=>item.id===current.id)||current):current);
			if(finished){
				const success=finished.status==="awaiting_confirmation";
				setJobNotice({analysis:finished,title:success?"Анализ распознан":"Обработка завершена",text:success?"Проверьте показатели — результат уже доступен.":finished.processing_error||"Откройте анализ, чтобы выбрать следующее действие."});
			}
		}catch{}finally{polling=false}
	};
	void poll();
	const timer=setInterval(()=>void poll(),2500);
	return()=>{disposed=true;clearInterval(timer)};
  },[user?.id,user?.role,hasActiveOCRJobs]);
  useEffect(()=>{if(!jobNotice)return;const timer=setTimeout(()=>setJobNotice(null),12000);return()=>clearTimeout(timer)},[jobNotice]);
  async function refresh(u = user) {
    if (!u) return;
    if (u.role === "admin") {
      setAnalyses([]);
      setConsultations([]);
      return;
    }
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
      const minimumSplash = new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        if (await restoreToken()) {
          const u = await api.me();
          setUser(u);
          setProfilePromptOpen(!u.deletion_scheduled_for && shouldPromptForProfile(u));
          await refresh(u);
        }
      } catch {
        await setToken("");
      } finally {
        await minimumSplash;
        Animated.timing(splashOpacity, { toValue: 0, duration: 360, useNativeDriver: Platform.OS !== "web" }).start(() => setBoot(false));
      }
    })();
  }, []);
  if (boot || !user)
    return <View style={s.authOuter}>
      <AuthBackdrop/>
      <SystemChrome dark background="#17214B" canvas="#176E78" canvasGradient/>
      {boot ? <Loading opacity={splashOpacity}/> : <Auth
        onDone={async (u, t) => {
          await setToken(t);
          setUser(u);
          setProfilePromptOpen(!u.deletion_scheduled_for && shouldPromptForProfile(u));
          setTab("home");
          try {
            await refresh(u);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось обновить данные");
          }
        }}
      />}
    </View>;
  const content = user.role === "admin" ? (
      <AdminDashboard tab={tab} onPreview={async(role)=>{const token=api.token();const admin=user;const preview=await api.impersonate(role);setAdminSession({user:admin,token});await setToken(preview.token);setUser(preview.user);setTab("home");await refresh(preview.user)}} />
    ) : tab === "home" ? (
      <Home
        compact={compact}
        wide={wideDesktop}
        user={user}
        analyses={analyses}
        consultations={consultations}
        onOpen={setSelected}
        onTab={setTab}
        onUser={setUser}
		canDeleteAccount={!adminSession}
        onOpenVisit={(visit) => { setFocusVisit(visit); setTab(visit.source === "ai" ? "consultations" : "profile"); }}
        onOpenDoctor={(doctorID) => { setFocusDoctorID(doctorID); setTab("doctors"); }}
      />
    ) : tab === "analyses" ? (
      <Analyses
        compact={compact}
        wide={wideDesktop}
        data={analyses}
        doctor={user.role === "doctor"}
        onOpen={setSelected}
        onUpload={() => setUpload({ uri: "", name: "" })}
      />
    ) : tab === "patients" ? (
      <DoctorPatients patientsAnalyses={analyses} consultations={consultations} onOpen={setSelected} onRefresh={() => refresh()} />
    ) : tab === "consultations" ? (
      <AIWorkspace />
    ) : tab === "doctors" ? (
      <DoctorsScreen user={user} onUser={setUser} onRefresh={() => refresh()} initialDoctorID={focusDoctorID} onTargetHandled={() => setFocusDoctorID("")} onTargetBack={() => setTab("home")} />
    ) : tab === "schedule" ? (
      <DoctorSchedule user={user} compact={compact} onUser={setUser} />
    ) : tab === "ai" ? (
      <AIWorkspace />
    ) : tab === "guides" ? (
      <DoctorConsultationInbox data={consultations} compact={compact} onRefresh={()=>refresh()} />
    ) : tab === "articles" ? (
      <ArticleManager user={user}/>
    ) : user.role === "patient" ? (
      <PatientDoctorChats data={consultations} initial={focusVisit} onConsumed={()=>setFocusVisit(null)} onRefresh={()=>refresh()} compact={compact}/>
    ) : (
      <Profile user={user} onUpdated={setUser} canDeleteAccount={!adminSession}/>
    );
  const immersiveHeader = tab === "home" && (user.role === "patient" || user.role === "doctor");
  // The full-screen canvas below the floating navigation is always the page
  // surface.  The home gradient belongs only to the header; using its teal end
  // as the document canvas produced a second coloured strip on iOS PWA.
  const screenBackground = colors.paper;
  const chromeColors: readonly [string, string, ...string[]] = immersiveHeader
    ? ["#354174", "#6860A3", "#4A9CA2"]
    : [screenBackground, screenBackground];
  const chromeBackground = immersiveHeader ? "#17214B" : screenBackground;
  return (
    <View style={s.safe}>
      <AmbientCanvas />
      {immersiveHeader && <LinearGradient pointerEvents="none" colors={chromeColors} start={{x:0,y:0}} end={{x:0,y:1}} style={s.immersiveBackdrop}/>}
      <SystemChrome dark={immersiveHeader} background={chromeBackground} canvas={colors.paper} canvasGradient="light" />
      <SafeAreaView edges={["top"]} style={s.safeInner}>
      <View style={s.shell}>
        {desktop && <Sidebar user={user} tab={tab} onTab={setTab} />}
        <View style={s.main}>
          {error ? <Banner text={error} onClose={() => setError("")} /> : null}
          <View style={s.content}>{content}</View>
        </View>
      </View>
      <UploadModal
        visible={!!upload}
        seed={upload}
        onClose={() => setUpload(null)}
        onDone={async (result) => {
          setUpload(null);
          setTab("analyses");
		  setAnalyses(current=>[result,...current.filter(item=>item.id!==result.id)]);
		  setSelected(result);
        }}
      />
      <AnalysisDetail
        item={selected}
        user={user}
        onClose={() => setSelected(null)}
        onDelete={user.role === "patient" && selected ? () => requestDelete(selected) : undefined}
        onChanged={async (updated) => {
		  setAnalyses(current=>current.map(item=>item.id===updated.id?updated:item));
		  setSelected(updated);
		  if(updated.status==="ready")setJobNotice({analysis:updated,title:"Результат сохранён",text:"Резюме сформировано и доступно для просмотра."});
        }}
        onError={setError}
      />
	  {!adminSession && user.deletion_scheduled_for && <DeletionPendingPrompt
		visible={!deletionNoticeHidden}
		user={user}
		onContinue={()=>setDeletionNoticeHidden(true)}
		onCancelled={(updated)=>{setUser(updated);setDeletionNoticeHidden(false)}}
	  />}
      {!adminSession && user.role === "patient" && <>
        <ProfileCompletionPrompt
          visible={profilePromptOpen}
          onLater={() => setProfilePromptOpen(false)}
          onComplete={() => { setProfilePromptOpen(false); setProfileCompletionOpen(true); }}
          onNever={() => {
            if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.setItem(`${PROFILE_PROMPT_KEY}:${user.id}`, "1");
            setProfilePromptOpen(false);
          }}
        />
        <ProfileCompletionModal
          visible={profileCompletionOpen}
          user={user}
          onClose={() => setProfileCompletionOpen(false)}
          onUpdated={(updated) => {
            setUser(updated);
            setProfileCompletionOpen(false);
            if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.removeItem(`${PROFILE_PROMPT_KEY}:${updated.id}`);
          }}
        />
      </>}
      {adminSession && <AdminPreviewControl onReturn={async()=>{await setToken(adminSession.token);setUser(adminSession.user);setAdminSession(null);setTab("home");setAnalyses([]);setConsultations([])}}/>}
      {jobNotice&&<Pressable accessibilityRole="button" accessibilityLabel={`${jobNotice.title}. Открыть анализ`} style={s.jobNotice} onPress={()=>{setTab("analyses");setSelected(jobNotice.analysis);setJobNotice(null)}}><View style={s.jobNoticeIcon}><Ionicons name={isProcessingAnalysis(jobNotice.analysis)?"hourglass-outline":jobNotice.analysis.status==="awaiting_confirmation"?"checkmark-done-outline":"notifications-outline"} size={22} color={colors.brand}/></View><View style={s.jobNoticeCopy}><Text style={s.jobNoticeTitle}>{jobNotice.title}</Text><Text numberOfLines={2} style={s.jobNoticeText}>{jobNotice.text}</Text><Text style={s.jobNoticeAction}>{isProcessingAnalysis(jobNotice.analysis)?"Посмотреть ход":"Открыть результат"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Закрыть уведомление" hitSlop={10} onPress={(event)=>{event.stopPropagation();setJobNotice(null)}}><Ionicons name="close" size={20} color={colors.muted}/></Pressable></Pressable>}
      </SafeAreaView>
      {!desktop && <Bottom role={user.role} tab={tab} onTab={setTab} />}
    </View>
  );
}
