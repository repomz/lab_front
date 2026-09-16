import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../api";
import { ActivitySurvey, Analysis, AppStats, ClinicalArticle, Consultation, NutritionSurvey, PatientHealthSummary, User } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { AvatarView, Button, Choice, Field, MiniAction, Section, SurveyScale, firstName } from "../../components/ui";
import { EducationCanvas, Modal, ScrollView } from "../../components/platform";
import { Tab, tabLabel } from "../../navigation/AppNavigation";
import { AgeBand, HealthAudienceGender, HealthTopic, activityBand, activityImages, healthTopics, nutritionImages, personalizedHealthImages } from "../health/content";
import { Profile } from "../profile/Profile";
import { DoctorSupportInbox, SupportChat } from "../chat/Chats";
import { APP_VERSION } from "../../config";
import { ageFromBirthDate } from "../profile/utils";
import { articleImageURI } from "../articles/utils";

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  if (hour < 23) return "Добрый вечер";
  return "Доброй ночи";
};

export function Home({
  compact,
  wide,
  user,
  analyses,
  consultations,
  onOpen,
  onTab,
  onUser,
	canDeleteAccount,
  onOpenVisit,
  onOpenDoctor,
}: {
  compact: boolean;
  wide: boolean;
  user: User;
  analyses: Analysis[];
  consultations: Consultation[];
  onOpen: (a: Analysis) => void;
  onTab: (t: Tab) => void;
  onUser: (u: User) => void;
	canDeleteAccount: boolean;
  onOpenVisit: (visit: Consultation) => void;
  onOpenDoctor: (doctorID: string) => void;
}) {
  const [article, setArticle] = useState<ClinicalArticle | null>(null);
  const [clinicalCasesOpen, setClinicalCasesOpen] = useState(false);
  const [healthBasicsOpen, setHealthBasicsOpen] = useState(false);
  const [healthInfoOpen, setHealthInfoOpen] = useState(false);
  const [articles, setArticles] = useState<ClinicalArticle[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [patientMenuOpen, setPatientMenuOpen] = useState(false);
  const completedAnalyses = analyses.filter((analysis)=>analysis.status==="ready");
  const latest = completedAnalyses[0];
  const latestNeedsAttention = !!latest && (latest.ai_review?.doctor_needed || latest.markers.some((marker) => marker.status === "high" || marker.status === "low"));
  const upcoming = consultations.filter((item) => item.service_type === "appointment" && item.appointment_at && new Date(item.appointment_at) > new Date()).sort((a, b) => (a.appointment_at || "").localeCompare(b.appointment_at || ""))[0];
  const answered = consultations.find((item) => item.status === "answered" && item.reply);
  useEffect(()=>{api.articles().then(items=>setArticles(Array.isArray(items)?items:[])).catch(()=>setArticles([]))},[]);
  if (user.role === "doctor") return <>
    <DoctorHome user={user} consultations={consultations} compact={compact} onMenu={() => setPatientMenuOpen(true)} />
    <PatientProfileModal visible={profileOpen} user={user} onUpdated={onUser} canDeleteAccount={canDeleteAccount} onClose={() => setProfileOpen(false)} />
    <PatientAppMenu visible={patientMenuOpen} user={user} onUser={onUser} onClose={()=>setPatientMenuOpen(false)} onProfile={()=>{setPatientMenuOpen(false);setProfileOpen(true)}} />
  </>;
  return (
    <View style={[s.patientHome, compact && s.patientHomeCompact, wide && s.patientHomeWide]}>
      <View style={[s.patientWelcome, compact && s.patientWelcomeCompact]}>
        <View style={s.welcomeIdentity}>
          <Text numberOfLines={2} style={[s.welcomeTitle, s.homeGreetingText, compact && s.welcomeTitleCompact]}>
            {greetingForNow()}, {firstName(user.full_name)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть меню" hitSlop={10} onPress={() => setPatientMenuOpen(true)} style={({pressed})=>[s.patientMenuTrigger,pressed&&s.patientMenuTriggerPressed]}>
            <Ionicons name="menu-outline" size={28} color={colors.white} />
          </Pressable>
        </View>
        <View style={s.homeUpdates}>
          {!latest && <Pressable accessibilityRole="button" accessibilityLabel="Загрузить первый анализ" onPress={() => onTab("analyses")} style={s.homePlainAction}>
            <Ionicons name="heart-outline" size={25} color="#BDEDE8"/>
            <View style={{flex:1}}><Text style={s.homePlainTitle}>Загрузите свой первый анализ</Text><Text numberOfLines={1} style={s.homePlainText}>Соберите историю здоровья в одном месте</Text></View>
            <Ionicons name="chevron-forward" size={19} color="#FFFFFFA8"/>
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть информацию о здоровье" onPress={() => setHealthInfoOpen(true)} style={s.homePlainAction}>
            <Ionicons name={latestNeedsAttention ? "alert-circle-outline" : "sparkles-outline"} size={25} color={latestNeedsAttention ? "#FFD0C9" : "#D9CEFF"}/>
            <View style={{flex:1}}><Text style={s.homePlainTitle}>Информация о вашем здоровье</Text><Text numberOfLines={1} style={s.homePlainText}>{!latest ? "Появится после первого распознавания" : latestNeedsAttention ? "Обратите внимание на последние результаты" : "Последние показатели выглядят хорошо"}</Text></View>
            <Ionicons name="chevron-forward" size={19} color="#FFFFFFA8"/>
          </Pressable>
          {(upcoming || answered) && <View style={s.homeReminderList}>
            {upcoming && <Pressable accessibilityRole="button" accessibilityLabel="Открыть предстоящий приём" onPress={() => upcoming.doctor_id ? onOpenDoctor(upcoming.doctor_id) : onOpenVisit(upcoming)} style={s.homeReminder}><Ionicons name="calendar-outline" size={21} color={colors.violet}/><View style={{flex:1}}><Text style={s.homeReminderLabel}>Приём</Text><Text numberOfLines={1} style={s.homeReminderText}>{new Date(upcoming.appointment_at!).toLocaleString("ru-RU", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</Text></View></Pressable>}
            {answered && <Pressable accessibilityRole="button" accessibilityLabel={answered.source==="ai"?"Открыть рекомендацию":"Открыть ответ врача"} onPress={() => onOpenVisit(answered)} style={s.homeReminder}><Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.aqua}/><View style={{flex:1}}><Text style={s.homeReminderLabel}>{answered.source==="ai"?"Рекомендация":"Ответ врача"}</Text><Text numberOfLines={1} style={s.homeReminderText}>Открыть переписку</Text></View></Pressable>}
          </View>}
        </View>
      </View>
      <View nativeID="patient-home-lower" style={[s.homeDiscovery, compact && s.homeDiscoveryCompact, wide && s.homeDiscoveryWide]}>
        {Platform.OS !== "web" && <LinearGradient pointerEvents="none" colors={["#F4EFF8", "#F6F4FA", "#EEF7F6"]} locations={[0,.52,1]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject}/>}
        <HealthBasicsCard user={user} onPress={()=>setHealthBasicsOpen(true)}/>
        <ClinicalArticleCarousel articles={articles} onPress={()=>setClinicalCasesOpen(true)}/>
      </View>
      <HealthInfoModal visible={healthInfoOpen} data={analyses} onClose={()=>setHealthInfoOpen(false)}/>
      <ClinicalCases visible={clinicalCasesOpen} articles={articles} onSelect={setArticle} onClose={()=>setClinicalCasesOpen(false)}/>
      <ArticleReader article={article} onClose={()=>setArticle(null)}/>
      <HealthBasics visible={healthBasicsOpen} user={user} onClose={()=>setHealthBasicsOpen(false)}/>
      <PatientProfileModal visible={profileOpen} user={user} onUpdated={onUser} canDeleteAccount={canDeleteAccount} onClose={() => setProfileOpen(false)} />
      <PatientAppMenu visible={patientMenuOpen} user={user} onUser={onUser} onClose={()=>setPatientMenuOpen(false)} onProfile={()=>{setPatientMenuOpen(false);setProfileOpen(true)}} />
    </View>
  );
}

function DoctorHome({ user, consultations, compact, onMenu }: { user: User; consultations: Consultation[]; compact: boolean; onMenu: () => void }) {
  const now = new Date();
  const appointments = consultations
    .filter((item) => { if(item.service_type!=="appointment"||!item.appointment_at)return false;const value=new Date(item.appointment_at);return value.getFullYear()===now.getFullYear()&&value.getMonth()===now.getMonth()&&value.getDate()===now.getDate(); })
    .sort((a,b) => (a.appointment_at || "").localeCompare(b.appointment_at || ""));
  const requests=consultations.filter(item=>item.service_type!=="appointment"&&item.source!=="ai"&&!item.reply&&item.status!=="answered").sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return <View style={[s.patientHome,compact&&s.patientHomeCompact]}>
    <View style={[s.patientWelcome,compact&&s.patientWelcomeCompact]}>
      <View style={s.welcomeIdentity}>
        <Text numberOfLines={2} style={[s.welcomeTitle,s.homeGreetingText,compact&&s.welcomeTitleCompact]}>{greetingForNow()}, {firstName(user.full_name)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Открыть меню" hitSlop={10} onPress={onMenu} style={({pressed})=>[s.patientMenuTrigger,pressed&&s.patientMenuTriggerPressed]}>
          <Ionicons name="menu-outline" size={28} color={colors.white}/>
        </Pressable>
      </View>
      <ScrollView style={s.doctorHomeNotices} contentContainerStyle={s.doctorHomeNoticesContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {requests.length?<View style={s.doctorNoticeSection}><Text style={s.sectionTitle}>Запросы консультаций</Text>{requests.slice(0,4).map(item=><View key={item.id} style={s.doctorNoticeRow}><Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.violet}/><View style={{flex:1}}><Text style={s.analysisTitle}>{item.patient_name||"Пользователь"}</Text><Text numberOfLines={1} style={s.analysisMeta}>{item.question}</Text></View></View>)}</View>:<View style={s.doctorEmptyNotice}><Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.violet}/><Text style={s.doctorEmptyNoticeText}>Запросов консультации нет</Text></View>}
        {appointments.length?<View style={s.doctorNoticeSection}><Text style={s.sectionTitle}>Записи на сегодня</Text>{appointments.map(item=><View key={item.id} style={s.doctorNoticeRow}><Text style={s.doctorAppointmentTime}>{new Date(item.appointment_at!).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text><Text style={s.analysisTitle}>{item.patient_name||"Пользователь"}</Text></View>)}</View>:<View style={s.doctorEmptyNotice}><Ionicons name="calendar-outline" size={19} color={colors.aqua}/><Text style={s.doctorEmptyNoticeText}>Приёма нет</Text></View>}
      </ScrollView>
    </View>
    <View nativeID="patient-home-lower" style={[s.homeDiscovery,s.doctorHomeLower,compact&&s.homeDiscoveryCompact]}>
      {Platform.OS!=="web"&&<LinearGradient pointerEvents="none" colors={["#F4EFF8","#F6F4FA","#EEF7F6"]} locations={[0,.52,1]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject}/>}
    </View>
  </View>;
}

export function AdminDashboard({tab,onPreview}:{tab:Tab;onPreview:(role:"patient"|"doctor")=>Promise<void>}) {
  const empty:AppStats={total_users:0,new_users:0,logins:0,uploaded_tests:0,total_uploaded_tests:0,total_doctors:0,consultations_24h:0,appointments_24h:0,support_messages_24h:0,ai_requests_24h:0};
  const [stats,setStats]=useState<AppStats>(empty);
  const [busy,setBusy]=useState(false);
  const [menu,setMenu]=useState(false);
  useEffect(()=>{api.appStats().then(setStats).catch(()=>setStats(empty))},[]);
  const groups:Record<string,Array<[keyof AppStats,string,keyof typeof Ionicons.glyphMap]>>={
    home:[["total_users","Пациентов всего","people-outline"],["total_doctors","Врачей всего","medkit-outline"],["new_users","Новых пациентов за сутки","person-add-outline"],["logins","Входов за сутки","enter-outline"],["total_uploaded_tests","Анализов всего","file-tray-full-outline"],["uploaded_tests","Анализов за сутки","flask-outline"],["consultations_24h","Консультаций за сутки","chatbubbles-outline"],["appointments_24h","Записей за сутки","calendar-outline"]],
    patients:[["total_users","Пациентов","people-outline"],["total_doctors","Врачей","medical-outline"],["new_users","Новых пациентов за сутки","person-add-outline"]],
    analyses:[["total_uploaded_tests","Анализов всего","file-tray-full-outline"],["uploaded_tests","Анализов за сутки","flask-outline"]],
    consultations:[["consultations_24h","Запросов врачам за сутки","chatbubbles-outline"],["appointments_24h","Записей на приём за сутки","calendar-outline"],["ai_requests_24h","AI-обращений за сутки","sparkles-outline"]],
    guides:[["support_messages_24h","Сообщений поддержке за сутки","help-buoy-outline"]],
  };
  const previewMenu=<Modal visible={menu} animationType="slide" onRequestClose={()=>setMenu(false)}><View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.adminModePage}><View style={s.menuPageHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.profileBack} onPress={()=>setMenu(false)}><Ionicons name="arrow-back" size={27} color={colors.ink}/></Pressable><Text style={s.menuPageHeaderTitle}>Режим просмотра</Text></View><Text style={s.cardHint}>Откройте приложение в точности так, как его видит выбранная роль.</Text><Button kind="glass" label="Открыть как пользователь" icon="person-outline" disabled={busy} onPress={async()=>{setBusy(true);try{await onPreview("patient")}finally{setBusy(false)}}}/><Button kind="glass" label="Открыть как врач" icon="medkit-outline" disabled={busy} onPress={async()=>{setBusy(true);try{await onPreview("doctor")}finally{setBusy(false)}}}/></SafeAreaView></View></Modal>;
  if(tab==="guides") return <View style={{flex:1}}><View style={s.adminHeader}><Text style={s.directoryTitle}>Поддержка</Text><Pressable style={s.roleMenuButtonInline} onPress={()=>setMenu(true)}><Ionicons name="menu-outline" size={24} color={colors.violet}/></Pressable></View><DoctorSupportInbox compact/>{previewMenu}</View>;
  return <ScrollView contentContainerStyle={s.adminDashboard}><View style={s.adminHeader}><View><Text style={s.directoryTitle}>{tabLabel("admin",tab)}</Text><Text style={s.analysisMeta}>Актуальные показатели работы приложения</Text></View><Pressable style={s.roleMenuButtonInline} onPress={()=>setMenu(true)}><Ionicons name="menu-outline" size={24} color={colors.violet}/></Pressable></View><View style={s.adminMetricGrid}>{(groups[tab]||groups.home)!.map(([key,label,iconName])=><View key={String(key)} style={s.adminMetricCard}><Ionicons name={iconName} size={22} color={colors.violet}/><Text style={s.adminMetricValue}>{stats[key]}</Text><Text style={s.adminMetricLabel}>{label}</Text></View>)}</View>{previewMenu}</ScrollView>;
}

export function AdminPreviewControl({onReturn}:{onReturn:()=>Promise<void>}) { return <Pressable accessibilityLabel="Вернуться в админку" onPress={()=>void onReturn()} style={s.adminPreviewControl}><Ionicons name="shield-checkmark-outline" size={18} color={colors.white}/><Text style={s.adminPreviewText}>Админ</Text></Pressable> }

function HealthInfoModal({visible,data,onClose}:{visible:boolean;data:Analysis[];onClose:()=>void}) {
  const [summary,setSummary]=useState<PatientHealthSummary|null>(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{if(!visible||!data.length)return;setLoading(true);api.healthSummary().then(setSummary).catch(()=>setSummary({summary:"Общее резюме временно недоступно. Попробуйте открыть раздел позднее."})).finally(()=>setLoading(false))},[visible,data.length]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={onClose}><Ionicons name="arrow-back" size={25}/></Pressable><Text style={s.fullScreenTitle}>Ваше здоровье</Text><View style={s.headerSpacer}/></View><ScrollView bounces={false} contentContainerStyle={s.fullScreenBody}>{!data.length?<View style={s.healthInfoEmpty}><Ionicons name="sparkles-outline" size={34} color={colors.violet}/><Text style={s.healthInfoEmptyTitle}>Здесь вас будет ждать резюме</Text><Text style={s.healthInfoEmptyText}>После загрузки и распознавания анализов появится общая оценка текущего состояния и динамики показателей.</Text></View>:loading?<View style={s.healthInfoEmpty}><ActivityIndicator color={colors.violet}/><Text style={s.healthInfoEmptyText}>Сопоставляем результаты и динамику…</Text></View>:<View style={s.aiRecommendation}><Text style={s.body}>{summary?.summary||"Резюме ещё формируется."}</Text></View>}{data.length?<Text style={s.aiDisclaimer}>Информация сформирована автоматически и не является диагнозом. Сверяйте значения с оригинальными бланками.</Text>:null}</ScrollView></SafeAreaView></Modal>;
}

function PatientProfileModal({ visible, user, onUpdated, canDeleteAccount, onClose }: { visible: boolean; user: User; onUpdated: (user: User) => void; canDeleteAccount: boolean; onClose: () => void }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.profileModalSafe}>
      <View style={s.profileHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.profileBack} onPress={onClose}><Ionicons name="arrow-back" size={27}/></Pressable>
        <Text style={s.profileHeaderTitle}>Профиль</Text>
      </View>
      <Profile user={user} onUpdated={onUpdated} canDeleteAccount={canDeleteAccount}/>
    </SafeAreaView></View>
  </Modal>;
}

function PatientAppMenu({visible,user,onUser,onClose,onProfile}:{visible:boolean;user:User;onUser:(user:User)=>void;onClose:()=>void;onProfile:()=>void}) {
  const [section,setSection]=useState<"menu"|"settings"|"about"|"support">("menu");
  const doctor=user.role==="doctor";
  useEffect(()=>{if(!visible)setSection("menu")},[visible]);
  const goBack=()=>section==="menu"?onClose():setSection("menu");
  const title=section==="menu"?"Меню":section==="settings"?"Настройки":section==="support"?"Служба поддержки":"О приложении";
  if(section==="support") return <Modal visible={visible} animationType="slide" onRequestClose={goBack}><View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.patientMenuPage}><View style={s.menuPageHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.profileBack} onPress={goBack}><Ionicons name="arrow-back" size={27} color={colors.ink}/></Pressable><Text style={s.menuPageHeaderTitle}>{title}</Text></View><SupportChat compact onBack={goBack}/></SafeAreaView></View></Modal>;
  return <Modal visible={visible} animationType="slide" onRequestClose={()=>section==="menu"?onClose():setSection("menu")}>
    <View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.patientMenuPage}>
      <View style={s.menuPageHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.profileBack} onPress={goBack}><Ionicons name="arrow-back" size={27} color={colors.ink}/></Pressable><Text style={s.menuPageHeaderTitle}>{title}</Text></View>
      {section==="settings"?<View style={s.patientMenuSection}>
        <Pressable accessibilityRole="button" onPress={onProfile} style={({pressed})=>[s.patientSettingsRow,pressed&&s.pressablePressed]}><View style={s.patientMenuItemIcon}><Ionicons name="person-outline" size={22} color={colors.violet}/></View><View style={{flex:1}}><Text style={s.patientMenuItemTitle}>{doctor?"Профиль врача":"Личные данные"}</Text><Text style={s.patientMenuItemHint}>{doctor?(user.doctor_profile?"Профиль заполнен":"Профиль требует заполнения"):(user.patient_profile?"Профиль заполнен":"Профиль требует заполнения")}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
        {!doctor&&<Pressable accessibilityRole="switch" accessibilityState={{checked:!!user.online_clinic}} onPress={async()=>{try{onUser(await api.updateSettings(!user.online_clinic))}catch(e){Alert.alert("Настройка не сохранена",e instanceof Error?e.message:"Ошибка")}}} style={({pressed})=>[s.patientSettingsRow,pressed&&s.pressablePressed]}><View style={s.patientMenuItemIcon}><Ionicons name="medkit-outline" size={22} color={colors.violet}/></View><View style={{flex:1}}><Text style={s.patientMenuItemTitle}>Онлайн-поликлиника</Text><Text style={s.patientMenuItemHint}>Специалисты, консультации и запись</Text></View><View style={[s.settingToggle,user.online_clinic&&s.settingToggleOn]}><View style={[s.settingToggleThumb,user.online_clinic&&s.settingToggleThumbOn]}/></View></Pressable>}
        <View style={s.patientSettingsRow}><View style={s.patientMenuItemIcon}><Ionicons name="keypad-outline" size={22} color={colors.violet}/></View><View style={{flex:1}}><Text style={s.patientMenuItemTitle}>Вход в приложение</Text><Text style={s.patientMenuItemHint}>Защищён PIN-кодом</Text></View></View>
      </View>:section==="about"?<ScrollView contentContainerStyle={s.patientAboutSection}><View style={s.patientAboutMark}><Ionicons name="shield-checkmark-outline" size={38} color={colors.violet}/></View><Text style={s.patientAboutTitle}>Lab</Text><Text style={s.patientAboutVersion}>Версия {APP_VERSION}</Text><Text style={s.patientAboutText}>Lab объединяет результаты лабораторных анализов и других обследований в одном профиле здоровья. Документы из разных медицинских учреждений можно хранить вместе, сопоставлять показатели и отслеживать их динамику.</Text><Text style={s.patientAboutText}>Можно добавлять разные виды обследований, в том числе УЗИ, систематизировать результаты и получать первоначальное автоматическое резюме. Онлайн-поликлиника позволяет обратиться к врачу за консультацией или записаться на доступное время приёма.</Text><Text style={s.healthDisclaimer}>Автоматическая оценка носит информационный характер, не является диагнозом и не заменяет консультацию врача.</Text></ScrollView>:<View style={s.patientMenuSection}>
          <Text style={s.patientMenuCaption}>Lab</Text>
          <Pressable accessibilityRole="button" style={({pressed})=>[s.patientMenuItem,pressed&&s.pressablePressed]} onPress={onProfile}><View style={s.patientMenuItemIcon}><Ionicons name="person-outline" size={22} color={colors.violet}/></View><Text style={s.patientMenuItemTitle}>Профиль</Text><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
          <Pressable accessibilityRole="button" style={({pressed})=>[s.patientMenuItem,pressed&&s.pressablePressed]} onPress={()=>setSection("settings")}><View style={s.patientMenuItemIcon}><Ionicons name="settings-outline" size={22} color={colors.violet}/></View><Text style={s.patientMenuItemTitle}>Настройки</Text><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
          <Pressable accessibilityRole="button" style={({pressed})=>[s.patientMenuItem,pressed&&s.pressablePressed]} onPress={()=>setSection("support")}><View style={s.patientMenuItemIcon}><Ionicons name="help-buoy-outline" size={22} color={colors.violet}/></View><Text style={s.patientMenuItemTitle}>Служба поддержки</Text><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
          <Pressable accessibilityRole="button" style={({pressed})=>[s.patientMenuItem,pressed&&s.pressablePressed]} onPress={()=>setSection("about")}><View style={s.patientMenuItemIcon}><Ionicons name="information-circle-outline" size={22} color={colors.violet}/></View><Text style={s.patientMenuItemTitle}>О приложении</Text><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>
        </View>}
    </SafeAreaView></View>
  </Modal>;
}


function WellnessPhotoCard({ ageBand, onPress }: { ageBand: AgeBand; onPress: () => void }) {
  const images = activityImages[ageBand];
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    setIndex(0);
    const rotate = () => Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== "web" }).start(() => {
      setIndex((value) => (value + 1) % images.length);
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: Platform.OS !== "web" }).start();
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
    <Pressable accessibilityRole="button" accessibilityLabel="Открыть рекомендации по активности" onPress={onPress} style={({ pressed }) => [s.homeMediaCard, pressed && { opacity: 0.88 }]}>
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
    const rotate = () => Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== "web" }).start(() => {
      setOffset((value) => (value + 1) % 3);
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: Platform.OS !== "web" }).start();
    });
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { rotate(); timer = setTimeout(tick, 12000); };
    timer = setTimeout(tick, 12000);
    return () => { clearTimeout(timer); opacity.stopAnimation(); };
  }, [opacity]);
  const image = nutritionImages[(base + offset) % 3];
  const subtitle = ageTone === "young" ? "Энергия, белок и регулярный режим" : ageTone === "middle" ? "Баланс, клетчатка и разумные порции" : "Простая питательная еда и достаточное питьё";
  return <Pressable accessibilityRole="button" accessibilityLabel="Открыть рекомендации по питанию" onPress={onPress} style={({pressed})=>[s.homeMediaCard,pressed&&{opacity:.86}]}><Animated.Image source={image} style={[s.homeMediaImage as any,{opacity}]}/><LinearGradient colors={["#111827CC","#11182712"]} start={{x:0,y:1}} end={{x:1,y:0}} style={s.videoOverlay}><View style={{flex:1}}><Text style={s.videoEyebrow}>ПРАВИЛЬНОЕ ПИТАНИЕ</Text><Text style={s.videoTitle}>Еда для здоровья</Text><Text style={s.videoSubtitle}>{subtitle}</Text></View><View style={s.videoArrow}><Ionicons name="arrow-forward" size={24} color={colors.white}/></View></LinearGradient></Pressable>;
}

