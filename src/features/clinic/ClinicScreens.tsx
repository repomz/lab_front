import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../api";
import { Analysis, ArticleBlock, ClinicalArticle, ClinicalAssistResult, Consultation, PatientNote, ScheduleSlot, User } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { AIList, AvatarView, BackButton, Button, Choice, Empty, Field, MiniAction, ScreenHeader, Section, Segment, Status, date } from "../../components/ui";
import { AmbientCanvas, EducationCanvas, Modal, ScrollView } from "../../components/platform";
import { AnalysisCard } from "../analyses/AnalysesScreen";
import { markerStatusText } from "../analyses/report";
import { ConsentControls } from "../profile/Profile";
import { articleImageURI } from "../articles/utils";
import { startDictation } from "../../utils/dictation";
import { ONLINE_CLINIC_KEY, doctorSpecialties } from "../../config";

export function Consultations({
  compact,
  data,
  user,
  onRefresh,
  initialSelected,
  onTargetHandled,
  onTargetBack,
}: {
  compact: boolean;
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
  const [aiResult,setAIResult]=useState<Consultation|null>(null);
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
    try { const result=await api.aiConsult(question.trim()); setAIResult(result); onRefresh(); }
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
  return <View style={s.consultationsPage}>
    <ScrollView contentContainerStyle={[s.primaryTabScroll, compact && s.primaryTabScrollCompact,s.consultationsScroll]}>
      {data.length ? <View style={s.consultList}>{data.map(c=><Pressable key={c.id} onPress={()=>setSelected(c)} style={[s.consultRow,c.source==="ai"?s.aiConsultCard:s.doctorConsultCard]}><View style={[s.consultRowIcon,{backgroundColor:c.source==="ai"?"#EFEAFF":colors.mint}]}><Ionicons name={c.source==="ai"?"sparkles":"medkit-outline"} size={20} color={c.source==="ai"?colors.violet:colors.aqua}/></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.analysisTitle}>{c.title||"Консультация"}</Text><Text style={s.analysisMeta}>{date(c.created_at)} · {c.status==="answered"?"есть ответ":"ожидает ответа"}</Text></View></Pressable>)}</View> : <Empty icon="sparkles-outline" title="Обращений пока нет" text="Здесь появятся вопросы, записи и ответы."/>}
    </ScrollView>
    {user.role === "patient"&&<Pressable nativeID="consultation-action-dock" onPress={()=>setExpanded(true)} style={s.complaintPromptDock}><View style={s.complaintIcon}><Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.violet}/></View><View style={{flex:1}}><Text style={s.complaintTitle}>Что вас беспокоит?</Text><Text style={s.complaintPlaceholder} numberOfLines={1}>Опишите или продиктуйте жалобы…</Text></View><Ionicons name="chevron-forward" size={21} color={colors.muted}/></Pressable>}
    <Modal visible={expanded} animationType="slide" onRequestClose={()=>{setExpanded(false);setAIResult(null);setQuestion("")}}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable style={s.iconButton} onPress={()=>{setExpanded(false);setAIResult(null);setQuestion("")}}><Ionicons name="arrow-back" size={24}/></Pressable><Text style={s.fullScreenTitle}>Новая консультация</Text><View style={s.headerSpacer}/></View><ScrollView bounces={false} contentContainerStyle={s.fullScreenBody} keyboardShouldPersistTaps="handled">{aiResult?<><View style={s.patientRecord}><Text style={s.replyLabel}>Ваш вопрос</Text><Text style={s.body}>{aiResult.question}</Text></View><View style={s.replyBox}><Text style={s.replyLabel}>Рекомендация</Text><Text style={s.body}>{aiResult.reply}</Text>{aiResult.specialty?<Text style={s.specialtyLine}>Специалист: {aiResult.specialty}</Text>:null}</View><Button kind="glass" label="Задать другой вопрос" onPress={()=>{setAIResult(null);setQuestion("")}}/></>:<><TextInput autoFocus multiline style={[s.input,s.complaintInput,s.largeComposer]} placeholder="Когда появились симптомы, где болит, что усиливает или облегчает состояние…" value={question} onChangeText={setQuestion}/><Pressable onPress={dictate} style={[s.micButton,listening&&s.micButtonActive]}><Ionicons name={listening?"radio":"mic-outline"} size={22} color={listening?colors.white:colors.violet}/><Text style={[s.micText,listening&&{color:colors.white}]}>{listening?"Слушаю…":"Продиктовать"}</Text></Pressable><Button label={asking?"Анализируем…":"Получить ответ"} disabled={asking||!question.trim()} onPress={()=>void askAI()}/><Text style={s.aiDisclaimer}>Не заменяет врача. При экстренных симптомах вызывайте 112.</Text></>}</ScrollView></SafeAreaView></Modal>
    <Modal visible={!!selected} animationType="slide" onRequestClose={closeSelected}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={closeSelected}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={1} style={s.fullScreenTitle}>{selected?.title||"Консультация"}</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.fullScreenBody}><Text style={s.analysisMeta}>{selected?date(selected.created_at):""}</Text><View style={s.patientRecord}><Text style={s.replyLabel}>Ваш вопрос</Text><Text style={s.body}>{selected?.question}</Text></View>{selected?.reply?<View style={s.replyBox}><Text style={s.replyLabel}>{selected.source==="ai"?"Рекомендация":"Ответ врача"}</Text><Text style={s.body}>{selected.reply}</Text>{selected.specialty?<Text style={s.specialtyLine}>Специалист: {selected.specialty}</Text>:null}</View>:<Text style={s.cardHint}>Ответ ещё не получен.</Text>}</ScrollView></SafeAreaView></Modal>
  </View>;
}