const fallbackArticle: ClinicalArticle = {id:"66d000000000000000000001",title:"Сонные артерии: атеросклероз и кровоснабжение мозга",summary:"Как бляшка сужает артерию и какие исследования помогают оценить риск.",cover_url:"/clinical-carotid-overview.svg",published:true,created_at:"2026-09-02T00:00:00Z",updated_at:"2026-09-02T00:00:00Z",blocks:[{id:"intro",type:"text",text:"Сонные артерии доставляют кровь к головному мозгу. Атеросклеротическая бляшка чаще формируется в области бифуркации общей сонной артерии и постепенно сужает её просвет."},{id:"image",type:"image",image_url:"/clinical-carotid-overview.svg",caption:"Схема стеноза и ангиографическое представление сонной артерии."},{id:"symptoms",type:"text",text:"Внезапная слабость в руке или ноге, асимметрия лица, нарушение речи или зрения требуют срочной медицинской оценки — даже если симптомы быстро прошли."},{id:"diagnostics",type:"text",text:"Для первичной оценки применяют ультразвуковое дуплексное сканирование. КТ-, МР- или рентгеноконтрастная ангиография помогают уточнить анатомию и степень сужения. Тактика определяется врачом индивидуально."}]};
function ClinicalArticleCarousel({articles:_articles,onPress}:{articles:ClinicalArticle[];onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityLabel="Открыть клинические случаи" onPress={onPress} style={({pressed})=>[s.homeMediaCard,pressed&&{opacity:.88}]}><Image source={require("../../../assets/clinical/coronary-angiography.jpeg")} style={s.homeMediaImage}/><LinearGradient colors={["#091226E8","#10182720"]} start={{x:0,y:1}} end={{x:1,y:0}} style={s.videoOverlay}><View style={{flex:1}}><Text numberOfLines={2} style={s.articleHeroTitle}>Клинические случаи</Text><Text numberOfLines={1} style={s.videoSubtitle}>Наглядный разбор</Text></View><View style={s.rubricHeroArrow}><Ionicons name="chevron-forward" size={24} color={colors.white}/></View></LinearGradient></Pressable>
}

function HealthBasicsCard({user,onPress}:{user:User;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Открыть Понятно о здоровье" onPress={onPress} style={({pressed})=>[s.homeMediaCard,pressed&&{opacity:.88}]}>
    <Image source={healthTopicImageSource(user,healthTopics[0]!)} style={s.homeMediaImage}/>
    <LinearGradient colors={["#221D57EA","#216F7B40"]} start={{x:0,y:1}} end={{x:1,y:0}} style={s.videoOverlay}>
      <View style={{flex:1}}><Text style={s.articleHeroTitle}>Понятно о здоровье</Text><Text numberOfLines={2} style={s.videoSubtitle}>Важные темы без сложных терминов</Text></View>
      <View style={s.rubricHeroArrow}><Ionicons name="chevron-forward" size={24} color={colors.white}/></View>
    </LinearGradient>
  </Pressable>;
}

function healthTopicImageSource(user:User,topic:HealthTopic) {
  if(!topic.personalized)return topic.image;
  const age=user.patient_profile?.age||ageFromBirthDate(user.birth_date||"")||(user.is_developer?38:40);
  const rawBand=activityBand(age);
  const band=(rawBand==="under20"?"20s":rawBand) as Exclude<AgeBand,"under20">;
  const gender:HealthAudienceGender=user.gender==="male"||user.is_developer?"male":"female";
  return personalizedHealthImages[topic.personalized][band][gender];
}

function HealthBasics({visible,onClose,user}:{visible:boolean;onClose:()=>void;user:User}) {
  const [topic,setTopic]=useState<HealthTopic|null>(null);
  useEffect(()=>{if(!visible)setTopic(null)},[visible]);
  return <Modal visible={visible} animationType="slide" onRequestClose={topic?()=>setTopic(null):onClose}>
    <View style={s.educationPage}><EducationCanvas/>
    <SafeAreaView style={s.healthBasicsPage}>
      <View style={s.articleReaderHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={topic?()=>setTopic(null):onClose}><Ionicons name="arrow-back" size={25}/></Pressable>
        <Text numberOfLines={1} style={s.articleReaderHeaderTitle}>{topic?.title||"Понятно о здоровье"}</Text><View style={s.headerSpacer}/>
      </View>
      {!topic ? <View style={s.healthTopicsListFixed}>
        {healthTopics.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>setTopic(item)} style={({pressed})=>[s.healthTopicRow,s.healthTopicRowFixed,pressed&&s.pressablePressed]}><Image source={healthTopicImageSource(user,item)} style={s.healthTopicThumb}/><View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={s.healthTopicTitle}>{item.id==="lifestyle"?"Активность и питание":item.title}</Text>{item.id!=="lifestyle"&&<Text numberOfLines={2} style={s.healthTopicIntro}>{item.intro}</Text>}</View><Ionicons name="chevron-forward" size={21} color={colors.violet}/></Pressable>)}
      </View> : <ScrollView contentContainerStyle={s.healthTopicBody}>
        <Image source={healthTopicImageSource(user,topic)} style={s.healthTopicHero}/><Text style={s.healthTopicIntroLarge}>{topic.intro}</Text>
        {topic.sections.map(section=><View key={section.title} style={s.healthTopicSection}><Text style={s.healthTopicSectionTitle}>{section.title}</Text><Text style={s.healthTopicText}>{section.text}</Text></View>)}
        <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(topic.sourceURL)} style={s.healthSource}><Ionicons name="open-outline" size={20} color={colors.brand}/><View style={{flex:1}}><Text style={s.healthSourceLabel}>Первоисточник</Text><Text style={s.healthSourceText}>{topic.sourceLabel}</Text></View></Pressable>
        <Text style={s.healthDisclaimer}>Материал предназначен для общего ознакомления и не заменяет диагностику, назначения или очную консультацию врача.</Text>
      </ScrollView>}
    </SafeAreaView></View>
  </Modal>;
}