function weekStart(seed = new Date()) { const d = new Date(seed); const day = (d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day); return d; }
function addDays(seed: Date, days: number) { const d=new Date(seed); d.setDate(d.getDate()+days); return d; }
function slotKey(value: Date | string) { const d=new Date(value); d.setSeconds(0,0); return d.toISOString(); }
const weekDays = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export function DoctorSchedule({ user, compact, onUser }: { user: User; compact: boolean; onUser:(user:User)=>void }) {
  const [week,setWeek]=useState(weekStart()); const [slots,setSlots]=useState<ScheduleSlot[]>([]); const [selected,setSelected]=useState<Set<string>>(new Set()); const [edit,setEdit]=useState(false); const [busy,setBusy]=useState(false); const [selectedDay,setSelectedDay]=useState<number|null>(null);
  const [setupOpen,setSetupOpen]=useState(!user.doctor_profile?.schedule_step);
  const [step,setStep]=useState(user.doctor_profile?.schedule_step||30);
  const [visibleDays,setVisibleDays]=useState(user.doctor_profile?.visible_days||6);
  const from=week.toISOString(), to=addDays(week,7).toISOString();
  const load=async()=>{try{const list=await api.schedule(user.id,from,to);setSlots(list);setSelected(new Set(list.filter(x=>x.status==="available").map(x=>slotKey(x.start_at))))}catch(e){Alert.alert("Расписание недоступно",e instanceof Error?e.message:"Ошибка")}};
  useEffect(()=>{void load()},[from,to]);
  const rows=Array.from({length:Math.floor((19*60+30-10*60)/step)+1},(_,i)=>{const minutes=10*60+i*step;return {h:Math.floor(minutes/60),m:minutes%60}});
  const displayDayOffsets = Array.from({length:visibleDays},(_,i)=>i);
  const visibleDayOffsets=selectedDay===null?displayDayOffsets:[selectedDay];
  const singleDay=selectedDay!==null;
  const monthStart=new Date(week.getFullYear(),week.getMonth(),1);const monthCalendarStart=weekStart(monthStart);const monthDays=Array.from({length:42},(_,i)=>addDays(monthCalendarStart,i));
  const scheduleControls=<View style={s.scheduleHeading}>{singleDay?<Pressable accessibilityRole="button" style={s.scheduleDayBack} onPress={()=>setSelectedDay(null)}><Ionicons name="arrow-back" size={21} color={colors.ink}/><Text style={s.weekTitle}>{addDays(week,selectedDay!).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}</Text></Pressable>:<View style={s.weekToolbar}><Pressable style={s.scheduleArrow} onPress={()=>{setSelectedDay(null);setWeek(addDays(week,-7))}}><Ionicons name="chevron-back" size={25} color={colors.ink}/></Pressable><Pressable onPress={()=>{setSelectedDay(null);setWeek(weekStart())}}><Text style={s.weekTitle}>{week.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — {addDays(week,visibleDays-1).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</Text></Pressable><Pressable style={s.scheduleArrow} onPress={()=>{setSelectedDay(null);setWeek(addDays(week,7))}}><Ionicons name="chevron-forward" size={25} color={colors.ink}/></Pressable></View>}<Pressable accessibilityLabel="Настроить таблицу" style={s.scheduleArrow} onPress={()=>setSetupOpen(true)}><Ionicons name="options-outline" size={21} color={colors.violet}/></Pressable><Pressable style={s.scheduleEditLight} onPress={()=>edit?void save():setEdit(true)}><Ionicons name={edit?"checkmark":"create-outline"} size={19} color={colors.brand}/><Text style={s.scheduleEditLightText}>{busy?"Сохраняем…":edit?"Готово":"Править"}</Text></Pressable></View>;
  function toggle(d:number,h:number,m:number){if(!edit)return;const value=addDays(week,d);value.setHours(h,m,0,0);if(value<=new Date())return;const key=slotKey(value);if(slots.some(x=>slotKey(x.start_at)===key&&x.status==="booked"))return;setSelected(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})}
  async function save(){setBusy(true);try{await api.saveSchedule(from,to,[...selected],step);setEdit(false);await load()}catch(e){Alert.alert("Не удалось сохранить",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  async function saveSetup(){setBusy(true);try{const p=user.doctor_profile||{};const updated=await api.updateDoctorProfile({fullName:user.full_name,specialization:user.specialization||doctorSpecialties[0]!,city:user.city||"",about:p.about||"",workplace:p.workplace||"",experience:p.experience||[],services:p.services||[],schedule_step:step,visible_days:visibleDays});onUser(updated);setSetupOpen(false)}catch(e){Alert.alert("Настройки не сохранены",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  return <View style={[s.schedulePage, compact && s.schedulePageCompact]}>
    <Modal visible={setupOpen} animationType="slide" onRequestClose={()=>setSetupOpen(false)}><View style={s.educationPage}><EducationCanvas/><SafeAreaView style={s.scheduleSetupPage}><Text style={s.fullScreenTitle}>Настройте расписание</Text><Text style={s.cardHint}>Выберите удобный масштаб таблицы. Эти параметры можно изменить позже.</Text><Text style={s.profileSectionTitle}>Шаг времени</Text><View style={s.setupChoiceGrid}>{[15,20,30,60].map(value=><Choice key={value} active={step===value} label={`${value} минут`} onPress={()=>setStep(value)}/>)}</View><Text style={s.profileSectionTitle}>Дней на экране</Text><View style={s.setupChoiceGrid}>{[3,4,5,6,7].map(value=><Choice key={value} active={visibleDays===value} label={`${value}`} onPress={()=>setVisibleDays(value)}/>)}</View><View style={{marginTop:"auto"}}><Button kind="glass" label={busy?"Сохраняем…":"Сохранить и открыть расписание"} disabled={busy} onPress={()=>void saveSetup()}/></View></SafeAreaView></View></Modal>
    {!compact&&!singleDay&&<View style={s.monthOverview}><View style={s.monthOverviewHead}><Text style={s.monthOverviewTitle}>{monthStart.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</Text><Pressable onPress={()=>{setSelectedDay(null);setWeek(weekStart())}}><Text style={s.link}>Сегодня</Text></Pressable></View><View style={s.monthWeekNames}>{weekDays.map(label=><Text key={label} style={s.monthWeekName}>{label}</Text>)}</View><View style={s.monthGrid}>{monthDays.map(day=>{const current=day.getMonth()===monthStart.getMonth();const selectedWeek=day>=week&&day<addDays(week,7);return <Pressable key={day.toISOString()} onPress={()=>{setSelectedDay(null);setWeek(weekStart(day))}} style={[s.monthDay,selectedWeek&&s.monthDaySelected]}><Text style={[s.monthDayText,!current&&s.monthDayMuted,selectedWeek&&s.monthDayTextSelected]}>{day.getDate()}</Text></Pressable>})}</View></View>}
    {edit&&<View style={s.editHint}><Ionicons name="information-circle-outline" size={20} color={colors.violet}/><Text style={s.aiDisclaimer}>Выберите будущие ячейки. Прошедшее время недоступно.</Text></View>}
    <ScrollView horizontal={!singleDay&&!compact} scrollEnabled={!compact} style={s.calendarHorizontal} contentContainerStyle={[s.calendarHorizontalContent,compact&&s.calendarHorizontalContentCompact,singleDay&&s.calendarHorizontalContentSingle]}><View style={[s.calendarInner,singleDay&&s.calendarInnerSingle]}><View style={[s.calendarHeader,compact&&s.calendarHeaderCompact]}><View style={[s.timeColumn,compact&&s.timeColumnCompact]}/>{visibleDayOffsets.map((offset)=>{const day=addDays(week,offset);return <Pressable accessibilityRole="button" accessibilityLabel={`Открыть ${day.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}`} onPress={()=>setSelectedDay(offset)} key={offset} style={[s.dayHeader,compact&&s.dayHeaderCompact,singleDay&&s.dayHeaderSingle]}><Text style={s.dayName}>{weekDays[offset]}</Text><Text style={[s.dayNumber,compact&&s.dayNumberCompact]}>{day.getDate()}</Text></Pressable>})}</View>{compact?<View style={s.calendarVerticalCompact}>{rows.map(({h,m})=><View key={`${h}-${m}`} style={[s.calendarRow,s.calendarRowCompact]}><View style={[s.timeColumn,s.timeColumnCompact]}><Text style={s.timeText}>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}</Text></View>{visibleDayOffsets.map((d)=>{const value=addDays(week,d);value.setHours(h,m,0,0);const past=value<=new Date();const key=slotKey(value);const booked=slots.find(x=>slotKey(x.start_at)===key&&x.status==="booked");const available=selected.has(key)&&!past;return <Pressable key={d} onPress={()=>edit?toggle(d,h,m):setSelectedDay(d)} style={[s.calendarCell,s.calendarCellCompact,singleDay&&s.calendarCellSingle,past&&s.pastCell,available&&s.availableCell,booked&&s.bookedCell]}><Text numberOfLines={1} style={[s.cellText,(available||booked)&&{color:colors.white}]}>{booked?(booked.patient_name||"Пользователь"):available?"•":""}</Text></Pressable>})}</View>)}</View>:<ScrollView style={s.calendarVertical} nestedScrollEnabled>{rows.map(({h,m})=><View key={`${h}-${m}`} style={s.calendarRow}><View style={s.timeColumn}><Text style={s.timeText}>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}</Text></View>{visibleDayOffsets.map((d)=>{const value=addDays(week,d);value.setHours(h,m,0,0);const past=value<=new Date();const key=slotKey(value);const booked=slots.find(x=>slotKey(x.start_at)===key&&x.status==="booked");const available=selected.has(key)&&!past;return <Pressable key={d} onPress={()=>edit?toggle(d,h,m):setSelectedDay(d)} style={[s.calendarCell,singleDay&&s.calendarCellSingle,past&&s.pastCell,available&&s.availableCell,booked&&s.bookedCell]}><Text numberOfLines={2} style={[s.cellText,(available||booked)&&{color:colors.white}]}>{booked?(booked.patient_name||"Пользователь"):available?"Доступно":""}</Text></Pressable>})}</View>)}</ScrollView>}</View></ScrollView>
    {scheduleControls}
  </View>
}



export function DoctorPatients({ patientsAnalyses, consultations, onOpen, onRefresh }: { patientsAnalyses: Analysis[]; consultations: Consultation[]; onOpen: (a: Analysis) => void; onRefresh:()=>void }) {
  const {width}=useWindowDimensions();const compact=width<640;
  const [patients,setPatients]=useState<User[]>([]);const [selectedPatient,setSelectedPatient]=useState<User|null>(null);const [notes,setNotes]=useState<PatientNote[]>([]);const [note,setNote]=useState("");const [busy,setBusy]=useState(false);const [listening,setListening]=useState(false);
  const [patientQuery,setPatientQuery]=useState("");
  const [ai,setAI]=useState<ClinicalAssistResult|null>(null);const [aiBusy,setAIBusy]=useState(false);const [answer,setAnswer]=useState<Record<string,string>>({});
  useEffect(()=>{api.patients().then(setPatients).catch(()=>setPatients([]))},[]);useEffect(()=>{if(selectedPatient)api.patientNotes(selectedPatient.id).then(setNotes).catch(()=>setNotes([]))},[selectedPatient]);
  const patientAnalyses=selectedPatient?patientsAnalyses.filter(a=>a.owner_id===selectedPatient.id):[];
  const requests=selectedPatient?consultations.filter(c=>c.patient_id===selectedPatient.id&&c.source!=="ai"):[];
  const visiblePatients=patients.filter(patient=>(patient.full_name.trim().split(/\s+/)[0]||"").toLocaleLowerCase("ru-RU").startsWith(patientQuery.trim().toLocaleLowerCase("ru-RU"))).sort((a,b)=>a.full_name.localeCompare(b.full_name,"ru"));
  const todayPatientIDs=useMemo(()=>{const now=new Date();return new Set(consultations.filter(item=>{const value=new Date(item.service_type==="appointment"&&item.appointment_at?item.appointment_at:item.created_at);return value.getFullYear()===now.getFullYear()&&value.getMonth()===now.getMonth()&&value.getDate()===now.getDate()}).map(item=>item.patient_id))},[consultations]);
  const todayPatients=visiblePatients.filter(patient=>todayPatientIDs.has(patient.id));
  async function save(){if(!selectedPatient||!note.trim())return;setBusy(true);try{await api.addPatientNote(selectedPatient.id,note.trim());setNote("");setNotes(await api.patientNotes(selectedPatient.id))}catch(e){Alert.alert("Не удалось сохранить",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  async function generateAI(){if(!selectedPatient)return;setAIBusy(true);try{setAI(await api.clinicalAssist({patientID:selectedPatient.id,objective:"",clinical:"Оцени доступные анализы и вопросы пациента. Дай структурированное резюме, красные флаги, обследования и тактику для врача."}))}catch(e){Alert.alert("AI недоступен",e instanceof Error?e.message:"Ошибка")}finally{setAIBusy(false)}}
  async function replyTo(c:Consultation){const text=answer[c.id]?.trim();if(!text)return;setBusy(true);try{await api.reply(c.id,text);setAnswer({...answer,[c.id]:""});onRefresh()}catch(e){Alert.alert("Ответ не отправлен",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  const patientRow=(p:User)=><Pressable accessibilityRole="button" key={p.id} style={s.doctorDirectoryCard} onPress={()=>setSelectedPatient(p)}><Text numberOfLines={1} style={[s.doctorDirectoryName,{flex:1}]}>{p.full_name}</Text><Text style={s.patientAge}>{p.patient_profile?`${p.patient_profile.age} лет`:"—"}</Text></Pressable>;
  if(!selectedPatient)return <View style={s.doctorPatientDirectory}><ScrollView contentContainerStyle={s.doctorPatientCards}>{todayPatients.length>0&&<><Text style={s.patientSectionTitle}>Сегодня</Text><View style={s.doctorGrid}>{todayPatients.map(patientRow)}</View></>}<Text style={s.patientSectionTitle}>Все пациенты</Text><View style={s.doctorGrid}>{visiblePatients.map(patientRow)}</View>{!visiblePatients.length&&<Text style={s.patientSearchEmpty}>{patientQuery?"Совпадений нет":"Список пациентов пуст"}</Text>}</ScrollView><View nativeID="doctor-patient-search-dock" style={s.doctorPatientSearchDock}><Ionicons name="search" size={21} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={patientQuery} onChangeText={setPatientQuery} autoCapitalize="words" placeholder="Начните вводить фамилию…"/>{patientQuery?<Pressable accessibilityRole="button" onPress={()=>setPatientQuery("")}><Ionicons name="close-circle" size={21} color={colors.muted}/></Pressable>:null}</View></View>;
  return <KeyboardAvoidingView testID="patient-record-page" behavior={Platform.OS==="ios"?"padding":undefined} style={[s.patientRecordPage,compact&&s.patientRecordPageCompact]}><View style={s.patientRecordHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.iconButton} onPress={()=>{setSelectedPatient(null);setAI(null)}}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={1} style={s.patientRecordHeaderTitle}>{selectedPatient.full_name}</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.patientRecordBody} keyboardShouldPersistTaps="handled"><View style={s.patientRecordCompact}>{selectedPatient.patient_profile?<Text style={s.analysisMeta}>{selectedPatient.patient_profile.age} лет · {selectedPatient.patient_profile.height_cm} см · {selectedPatient.patient_profile.weight_kg} кг · ИМТ {selectedPatient.patient_profile.bmi}</Text>:<Text style={s.analysisMeta}>Профиль пользователя не заполнен</Text>}</View><View style={s.patientRecordSection}><Text style={s.surveyTitle}>Анализы</Text><View style={s.compactCardGrid}>{patientAnalyses.map(a=><AnalysisCard key={a.id} item={a} onPress={()=>onOpen(a)}/>)}</View>{!patientAnalyses.length&&<Text style={s.cardHint}>Нет доступных исследований.</Text>}</View><View style={s.patientRecordSection}><View style={s.rowBetween}><Text style={s.surveyTitle}>Общее резюме</Text><Button compact label={aiBusy?"Анализ…":ai?"Обновить":"Сформировать"} disabled={aiBusy} onPress={()=>void generateAI()}/></View>{ai?<View style={s.aiSummaryCard}><Text style={s.body}>{ai.assessment}</Text><AIList title="Красные флаги" items={ai.red_flags}/><AIList title="Что проверить" items={ai.suggested_checks}/><AIList title="Тактика" items={ai.tactics}/><AIList title="Источники" items={ai.guideline_refs}/><Text style={s.aiDisclaimer}>{ai.limitations}</Text></View>:<Text style={s.cardHint}>Сформируйте резюме по доступным анализам пациента.</Text>}</View>{requests.length?<View style={s.patientRecordSection}><Text style={s.surveyTitle}>Вопросы пациента</Text>{requests.map(c=><View key={c.id} style={s.noteCard}><View style={s.rowBetween}><Text style={s.replyLabel}>{c.title||"Консультация"}</Text><Text style={s.analysisMeta}>{date(c.created_at)}</Text></View><Text style={s.body}>{c.question}</Text>{c.reply?<View style={s.replyBox}><Text style={s.replyLabel}>Ваш ответ</Text><Text style={s.body}>{c.reply}</Text></View>:<><TextInput multiline style={[s.input,s.replyInput]} placeholder="Ответ пациенту…" value={answer[c.id]||""} onChangeText={v=>setAnswer({...answer,[c.id]:v})}/><View style={s.complaintActions}><Pressable style={s.micButton} onPress={()=>{const setter:React.Dispatch<React.SetStateAction<string>> = value=>setAnswer(current=>({...current,[c.id]:typeof value==="function"?value(current[c.id]||""):value}));startDictation(setter,setListening)}}><Ionicons name="mic-outline" size={20} color={colors.violet}/></Pressable><Button compact disabled={busy||!answer[c.id]?.trim()} label="Ответить" onPress={()=>void replyTo(c)}/></View></>}</View>)}</View>:null}{notes.length?<View style={s.patientRecordSection}><Text style={s.surveyTitle}>Заключения в карте</Text>{notes.map(n=><View key={n.id} style={s.noteCard}><View style={s.rowBetween}><Text style={s.replyLabel}>Заключение</Text><Text style={s.analysisMeta}>{date(n.created_at)}</Text></View><Text style={s.body}>{n.text}</Text></View>)}</View>:null}</ScrollView><View nativeID="doctor-note-composer-dock" style={s.patientNoteDock}><Pressable accessibilityRole="button" accessibilityLabel="Продиктовать" style={[s.patientNoteMic,listening&&s.micButtonActive]} onPress={()=>startDictation(setNote,setListening)}><Ionicons name={listening?"radio":"mic-outline"} size={22} color={listening?colors.white:colors.violet}/></Pressable><TextInput multiline maxLength={5000} style={s.patientNoteInput} placeholder="Заключение в карту…" value={note} onChangeText={setNote}/><Pressable accessibilityRole="button" accessibilityLabel="Сохранить заключение" disabled={busy||!note.trim()} style={[s.sendButton,(busy||!note.trim())&&{opacity:.35}]} onPress={()=>void save()}>{busy?<ActivityIndicator size="small" color={colors.violet}/>:<Ionicons name="checkmark" size={23} color={colors.violet}/>}</Pressable></View></KeyboardAvoidingView>
}


const newArticle=():ClinicalArticle=>({id:"",title:"",summary:"",cover_url:"",published:false,blocks:[],created_at:"",updated_at:""});
export function ArticleManager({user}:{user:User}){
  const [items,setItems]=useState<ClinicalArticle[]>([]);const [editing,setEditing]=useState<ClinicalArticle|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const load=()=>api.articles().then(list=>setItems(list.filter(item=>item.doctor_id===user.id))).catch(e=>setError(e instanceof Error?e.message:"Не удалось загрузить публикации"));useEffect(()=>{void load()},[user.id]);
  const update=(patch:Partial<ClinicalArticle>)=>setEditing(current=>current?{...current,...patch}:current);
  const updateBlock=(index:number,patch:Partial<ArticleBlock>)=>setEditing(current=>current?{...current,blocks:current.blocks.map((block,i)=>i===index?{...block,...patch}:block)}:current);
  const addBlock=(type:"text"|"image")=>setEditing(current=>current?{...current,blocks:[...current.blocks,{id:`block-${Date.now()}-${current.blocks.length}`,type,text:"",image_url:"",caption:""}]}:current);
  async function chooseImage(index:number){const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:.9});if(result.canceled)return;const asset=result.assets[0]!;setBusy(true);setError("");try{const uploaded=await api.uploadArticleImage({uri:asset.uri,name:asset.fileName||`article-${Date.now()}.jpg`,mimeType:asset.mimeType,file:(asset as any).file});updateBlock(index,{image_url:uploaded.url});setEditing(current=>current&&current.cover_url?current:current?{...current,cover_url:uploaded.url}:current)}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить изображение")}finally{setBusy(false)}}
  async function save(){if(!editing||!editing.title.trim())return;setBusy(true);setError("");const payload={title:editing.title.trim(),summary:editing.summary.trim(),cover_url:editing.cover_url||editing.blocks.find(block=>block.image_url)?.image_url||"/clinical-carotid-overview.svg",published:editing.published,blocks:editing.blocks};try{if(editing.id)await api.updateArticle(editing.id,payload);else await api.createArticle(payload);setEditing(null);await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить публикацию")}finally{setBusy(false)}}
  async function toggle(item:ClinicalArticle){try{await api.updateArticle(item.id,{title:item.title,summary:item.summary,cover_url:item.cover_url,published:!item.published,blocks:item.blocks});await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось изменить публикацию")}}
  async function remove(item:ClinicalArticle){if(Platform.OS==="web"&&!window.confirm(`Удалить «${item.title}»?`))return;try{await api.deleteArticle(item.id);await load()}catch(e){setError(e instanceof Error?e.message:"Не удалось удалить публикацию")}}
  if(editing)return <ScrollView contentContainerStyle={s.articleManager}><View style={s.articleManagerToolbar}><Pressable style={s.backLink} onPress={()=>setEditing(null)}><Ionicons name="arrow-back" size={20} color={colors.brand}/><Text style={s.link}>К списку</Text></Pressable><Button compact label={busy?"Сохраняем…":"Сохранить"} disabled={busy||!editing.title.trim()} onPress={()=>void save()}/></View>{error?<Text style={s.error}>{error}</Text>:null}<View style={s.articleEditorMeta}><Field label="Заголовок" value={editing.title} onChangeText={(title:string)=>update({title})}/><Field label="Краткое описание" multiline value={editing.summary} onChangeText={(summary:string)=>update({summary})}/><Pressable onPress={()=>update({published:!editing.published})} style={s.publishToggle}><View style={[s.consentBox,editing.published&&s.consentBoxChecked]}>{editing.published&&<Ionicons name="checkmark" size={16} color={colors.white}/>}</View><Text style={s.consentLabel}>Показывать пользователям</Text></Pressable></View><View style={s.articleBlocksHeader}><Text style={s.sectionTitle}>Содержание</Text><View style={s.articleBlockActions}><MiniAction label="Текст" icon="text-outline" onPress={()=>addBlock("text")}/><MiniAction label="Изображение" icon="image-outline" onPress={()=>addBlock("image")}/></View></View><View style={s.articleBuilder}>{editing.blocks.map((block,index)=><View key={block.id} style={s.articleBuilderBlock}><View style={s.rowBetween}><Text style={s.replyLabel}>{block.type==="text"?"Текстовый блок":"Изображение"}</Text><Pressable onPress={()=>setEditing(current=>current?{...current,blocks:current.blocks.filter((_,i)=>i!==index)}:current)}><Ionicons name="trash-outline" size={21} color={colors.coral}/></Pressable></View>{block.type==="text"?<TextInput multiline style={[s.input,s.articleTextBlock]} placeholder="Текст публикации…" value={block.text||""} onChangeText={text=>updateBlock(index,{text})}/>:<>{block.image_url?<Image source={{uri:articleImageURI(block.image_url)}} style={s.articleBuilderImage}/>:<Pressable style={s.articleImagePlaceholder} onPress={()=>void chooseImage(index)}><Ionicons name="image-outline" size={34} color={colors.brand}/><Text style={s.link}>Выбрать изображение</Text></Pressable>}<Field label="Подпись" value={block.caption||""} onChangeText={(caption:string)=>updateBlock(index,{caption})}/>{block.image_url?<MiniAction label="Заменить" icon="images-outline" onPress={()=>void chooseImage(index)}/>:null}</>}</View>)}</View></ScrollView>;
  return <ScrollView contentContainerStyle={s.articleManager}><View style={s.articleManagerToolbar}><Text style={s.sectionIntro}>Клинические материалы для пользовательской витрины</Text><Button compact icon="add" label="Новая публикация" onPress={()=>setEditing(newArticle())}/></View>{error?<Text style={s.error}>{error}</Text>:null}<View style={s.articleAdminList}>{items.map(item=><Pressable key={item.id} style={s.articleAdminRow} onPress={()=>setEditing(item)}><Image source={{uri:articleImageURI(item.cover_url)}} style={s.articleAdminThumb}/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.doctorDirectoryName}>{item.title}</Text><Text numberOfLines={1} style={s.analysisMeta}>{item.summary}</Text></View><Pressable accessibilityRole="checkbox" accessibilityState={{checked:item.published}} hitSlop={8} onPress={event=>{event.stopPropagation();void toggle(item)}} style={[s.consentBox,item.published&&s.consentBoxChecked]}>{item.published&&<Ionicons name="checkmark" size={16} color={colors.white}/>}</Pressable><Pressable hitSlop={8} onPress={event=>{event.stopPropagation();void remove(item)}} style={s.deleteCardButton}><Ionicons name="trash-outline" size={19} color={colors.coral}/></Pressable></Pressable>)}</View>{!items.length?<Empty icon="newspaper-outline" title="Публикаций пока нет" text="Создайте материал из текстовых и графических блоков."/>:null}</ScrollView>
}

export function DoctorsScreen({ user, onUser, onRefresh, initialDoctorID, onTargetHandled, onTargetBack }: { user: User; onUser:(user:User)=>void; onRefresh: () => void; initialDoctorID?: string; onTargetHandled?: () => void; onTargetBack?: () => void }) {
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoctorValue, setSelectedDoctor] = useState<User | null>(null);
  // The following early-return branches guarantee a doctor before the detail
  // view renders; the assertion keeps that invariant visible to TypeScript.
  const selectedDoctor = selectedDoctorValue as User;
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
  const [success, setSuccess] = useState<{ serviceType: "consultation" | "appointment" | "home_visit"; at?: string } | null>(null);
  const [specialty,setSpecialty]=useState<string|null>(null);
  const [scope,setScope]=useState<"city"|"all">("city");
  const bookingScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const revealBookingField = () => setTimeout(() => bookingScroll.current?.scrollToEnd({ animated: true }), 140);

  useEffect(() => {
    if (user.role === "patient") api.doctors("",scope==="city"?user.city||"":"").then(setDoctors).catch(() => setDoctors([]));
  }, [user.role,user.city,scope]);
  useEffect(() => {
    if (!doctors.length || selectedDoctor || !initialDoctorID) return;
    const doctor = doctors.find((item) => item.id === initialDoctorID);
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
      setSuccess({serviceType,at});
    } catch (error) {
      Alert.alert("Не удалось отправить", error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  if (user.role === "doctor") return <ScrollView contentContainerStyle={s.scroll}><Empty icon="medical-outline" title="Каталог коллег" text="Раздел готовится." /></ScrollView>;
  if (!user.online_clinic) return <View style={s.clinicDisabled}><Ionicons name="medkit-outline" size={42} color={colors.violet}/><Text style={s.bookingActionTitle}>Онлайн-поликлиника выключена</Text><Text style={s.cardHint}>При включённой опции здесь появятся специальности и врачи, готовые ответить на вопрос, дать короткую консультацию или предложить время личного приёма по месту работы.</Text><Button kind="glass" label="Перейти в настройки" onPress={async()=>{try{onUser(await api.updateSettings(true))}catch(e){Alert.alert("Не удалось включить",e instanceof Error?e.message:"Ошибка")}}}/></View>;
  const specialtyFor=(doctor:User)=>/идрисов|marat/i.test(doctor.full_name)?"Кардиолог / аритмолог":doctor.specialization||"Терапевт";
  if (!selectedDoctor && !specialty) return <View style={s.specialtyDirectoryPage}><ScrollView style={s.specialtyDirectoryScroll} contentContainerStyle={s.specialtyDirectoryContent} keyboardShouldPersistTaps="handled"><View style={s.directoryScope}><Text style={s.directoryTitle}>Специальности</Text><Pressable onPress={()=>setScope(current=>current==="city"?"all":"city")} style={s.scopeButton}><Ionicons name="location-outline" size={17} color={colors.violet}/><Text style={s.scopeButtonText}>{scope==="city"?(user.city||"Мой город"):"Все"}</Text></Pressable></View>{doctorSpecialties.map(item=>{const count=doctors.filter(doctor=>specialtyFor(doctor).toLocaleLowerCase("ru").includes(item.replace(/\s*\/.*$/, "").toLocaleLowerCase("ru"))).length;return <Pressable key={item} style={s.specialtyDirectoryRow} onPress={()=>setSpecialty(item)}><View style={s.patientMenuItemIcon}><Ionicons name="medical-outline" size={21} color={colors.violet}/></View><View style={{flex:1}}><Text style={s.patientMenuItemTitle}>{item}</Text><Text style={s.patientMenuItemHint}>{count?`${count} ${count===1?"специалист":"специалиста"}`:"Специалистов пока нет"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>})}</ScrollView></View>;
  if (!selectedDoctor && specialty) { const list=doctors.filter(doctor=>specialtyFor(doctor).toLocaleLowerCase("ru").includes(specialty.replace(/\s*\/.*$/, "").toLocaleLowerCase("ru")));return <View style={s.specialtyDirectoryPage}><ScreenHeader title={specialty} onBack={()=>setSpecialty(null)}/><ScrollView style={s.specialtyDirectoryScroll} contentContainerStyle={s.specialtyDirectoryList} keyboardShouldPersistTaps="handled">{list.map(doctor=><Pressable key={doctor.id} style={s.doctorListCard} onPress={()=>setSelectedDoctor(doctor)}><AvatarView user={doctor}/><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{doctor.full_name}</Text><Text style={s.analysisMeta}>{doctor.city||"Город не указан"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>)}{!list.length?<Text style={s.patientSearchEmpty}>Специалистов пока нет</Text>:null}</ScrollView></View> }
  if (success) return <View style={s.bookingSuccessPage}><AmbientCanvas/><SafeAreaView style={s.bookingSuccessSafe}><View style={s.bookingSuccessHeader}><BackButton onPress={()=>{setSuccess(null);setAction("profile");onTargetBack?.()}}/></View><View style={s.bookingSuccessBody}><View style={s.bookingSuccessMark}><Ionicons name="checkmark" size={46} color={colors.white}/></View><Text style={s.bookingSuccessTitle}>{success.serviceType==="appointment"?"Приём запланирован":"Запрос сформирован"}</Text><Text style={s.bookingSuccessLead}>{success.serviceType==="appointment"?"Запись подтверждена. Информация о приёме уже появилась на главном экране.":"Врач получил ваш запрос. Ответ появится на главном экране и во вкладке «Чат»."}</Text><View style={s.bookingSuccessDetails}><Text style={s.bookingSuccessDoctor}>{selectedDoctor.full_name}</Text>{success.at?<Text style={s.bookingSuccessDetail}>{new Date(success.at).toLocaleString("ru-RU",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})}</Text>:<Text style={s.bookingSuccessDetail}>Ответ — после рассмотрения врачом</Text>}{success.serviceType==="appointment"&&<Text style={s.bookingSuccessDetail}>{selectedDoctor.doctor_profile?.workplace||selectedDoctor.city||"Место приёма врач уточнит в сообщении"}</Text>}</View></View></SafeAreaView></View>;
  const doctorScreenTitle=action==="profile"?(specialty||specialtyFor(selectedDoctor)):action==="consultation"?"Запрос консультации":"Запись на приём";
  const closeDoctor=()=>{setAction("profile");setSelectedDoctor(null);if(!specialty)onTargetBack?.()};
  return <KeyboardAvoidingView testID="booking-page" behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.directBookingPage}>
        {pendingRequest && <View style={s.consentWarning}>
          <View style={s.consentWarningHead}><Ionicons name="warning-outline" size={22} color={colors.amber}/><Text style={s.consentWarningTitle}>Нужно ваше согласие</Text></View>
          <Text style={s.consentWarningText}>Для передачи врачу запроса отметьте согласие на обработку персональных данных и доступ к данным обследований.</Text>
          <View style={s.consentWarningActions}><Button compact kind="ghost" label="Понятно" onPress={() => setPendingRequest(null)}/></View>
        </View>}
        <ScreenHeader title={doctorScreenTitle} onBack={action==="profile"?closeDoctor:()=>setAction("profile")}/>
        <ScrollView ref={bookingScroll} contentContainerStyle={[s.directBookingBody,action!=="profile"&&s.directBookingBodyAction]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {action === "profile" ? <>
            <View style={s.doctorInlineIdentity}><View style={{flex:1}}><Text style={s.doctorInlineName}>{selectedDoctor.full_name}</Text></View></View>
            <View style={s.doctorProfileActions}><Button label="Запросить консультацию" icon="chatbubble-outline" kind="glass" onPress={() => setAction("consultation")}/><Button label="Записаться на приём" icon="calendar-outline" kind="glass" onPress={() => setAction("appointment")}/>{selectedDoctor?.home_visits && <Button label="Вызвать на дом" icon="home-outline" kind="glass" disabled={busy} onPress={() => void request("home_visit")}/>}</View>
            <View style={s.doctorBio}>{selectedDoctor.doctor_profile?.workplace?<Text style={s.doctorBioLead}>{selectedDoctor.doctor_profile.workplace}</Text>:null}<Text style={s.doctorBioText}>{selectedDoctor.doctor_profile?.about||(/идрисов|marat/i.test(selectedDoctor.full_name)?"Стаж — 15 лет, выполнено более 5 000 операций. Большой опыт наблюдения и лечения сердечно-сосудистых заболеваний.":"Врач пока не добавил подробное описание профиля.")}</Text>{(selectedDoctor.doctor_profile?.experience?.length||/идрисов|marat/i.test(selectedDoctor.full_name))?<View style={s.doctorBioList}>{(selectedDoctor.doctor_profile?.experience?.length?selectedDoctor.doctor_profile.experience:["ишемическая болезнь сердца и гипертоническая болезнь","фибрилляция предсердий и имплантированные устройства","атеросклероз сонных артерий","ишемия нижних конечностей при атеросклерозе и сахарном диабете"]).map(item=><View key={item} style={s.doctorBioBulletRow}><Text style={s.doctorBioBullet}>•</Text><Text style={s.doctorBioBulletText}>{item}</Text></View>)}</View>:null}{selectedDoctor.doctor_profile?.services?.length?<Text style={s.doctorBioText}>{selectedDoctor.doctor_profile.services.join(" · ")}</Text>:null}</View>
          </> : action === "consultation" ? <>
            <Field label="Вопрос врачу" multiline value={question} onFocus={revealBookingField} onChangeText={setQuestion}/>
            <ConsentControls personal={personalConsent} medical={medicalConsent} onPersonal={setPersonalConsent} onMedical={setMedicalConsent}/>
          </> : <>
            {slotsBusy ? <ActivityIndicator color={colors.brand}/> : slotsError ? <Text style={s.error}>{slotsError}</Text> : availableSlots.length ? <View style={s.slotGroups}>{availableSlots.map((slot) => <Choice key={slot.id} active={appointmentAt === slot.start_at} label={new Date(slot.start_at).toLocaleString("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} onPress={() => setAppointmentAt(slot.start_at)}/>)}</View> : <Empty icon="calendar-outline" title="Будущих часов пока нет" text="Врач ещё не открыл новые ячейки."/>}
            <Field label="Комментарий (необязательно)" multiline value={question} onFocus={revealBookingField} onChangeText={setQuestion}/>
            <ConsentControls personal={personalConsent} medical={medicalConsent} onPersonal={setPersonalConsent} onMedical={setMedicalConsent}/>
          </>}
        </ScrollView>
        {action!=="profile"&&<View nativeID="booking-action-dock" style={s.bookingActionDock}><View style={{flex:1}}><Button label={action==="consultation"?(busy?"Отправляем…":"Отправить запрос"):(busy?"Записываем…":"Подтвердить запись")} kind="glass" disabled={busy||!personalConsent||!medicalConsent||(action==="appointment"&&!appointmentAt)} onPress={()=>action==="consultation"?request("consultation"):request("appointment",appointmentAt)}/></View></View>}
  </KeyboardAvoidingView>;
}