const clinicalCaseSeeds: Array<{id:string;title:string;intro:string;image:number;match:RegExp;article:ClinicalArticle}> = [
  {id:"coronary",title:"Коронарные артерии",intro:"Стенозы сосудов сердца и восстановление кровотока",image:require("../../../assets/clinical/coronary-angiography.jpeg"),match:/коронар|инфаркт|стенокард/i,article:{...fallbackArticle,id:"case-coronary",title:"Коронарные артерии: почему возникает ишемия",summary:"Наглядный разбор сужения артерии, питающей сердце.",blocks:[{id:"c1",type:"text",text:"Коронарные артерии питают сердечную мышцу. Атеросклеротическая бляшка может ограничивать кровоток и вызывать боль или давление за грудиной при нагрузке."},{id:"c2",type:"text",text:"ЭКГ, нагрузочные методы и визуализация коронарных артерий помогают врачу оценить причину симптомов. При длительной боли в груди, холодном поте или выраженной одышке вызывайте 112."}]}},
  {id:"carotid",title:"Сонные артерии",intro:"Бляшки, стеноз и кровоснабжение головного мозга",image:require("../../../assets/clinical/angiography/carotid.jpg"),match:/сонн/i,article:fallbackArticle},
  {id:"stroke",title:"Ишемический инсульт",intro:"Как распознать признаки и почему важна каждая минута",image:require("../../../assets/clinical/angiography/cerebral.jpg"),match:/инсульт/i,article:{...fallbackArticle,id:"case-stroke",title:"Ишемический инсульт: время имеет значение",summary:"Основные признаки и маршрут неотложной помощи.",blocks:[{id:"s1",type:"text",text:"Внезапная асимметрия лица, слабость руки или ноги, нарушение речи, зрения или равновесия могут быть признаками инсульта."},{id:"s2",type:"text",text:"Немедленно вызывайте 112 и сообщите время появления симптомов. Не ждите самостоятельного улучшения и не принимайте лекарства без указания медицинского работника."}]}},
  {id:"limb",title:"Крупные артерии нижних конечностей",intro:"Кровоток в ногах, перемежающаяся хромота и стенозы",image:require("../../../assets/clinical/angiography/lower-limb.jpg"),match:/нижн.*конеч|бедрен|подколен/i,article:{...fallbackArticle,id:"case-limb",title:"Артерии ног: когда ходьба вызывает боль",summary:"Как нарушение кровотока проявляется при нагрузке.",blocks:[{id:"l1",type:"text",text:"При сужении крупных артерий ног мышцы получают меньше крови. Типичный симптом — боль или усталость в икре при ходьбе, проходящая после остановки."},{id:"l2",type:"text",text:"УЗИ артерий и КТ-ангиография помогают определить уровень поражения. Внезапная боль, похолодание или побледнение ноги требуют срочной помощи."}]}},
  {id:"tibial",title:"Артерии голени",intro:"Кровоснабжение стопы, диабет и заживление ран",image:require("../../../assets/clinical/angiography/tibial.jpg"),match:/голен|стоп|тиби/i,article:{...fallbackArticle,id:"case-tibial",title:"Артерии голени: защита стопы",summary:"Почему небольшие раны требуют внимания при нарушенном кровотоке.",blocks:[{id:"t1",type:"text",text:"Артерии голени обеспечивают кровью стопу. При диабете и атеросклерозе кровоток может ухудшаться, поэтому повреждения кожи иногда заживают медленно."},{id:"t2",type:"text",text:"Ежедневно осматривайте стопы. Рана, потемнение кожи, боль в покое или холодная стопа требуют быстрой очной оценки врача."}]}}
];

function ClinicalCases({visible,articles,onSelect,onClose}:{visible:boolean;articles:ClinicalArticle[];onSelect:(article:ClinicalArticle)=>void;onClose:()=>void}) {
  const safeArticles=Array.isArray(articles)?articles:[];
  const items=clinicalCaseSeeds.map(seed=>({...seed,article:safeArticles.find(item=>item.published&&seed.match.test(`${item.title} ${item.summary}`))||seed.article}));
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.healthBasicsPage}>
      <View style={s.articleReaderHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={onClose}><Ionicons name="arrow-back" size={25}/></Pressable><Text style={s.articleReaderHeaderTitle}>Клинические случаи</Text><View style={s.headerSpacer}/></View>
      <ScrollView contentContainerStyle={s.healthTopicsList}>{items.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>onSelect(item.article)} style={({pressed})=>[s.healthTopicRow,pressed&&s.pressablePressed]}><Image source={item.image} style={s.clinicalTopicImage}/><View style={{flex:1,minWidth:0}}><Text style={s.healthTopicTitle}>{item.title}</Text><Text numberOfLines={2} style={s.healthTopicIntro}>{item.intro}</Text></View><Ionicons name="chevron-forward" size={21} color={colors.violet}/></Pressable>)}</ScrollView>
    </SafeAreaView></View>
  </Modal>;
}

function WellnessCombinedCard({ageBand,ageTone,onPress}:{ageBand:AgeBand;ageTone:"young"|"middle"|"senior";onPress:(kind:"activity"|"nutrition")=>void}){
  const activities=activityImages[ageBand];const nutrition=nutritionImages[ageTone==="young"?0:ageTone==="middle"?1:2]!;
  const [kind,setKind]=useState<"activity"|"nutrition">("activity");const [activityIndex,setActivityIndex]=useState(0);const opacity=useRef(new Animated.Value(1)).current;
  useEffect(()=>{setActivityIndex(0)},[ageBand]);
  useEffect(()=>{const timer=setInterval(()=>Animated.timing(opacity,{toValue:0,duration:700,useNativeDriver:true}).start(()=>{setKind(value=>{if(value==="nutrition")setActivityIndex(index=>(index+1)%activities.length);return value==="activity"?"nutrition":"activity"});Animated.timing(opacity,{toValue:1,duration:900,useNativeDriver:true}).start()}),10000);return()=>{clearInterval(timer);opacity.stopAnimation()}},[activities.length,opacity]);
  const activity=activities[activityIndex]||activities[0]!;
  return <Pressable accessibilityRole="button" accessibilityLabel={kind==="activity"?"Открыть рекомендации по активности":"Открыть рекомендации по питанию"} onPress={()=>onPress(kind)} style={({pressed})=>[s.homeMediaCard,pressed&&{opacity:.88}]}><Animated.Image source={kind==="activity"?activity:nutrition} style={[s.homeMediaImage as any,{opacity}]}/><LinearGradient colors={["#10182ADD","#10182A18"]} start={{x:0,y:1}} end={{x:1,y:0}} style={s.videoOverlay}><View style={{flex:1}}><Text style={s.videoEyebrow}>АКТИВНЫЙ ОБРАЗ ЖИЗНИ И ПРАВИЛЬНОЕ ПИТАНИЕ</Text><Text style={s.videoTitle}>{kind==="activity"?"Движение каждый день":"Еда для здоровья"}</Text><Text style={s.videoSubtitle}>{kind==="activity"?"Рекомендации с учётом возраста":"Баланс и понятные привычки"}</Text></View><View style={s.videoArrow}><Ionicons name="arrow-forward" size={24} color={colors.white}/></View></LinearGradient></Pressable>
}

function ArticleReader({article,onClose}:{article:ClinicalArticle|null;onClose:()=>void}){
  return <Modal visible={!!article} animationType="slide" onRequestClose={onClose}><View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.articleReader}><View style={s.articleReaderHeader}><Pressable accessibilityLabel="Назад к списку случаев" style={s.iconButton} onPress={onClose}><Ionicons name="arrow-back" size={25}/></Pressable><Text numberOfLines={1} style={s.articleReaderHeaderTitle}>Клинический случай</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.articleReaderBody}>{article&&<><Image source={{uri:articleImageURI(article.cover_url)}} style={s.articleReaderCover}/><Text style={s.articleReaderTitle}>{article.title}</Text><Text style={s.articleReaderSummary}>{article.summary}</Text>{article.blocks.map(block=>block.type==="image"?<View key={block.id} style={s.articleImageBlock}><Image source={{uri:articleImageURI(block.image_url||article.cover_url)}} style={s.articleBlockImage}/>{block.caption?<Text style={s.articleCaption}>{block.caption}</Text>:null}</View>:<Text key={block.id} style={s.articleParagraph}>{block.text}</Text>)}<View style={s.clinicalNotice}><Ionicons name="information-circle-outline" size={21} color={colors.amber}/><Text style={s.aiDisclaimer}>Материал носит информационный характер и не заменяет консультацию врача.</Text></View></>}</ScrollView></SafeAreaView></View></Modal>
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
          <View style={s.profileInsight}><Ionicons name="person-circle-outline" size={24} color={colors.brand} /><Text style={s.body}>{profile ? `${profile.age} лет · ИМТ ${profile.bmi} · учтены ${analyses.filter(item=>item.status==="ready").length} исследований` : "Для персонализации заполните профиль"}</Text></View>
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
