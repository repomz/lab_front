import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { api, API_URL, restoreToken, setToken } from "./src/api";
import { ActivitySurvey, AIChat, Analysis, Consultation, Guide, NutritionSurvey, PatientNote, Role, ScheduleSlot, User } from "./src/types";
import { colors, shadow } from "./src/theme";

type Tab = "home" | "analyses" | "patients" | "consultations" | "doctors" | "ai" | "guides" | "profile";
type Asset = { uri: string; name: string; mimeType?: string; file?: Blob };
const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || "0.4.0";
const icon: Record<Tab, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  analyses: "flask-outline",
  patients: "people-outline",
  consultations: "chatbubbles-outline",
  doctors: "medkit-outline",
  ai: "sparkles-outline",
  guides: "library-outline",
  profile: "person-outline",
};
const labels: Record<Tab, string> = {
  home: "Главная",
  analyses: "Анализы",
  patients: "Пациенты",
  consultations: "Консультации",
  doctors: "Врачи",
  ai: "AI",
  guides: "Guides",
  profile: "Профиль",
};
const tabsFor = (role: Role): Tab[] => role === "doctor"
  ? ["home", "patients", "ai", "guides", "profile"]
  : ["home", "analyses", "consultations", "doctors", "profile"];

export default function App() {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [upload, setUpload] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const compact = width < 640;
  async function refresh(u = user) {
    if (!u) return;
    const [a, c] = await Promise.all([api.analyses(), api.consultations()]);
    setAnalyses(a);
    setConsultations(c);
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
      try {
        if (await restoreToken()) {
          const u = await api.me();
          setUser(u);
          await refresh(u);
        }
      } catch {
        await setToken("");
      } finally {
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
          await refresh(u);
        }}
      />
    );
  const content =
    tab === "home" ? (
      <Home
        compact={compact}
        user={user}
        analyses={analyses}
        onOpen={setSelected}
        onTab={setTab}
        onUser={setUser}
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
      <DoctorPatients patientsAnalyses={analyses} onOpen={setSelected} />
    ) : tab === "consultations" ? (
      <Consultations
        data={consultations}
        user={user}
        onRefresh={() => refresh()}
      />
    ) : tab === "doctors" ? (
      <DoctorsScreen
        user={user}
        analyses={analyses}
        onRefresh={() => refresh()}
      />
    ) : tab === "ai" ? (
      <AIWorkspace />
    ) : tab === "guides" ? (
      <Guides />
    ) : (
      <Profile
        user={user}
        onUpdated={setUser}
        onLogout={async () => {
          await setToken("");
          setUser(null);
          setAnalyses([]);
        }}
      />
    );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        {desktop && <Sidebar user={user} tab={tab} onTab={setTab} />}
        <View style={s.main}>
          <View style={[s.top, compact && s.topCompact]}>
            <View>
              <Text style={[s.eyebrow, compact && s.eyebrowCompact]}>
                LAB HEALTH · v{APP_VERSION}
              </Text>
              <Text style={[s.pageTitle, compact && s.pageTitleCompact]}>
                {labels[tab]}
              </Text>
            </View>
            <View style={[s.avatar, compact && s.avatarCompact]}>
              <Text style={s.avatarText}>{initials(user.full_name)}</Text>
            </View>
          </View>
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
  );
}

function Auth({ onDone }: { onDone: (u: User, t: string) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("patient");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    specialization: "",
    licenseNumber: "",
    age: "",
    heightCM: "",
    weightKG: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r =
        mode === "login"
          ? await api.login(form.email, form.password)
          : await api.register({
              ...form,
              role,
              age: role === "patient" ? Number(form.age) : undefined,
              heightCM: role === "patient" ? Number(form.heightCM) : undefined,
              weightKG: role === "patient" ? Number(form.weightKG) : undefined,
            });
      onDone(r.user, r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={[s.authPage, compact && s.authPageCompact]}>
      <StatusBar style={compact ? "light" : "dark"} />
      <LinearGradient
        colors={["#17214B", "#3D367A", "#146E78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.authAside, compact && s.authAsideCompact]}
      >
        <View style={s.authOrbOne} />
        <View style={s.authOrbTwo} />
        <Text style={s.authVersion}>LAB HEALTH · v{APP_VERSION}</Text>
        <View style={[s.logo, compact && { marginTop: 32 }]}>
          <Ionicons name="pulse" size={26} color={colors.white} />
        </View>
        <Text style={[s.authHero, compact && s.authHeroCompact]}>
          Все результаты здоровья — в одной понятной истории.
        </Text>
        {!compact && (
          <Text style={s.authSub}>
            Загрузите бланк, получите структурированный результат и при
            необходимости безопасно откройте его врачу.
          </Text>
        )}
        {!compact && (
          <View style={s.authPoint}>
            <Ionicons name="shield-checkmark" size={22} color={colors.mint} />
            <Text style={s.authPointText}>
              Контролируемый доступ и медицинский дисклеймер
            </Text>
          </View>
        )}
      </LinearGradient>
      <ScrollView
        style={compact && s.authScrollCompact}
        contentContainerStyle={[s.authForm, compact && s.authFormCompact]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.authCard, compact && s.authCardCompact]}>
          <Text style={s.cardTitle}>
            {mode === "login" ? "С возвращением" : "Создать профиль"}
          </Text>
          <Text style={s.cardHint}>
            {mode === "login"
              ? "Войдите, чтобы открыть свою медицинскую историю."
              : "Выберите роль и заполните основные данные."}
          </Text>
          {mode === "register" && (
            <>
              <View style={s.segment}>
                <Segment
                  active={role === "patient"}
                  label="Я пациент"
                  icon="person"
                  onPress={() => setRole("patient")}
                />
                <Segment
                  active={role === "doctor"}
                  label="Я врач"
                  icon="medkit"
                  onPress={() => setRole("doctor")}
                />
              </View>
              <Field
                label="Имя (необязательно)"
                value={form.fullName}
                onChangeText={(v: string) => setForm({ ...form, fullName: v })}
              />
              {role === "doctor" && (
                <>
                  <Field
                    label="Специализация"
                    placeholder="Например, эндокринолог"
                    value={form.specialization}
                    onChangeText={(v: string) =>
                      setForm({ ...form, specialization: v })
                    }
                  />
                  <Field
                    label="Номер лицензии (необязательно)"
                    value={form.licenseNumber}
                    onChangeText={(v: string) =>
                      setForm({ ...form, licenseNumber: v })
                    }
                  />
                </>
              )}
              {role === "patient" && (
                <View style={s.registrationVitals}>
                  <Field
                    label="Возраст"
                    keyboardType="number-pad"
                    placeholder="35"
                    value={form.age}
                    onChangeText={(v: string) => setForm({ ...form, age: v })}
                  />
                  <Field
                    label="Рост, см"
                    keyboardType="decimal-pad"
                    placeholder="175"
                    value={form.heightCM}
                    onChangeText={(v: string) => setForm({ ...form, heightCM: v })}
                  />
                  <Field
                    label="Вес, кг"
                    keyboardType="decimal-pad"
                    placeholder="70"
                    value={form.weightKG}
                    onChangeText={(v: string) => setForm({ ...form, weightKG: v })}
                  />
                </View>
              )}
            </>
          )}
          <Field
            label="Логин"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v: string) => setForm({ ...form, email: v })}
          />
          <Field
            label="Пароль"
            secureTextEntry
            value={form.password}
            onChangeText={(v: string) => setForm({ ...form, password: v })}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            label={
              busy
                ? "Подождите…"
                : mode === "login"
                  ? "Войти"
                  : "Зарегистрироваться"
            }
            onPress={submit}
            disabled={busy}
          />
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            <Text style={s.switchText}>
              {mode === "login"
                ? "Нет аккаунта? Создать"
                : "Уже есть аккаунт? Войти"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Home({
  compact,
  user,
  analyses,
  onOpen,
  onTab,
  onUser,
}: {
  compact: boolean;
  user: User;
  analyses: Analysis[];
  onOpen: (a: Analysis) => void;
  onTab: (t: Tab) => void;
  onUser: (u: User) => void;
}) {
  const [wellness, setWellness] = useState<"activity" | "nutrition" | null>(null);
  const age = user.patient_profile?.age || 35;
  const ageTone = age < 40 ? "young" : age < 65 ? "middle" : "senior";
  if (user.role === "doctor") {
    return <DoctorSchedule user={user} compact={compact} />;
  }
  return (
    <ScrollView contentContainerStyle={[s.patientHome, compact && s.patientHomeCompact]}>
      <LinearGradient
        colors={["#17214B", "#3C3A86", "#147D83"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.welcome, s.patientWelcome, compact && s.patientWelcomeCompact]}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.welcomeOver}>ВАШ ПЕРСОНАЛЬНЫЙ ПЛАН</Text>
          <Text style={[s.welcomeTitle, compact && s.welcomeTitleCompact]}>
            Здравствуйте, {firstName(user.full_name)}
          </Text>
          <Text style={[s.welcomeText, compact && s.welcomeTextCompact]}>{user.patient_profile ? `${age} лет · ИМТ ${user.patient_profile.bmi}` : "Заполните возраст, рост и вес в профиле"}</Text>
        </View>
      </LinearGradient>
      <WellnessVideoCard ageTone={ageTone} onPress={() => setWellness("activity")} />
      <Pressable onPress={() => setWellness("nutrition")} style={({ pressed }) => [s.nutritionHomeCard, pressed && { opacity: 0.82 }]}>
        <View style={s.wellnessCardHead}>
          <View style={s.wellnessIcon}><Ionicons name="nutrition-outline" size={22} color={colors.violet} /></View>
          <View style={{ flex: 1 }}><Text style={s.wellnessTitle}>Правильное питание</Text><Text style={s.wellnessSubtitle}>{ageTone === "young" ? "Энергия, белок и регулярный режим" : ageTone === "middle" ? "Баланс, клетчатка и контроль порций" : "Достаточный белок, вода и простая еда"}</Text></View>
          <Ionicons name="arrow-forward-circle" size={31} color={colors.violet} />
        </View>
        <View style={s.foodInfographic}>
          <FoodPart icon="leaf-outline" value="½" label="овощи" color={colors.aqua} />
          <FoodPart icon="fish-outline" value="¼" label="белок" color={colors.blue} />
          <FoodPart icon="ellipse-outline" value="¼" label="крупы" color={colors.violet} />
        </View>
      </Pressable>
      <WellnessModal kind={wellness} user={user} analyses={analyses} onClose={() => setWellness(null)} onUser={onUser} />
    </ScrollView>
  );
}

function WellnessVideoCard({ ageTone, onPress }: { ageTone: "young" | "middle" | "senior"; onPress: () => void }) {
  const source = ageTone === "young" ? "https://videos.pexels.com/video-files/30694240/13134519_640_360_30fps.mp4" : ageTone === "middle" ? "https://videos.pexels.com/video-files/8795486/8795486-sd_960_506_24fps.mp4" : "https://videos.pexels.com/video-files/8173053/8173053-sd_640_360_30fps.mp4";
  const player = useVideoPlayer(source, (instance) => { instance.loop = true; instance.muted = true; instance.play(); });
  const copy = ageTone === "young" ? ["Активная жизнь", "Бег, игры и тренировки"] : ageTone === "middle" ? ["Движение каждый день", "Ходьба, походы и гимнастика"] : ["Мягкая активность", "Прогулки, баланс и лёгкие движения"];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.videoHomeCard, pressed && { opacity: 0.88 }]}>
      <VideoView player={player} style={s.homeVideo} nativeControls={false} contentFit="cover" />
      <LinearGradient colors={["#10182ACC", "#10182A1A"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={s.videoOverlay}>
        <View style={{ flex: 1 }}><Text style={s.videoEyebrow}>АКТИВНЫЙ ОБРАЗ ЖИЗНИ</Text><Text style={s.videoTitle}>{copy[0]}</Text><Text style={s.videoSubtitle}>{copy[1]}</Text></View>
        <View style={s.videoArrow}><Ionicons name="arrow-forward" size={24} color={colors.white} /></View>
      </LinearGradient>
    </Pressable>
  );
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
      <View style={s.modalBackdrop}><View style={s.wellnessSheet}>
        <View style={s.rowBetween}><View><Text style={s.eyebrow}>ПЕРСОНАЛЬНЫЙ РАЗДЕЛ</Text><Text style={s.cardTitle}>{kind === "activity" ? "Активный образ жизни" : "Правильное питание"}</Text></View><Pressable style={s.iconButton} onPress={onClose}><Ionicons name="close" size={26} color={colors.ink} /></Pressable></View>
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
      </View></View>
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
  const [dynamicView, setDynamicView] = useState<"list" | "chart">("list");
  const groups = useMemo(() => {
    const grouped = new Map<string, Analysis[]>();
    data.forEach((analysis) => {
      const key = analysis.category || analysis.title || "Лабораторные исследования";
      grouped.set(key, [...(grouped.get(key) || []), analysis]);
    });
    return Array.from(grouped.entries());
  }, [data]);
  const markerNames = useMemo(() => Array.from(new Set(data.flatMap((analysis) => analysis.markers.map((item) => item.name)))).sort(), [data]);
  const series = useMemo(() => data.flatMap((analysis) => analysis.markers.filter((item) => item.name === marker && item.value !== undefined).map((item) => ({ date: analysis.created_at, value: item.value!, unit: item.unit || "", status: item.status }))).sort((a, b) => a.date.localeCompare(b.date)), [data, marker]);
  const overall = data.find((analysis) => analysis.ai_review?.doctor_needed)?.ai_review || data[0]?.ai_review;
  return (
    <ScrollView contentContainerStyle={[s.scroll, compact && s.scrollCompact]}>
      <View style={[s.rowBetween, compact && s.analysesIntroCompact]}>
        <Text style={s.sectionIntro}>
          {doctor
            ? "Доступ предоставлен пациентами"
            : "Документы и унифицированные показатели"}
        </Text>
        {!doctor && (
          <Button
            label="Загрузить"
            icon="cloud-upload-outline"
            compact
            onPress={onUpload}
          />
        )}
      </View>
      {!doctor && data.length > 0 && overall ? <View style={[s.healthSummary, overall.doctor_needed && s.healthSummaryAlert]}><View style={s.healthSummaryHead}><Ionicons name={overall.doctor_needed ? "medical-outline" : "shield-checkmark-outline"} size={22} color={overall.doctor_needed ? colors.coral : colors.aqua} /><Text style={s.reviewTitle}>Кратко о состоянии</Text></View><Text style={s.body} numberOfLines={3}>{overall.summary}</Text>{overall.suggested_specialty ? <Text style={s.specialtyLine}>Рекомендуемый специалист: {overall.suggested_specialty}</Text> : null}</View> : null}
      {!doctor && <View style={s.segment}><Segment active={mode === "research"} label="Исследования" icon="documents-outline" onPress={() => setMode("research")} /><Segment active={mode === "dynamics"} label="Динамика" icon="stats-chart-outline" onPress={() => setMode("dynamics")} /></View>}
      {data.length && (doctor || mode === "research") ? (
        <View style={s.analysisGroups}>{groups.map(([group, items]) => <View key={group} style={s.analysisGroup}><View style={s.groupTitleRow}><Text style={s.groupTitle}>{group}</Text><Text style={s.groupCount}>{items.length}</Text></View><View style={s.compactCardGrid}>{items.map((analysis) => <AnalysisCard key={analysis.id} item={analysis} onPress={() => onOpen(analysis)} onDelete={onDelete ? () => onDelete(analysis) : undefined} />)}</View></View>)}</View>
      ) : data.length && mode === "dynamics" ? (
        <View style={s.dynamicsPanel}>
          <Text style={s.surveyTitle}>Выберите показатель</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.markerPicker}>{markerNames.map((name) => <Choice key={name} active={marker === name} label={name} onPress={() => setMarker(name)} />)}</ScrollView>
          {marker ? <><View style={s.viewSwitch}><Choice active={dynamicView === "list"} label="Список" onPress={() => setDynamicView("list")} /><Choice active={dynamicView === "chart"} label="График" onPress={() => setDynamicView("chart")} /></View>{series.length > 1 ? dynamicView === "list" ? <View style={s.dynamicList}>{series.map((point) => <View key={point.date} style={s.dynamicRow}><Text style={s.analysisMeta}>{date(point.date)}</Text><Text style={s.markerValue}>{point.value} {point.unit}</Text><Status value={point.status} /></View>)}</View> : <DynamicsChart series={series} /> : <Empty icon="stats-chart-outline" title="Недостаточно данных" text="Для оценки динамики показатель должен быть распознан минимум в двух исследованиях." />}</> : <Empty icon="finger-print-outline" title="Выберите показатель" text="Покажем его значения по датам списком или графиком." />}
        </View>
      ) : (
        <Empty
          icon="documents-outline"
          title="Здесь появится история"
          text="Поддерживаются фотографии, изображения из галереи и PDF."
        />
      )}
    </ScrollView>
  );
}

function DynamicsChart({ series }: { series: Array<{ date: string; value: number; unit: string; status: string }> }) {
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return <View style={s.chartCard}><View style={s.chartBars}>{series.map((point) => { const height = 36 + ((point.value - min) / span) * 104; return <View key={point.date} style={s.chartColumn}><Text style={s.chartValue}>{point.value}</Text><View style={[s.chartBar, { height }, (point.status === "high" || point.status === "low") && s.chartBarAlert]} /><Text style={s.chartDate}>{date(point.date)}</Text></View>; })}</View><Text style={s.chartUnit}>{series[0]?.unit}</Text></View>;
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
  const out = item.markers.filter(
    (m) => m.status === "high" || m.status === "low",
  ).length;
  const recognized = item.status === "ready" && item.markers.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть результат: ${item.title}`}
      style={({ pressed }) => [
        s.analysisCard,
        !recognized
          ? s.analysisCardReview
          : out
            ? s.analysisCardAlert
            : s.analysisCardReady,
        pressed && { opacity: 0.78 },
      ]}
      onPress={onPress}
    >
      <View
        style={[
          s.analysisIcon,
          !recognized
            ? { backgroundColor: colors.violetSoft }
            : out
              ? { backgroundColor: colors.coralSoft }
              : { backgroundColor: colors.aquaSoft },
        ]}
      >
        <Ionicons
          name="document-text-outline"
          size={25}
          color={!recognized ? colors.violet : out ? colors.coral : colors.aqua}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.analysisTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={s.analysisMeta}>{date(item.created_at)}</Text>
        <Text style={s.analysisSummary} numberOfLines={2}>{item.ai_review?.summary || (recognized ? "Показатели распознаны" : "Документ требует проверки")}</Text>
        <Text style={[s.analysisStateText, out > 0 && { color: colors.coral }]}>{!recognized ? "Нужно проверить" : out ? `${out} вне диапазона` : "Без отклонений"}</Text>
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
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </Pressable>
  );
}
function Consultations({
  data,
  user,
  onRefresh,
}: {
  data: Consultation[];
  user: User;
  onRefresh: () => void;
}) {
  const [reply, setReply] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  async function send(c: Consultation) {
    try {
      await api.reply(c.id, reply[c.id] || "");
      onRefresh();
    } catch (e) {
      Alert.alert(
        "Не удалось отправить",
        e instanceof Error ? e.message : "Ошибка",
      );
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
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {user.role === "patient" && <View style={[s.complaintComposer, expanded && s.complaintComposerExpanded]}>
        <Pressable onPress={() => setExpanded(true)} style={s.complaintPrompt}><View style={s.complaintIcon}><Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.violet} /></View><View style={{ flex: 1 }}><Text style={s.complaintTitle}>Что вас беспокоит?</Text><Text style={s.complaintPlaceholder} numberOfLines={expanded ? 2 : 1}>{question || "Опишите жалобы или продиктуйте…"}</Text></View><Ionicons name={expanded ? "chevron-up" : "expand-outline"} size={22} color={colors.muted} /></Pressable>
        {expanded && <><TextInput autoFocus multiline style={[s.input, s.complaintInput]} placeholder="Когда появились симптомы, где болит, что усиливает или облегчает состояние…" value={question} onChangeText={setQuestion} /><View style={s.complaintActions}><Pressable onPress={dictate} style={[s.micButton, listening && s.micButtonActive]}><Ionicons name={listening ? "radio" : "mic-outline"} size={22} color={listening ? colors.white : colors.violet} /><Text style={[s.micText, listening && { color: colors.white }]}>{listening ? "Слушаю…" : "Продиктовать"}</Text></Pressable><Button label={asking ? "Анализируем…" : "Получить ответ"} compact disabled={asking || !question.trim()} onPress={() => void askAI()} /></View><Text style={s.aiDisclaimer}>ИИ выполняет первичную маршрутизацию, не ставит диагноз и не заменяет экстренную или очную помощь.</Text></>}
      </View>}
      {data.length ? (
        data.map((c) => (
          <View key={c.id} style={[s.consultCard, c.source === "ai" ? s.aiConsultCard : s.doctorConsultCard]}>
            <View style={s.rowBetween}>
              <View style={s.consultType}><Ionicons name={c.source === "ai" ? "sparkles" : "medkit-outline"} size={17} color={c.source === "ai" ? colors.violet : colors.aqua} /><Text style={[s.consultStatus, c.source === "ai" && { color: colors.violet }]}>{c.source === "ai" ? "Помощник Lab" : c.status === "answered" ? "Ответ врача" : "Ожидает врача"}</Text></View>
              <Text style={s.analysisMeta}>{date(c.created_at)}</Text>
            </View>
            <Text style={s.consultCardTitle}>{c.title || "Консультация"}</Text>
            <Text style={s.consultQuestion} numberOfLines={3}>{c.question || "Просьба прокомментировать результат"}</Text>
            {c.reply ? (
              <View style={s.replyBox}>
                <Text style={s.replyLabel}>{c.source === "ai" ? "Рекомендация" : "Ответ врача"}</Text>
                <Text style={s.body}>{c.reply}</Text>
                {c.specialty ? <Text style={s.specialtyLine}>Обратиться: {c.specialty}</Text> : null}
              </View>
            ) : user.role === "doctor" ? (
              <>
                <TextInput
                  style={[s.input, s.replyInput]}
                  multiline
                  placeholder="Ваш комментарий пациенту"
                  value={reply[c.id] || ""}
                  onChangeText={(v) => setReply({ ...reply, [c.id]: v })}
                />
                <Button
                  label="Отправить ответ"
                  compact
                  onPress={() => send(c)}
                />
              </>
            ) : (
              <Text style={s.cardHint}>
                Врач увидит доступный анализ и ответит здесь.
              </Text>
            )}
          </View>
        ))
      ) : (
        <Empty
          icon="chatbubbles-outline"
          title="Консультаций пока нет"
          text={
            user.role === "patient"
              ? "Откройте анализ и выберите врача для консультации."
              : "Новые обращения пациентов появятся в этом разделе."
          }
        />
      )}
    </ScrollView>
  );
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
  function toggle(d:number,h:number,m:number){if(!edit)return;const value=addDays(week,d);value.setHours(h,m,0,0);const key=slotKey(value);if(slots.some(x=>slotKey(x.start_at)===key&&x.status==="booked"))return;setSelected(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})}
  async function save(){setBusy(true);try{await api.saveSchedule(from,to,[...selected]);setEdit(false);await load()}catch(e){Alert.alert("Не удалось сохранить",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  return <View style={s.schedulePage}><LinearGradient colors={["#17214B","#3C3A86","#147D83"]} style={[s.doctorWelcome,compact&&s.doctorWelcomeCompact]}><View><Text style={s.welcomeOver}>РАСПИСАНИЕ ВРАЧА</Text><Text style={s.doctorWelcomeTitle}>Здравствуйте, {firstName(user.full_name)}</Text></View><Pressable style={s.scheduleEdit} onPress={()=>edit?void save():setEdit(true)}><Ionicons name={edit?"checkmark":"create-outline"} size={19} color={colors.white}/><Text style={s.scheduleEditText}>{busy?"Сохраняем…":edit?"Готово":"Изменить"}</Text></Pressable></LinearGradient>
    <View style={s.weekToolbar}><Pressable style={s.iconButton} onPress={()=>setWeek(addDays(week,-7))}><Ionicons name="chevron-back" size={22}/></Pressable><Pressable onPress={()=>setWeek(weekStart())}><Text style={s.weekTitle}>{week.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — {addDays(week,6).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</Text></Pressable><Pressable style={s.iconButton} onPress={()=>setWeek(addDays(week,7))}><Ionicons name="chevron-forward" size={22}/></Pressable></View>
    {edit&&<View style={s.editHint}><Ionicons name="information-circle-outline" size={20} color={colors.violet}/><Text style={s.aiDisclaimer}>Нажимайте на свободные ячейки, чтобы открыть или закрыть самостоятельную запись пациентов.</Text></View>}
    <ScrollView horizontal style={s.calendarHorizontal} contentContainerStyle={{minWidth:760}}><View><View style={s.calendarHeader}><View style={s.timeColumn}/>{weekDays.map((label,i)=><View key={label} style={s.dayHeader}><Text style={s.dayName}>{label}</Text><Text style={s.dayNumber}>{addDays(week,i).getDate()}</Text></View>)}</View><ScrollView style={s.calendarVertical} nestedScrollEnabled>{rows.map(({h,m})=><View key={`${h}-${m}`} style={s.calendarRow}><View style={s.timeColumn}><Text style={s.timeText}>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}</Text></View>{weekDays.map((_,d)=>{const value=addDays(week,d);value.setHours(h,m,0,0);const key=slotKey(value);const booked=slots.find(x=>slotKey(x.start_at)===key&&x.status==="booked");const available=selected.has(key);return <Pressable key={d} onPress={()=>toggle(d,h,m)} style={[s.calendarCell,available&&s.availableCell,booked&&s.bookedCell]}><Text numberOfLines={2} style={[s.cellText,(available||booked)&&{color:colors.white}]}>{booked?(booked.patient_name||"Пациент"):available?"Доступно":""}</Text></Pressable>})}</View>)}</ScrollView></View></ScrollView>
  </View>
}

function startDictation(setValue: React.Dispatch<React.SetStateAction<string>>, setListening: (v:boolean)=>void) { if(Platform.OS!=="web"){Alert.alert("Диктовка","Нажмите микрофон на системной клавиатуре.");return} const w=window as any;const R=w.SpeechRecognition||w.webkitSpeechRecognition;if(!R){Alert.alert("Диктовка недоступна","Используйте микрофон клавиатуры.");return}const r=new R();r.lang="ru-RU";r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);r.onresult=(e:any)=>setValue(v=>`${v}${v?" ":""}${e.results?.[0]?.[0]?.transcript||""}`);r.start() }

function DoctorPatients({ patientsAnalyses, onOpen }: { patientsAnalyses: Analysis[]; onOpen: (a: Analysis) => void }) {
  const [patients,setPatients]=useState<User[]>([]);const [selectedPatient,setSelectedPatient]=useState<User|null>(null);const [notes,setNotes]=useState<PatientNote[]>([]);const [note,setNote]=useState("");const [busy,setBusy]=useState(false);const [listening,setListening]=useState(false);
  useEffect(()=>{api.patients().then(setPatients).catch(()=>setPatients([]))},[]);useEffect(()=>{if(selectedPatient)api.patientNotes(selectedPatient.id).then(setNotes).catch(()=>setNotes([]))},[selectedPatient]);
  const patientAnalyses=selectedPatient?patientsAnalyses.filter(a=>a.owner_id===selectedPatient.id):[];
  async function save(){if(!selectedPatient||!note.trim())return;setBusy(true);try{await api.addPatientNote(selectedPatient.id,note.trim());setNote("");setNotes(await api.patientNotes(selectedPatient.id))}catch(e){Alert.alert("Не удалось сохранить",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  return <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">{!selectedPatient?<><Text style={s.sectionIntro}>Пациенты, которые записались или запросили услугу.</Text><View style={s.doctorGrid}>{patients.map(p=><Pressable key={p.id} style={s.doctorDirectoryCard} onPress={()=>setSelectedPatient(p)}><View style={s.doctorAvatar}><Text style={s.avatarText}>{initials(p.full_name)}</Text></View><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{p.full_name}</Text><Text style={s.specialtyLine}>{p.patient_profile?`${p.patient_profile.age} лет · ИМТ ${p.patient_profile.bmi}`:"Профиль не заполнен"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>)}</View>{!patients.length&&<Empty icon="people-outline" title="Пациентов пока нет" text="Пациент появится после записи или запроса услуги."/>}</>:<><Pressable style={s.backLink} onPress={()=>setSelectedPatient(null)}><Ionicons name="arrow-back" size={18} color={colors.brand}/><Text style={s.link}>Все пациенты</Text></Pressable><View style={s.patientRecord}><Text style={s.eyebrow}>КАРТА ПАЦИЕНТА</Text><Text style={s.cardTitle}>{selectedPatient.full_name}</Text>{selectedPatient.patient_profile&&<Text style={s.analysisMeta}>{selectedPatient.patient_profile.age} лет · {selectedPatient.patient_profile.height_cm} см · {selectedPatient.patient_profile.weight_kg} кг · ИМТ {selectedPatient.patient_profile.bmi}</Text>}</View><View style={s.noteComposer}><Text style={s.surveyTitle}>Заключение врача</Text><TextInput multiline style={[s.input,s.noteInput]} placeholder="Заключение, рекомендации и дальнейшая тактика…" value={note} onChangeText={setNote}/><View style={s.complaintActions}><Pressable style={[s.micButton,listening&&s.micButtonActive]} onPress={()=>startDictation(setNote,setListening)}><Ionicons name={listening?"radio":"mic-outline"} size={21} color={listening?colors.white:colors.violet}/><Text style={[s.micText,listening&&{color:colors.white}]}>{listening?"Слушаю…":"Продиктовать"}</Text></Pressable><Button compact disabled={busy||!note.trim()} label={busy?"Сохраняем…":"Сохранить"} onPress={()=>void save()}/></View></View>{notes.map(n=><View key={n.id} style={s.noteCard}><View style={s.rowBetween}><Text style={s.replyLabel}>Заключение</Text><Text style={s.analysisMeta}>{date(n.created_at)}</Text></View><Text style={s.body}>{n.text}</Text></View>)}<Text style={s.surveyTitle}>Доступные исследования</Text><View style={s.compactCardGrid}>{patientAnalyses.map(a=><AnalysisCard key={a.id} item={a} onPress={()=>onOpen(a)}/>)}</View>{!patientAnalyses.length&&<Empty icon="flask-outline" title="Нет доступных исследований" text="Пациент ещё не открыл анализ этому врачу."/>}</>}</ScrollView>
}

function AIWorkspace(){const [chats,setChats]=useState<AIChat[]>([]);const [active,setActive]=useState<AIChat|null>(null);const [message,setMessage]=useState("");const [title,setTitle]=useState("");const [busy,setBusy]=useState(false);const [listening,setListening]=useState(false);const load=()=>api.aiChats().then(setChats).catch(()=>setChats([]));useEffect(()=>{void load()},[]);async function open(chat:AIChat){setActive(await api.aiChat(chat.id));setTitle(chat.title)}async function create(){const c=await api.createAIChat();setActive(c);setTitle(c.title);void load()}async function send(){if(!active||!message.trim())return;const text=message.trim();setMessage("");setBusy(true);try{await api.aiMessage(active.id,text);setActive(await api.aiChat(active.id));void load()}catch(e){setMessage(text);Alert.alert("AI недоступен",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}async function rename(){if(active&&title.trim()){await api.renameAIChat(active.id,title.trim());setActive({...active,title:title.trim()});void load()}}async function remove(){if(!active)return;await api.deleteAIChat(active.id);setActive(null);void load()}
  return <><ScrollView contentContainerStyle={s.scroll}><View style={s.rowBetween}><View><Text style={s.sectionTitle}>Беседы с AI</Text><Text style={s.sectionIntro}>Клиническое рассуждение и подготовка вопросов. Решение всегда принимает врач.</Text></View><Button compact icon="add" label="Новая консультация" onPress={()=>void create()}/></View>{chats.map(c=><Pressable key={c.id} style={s.aiChatCard} onPress={()=>void open(c)}><View style={s.aiChatIcon}><Ionicons name="sparkles" size={22} color={colors.white}/></View><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{c.title}</Text><Text style={s.analysisMeta}>{new Date(c.updated_at).toLocaleString("ru-RU")}</Text><Text numberOfLines={2} style={s.analysisSummary}>{c.messages?.[0]?.content||"Новая беседа"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>)}</ScrollView><Modal visible={!!active} animationType="slide" onRequestClose={()=>setActive(null)}><SafeAreaView style={s.chatPage}><View style={s.chatHeader}><Pressable style={s.iconButton} onPress={()=>setActive(null)}><Ionicons name="arrow-back" size={24}/></Pressable><TextInput style={s.chatTitleInput} value={title} onChangeText={setTitle} onBlur={()=>void rename()}/><Pressable style={s.iconButton} onPress={()=>void remove()}><Ionicons name="trash-outline" size={22} color={colors.coral}/></Pressable></View><ScrollView style={{flex:1}} contentContainerStyle={s.messages}>{active?.messages.map((m,i)=><View key={i} style={[s.messageBubble,m.role==="user"?s.userBubble:s.assistantBubble]}><Text style={[s.body,m.role==="user"&&{color:colors.white}]}>{m.content}</Text><Text style={[s.messageTime,m.role==="user"&&{color:"#FFFFFFAA"}]}>{new Date(m.created_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</Text></View>)}{busy&&<View style={[s.messageBubble,s.assistantBubble]}><ActivityIndicator color={colors.violet}/></View>}</ScrollView><View style={s.chatComposer}><Pressable style={s.iconButton} onPress={()=>startDictation(setMessage,setListening)}><Ionicons name={listening?"radio":"mic-outline"} size={23} color={colors.violet}/></Pressable><TextInput multiline style={s.chatInput} placeholder="Сообщение AI…" value={message} onChangeText={setMessage}/><Pressable disabled={busy||!message.trim()} style={s.sendButton} onPress={()=>void send()}><Ionicons name="arrow-up" size={22} color={colors.white}/></Pressable></View></SafeAreaView></Modal></>
}

function Guides(){
  const [query,setQuery]=useState("");const [catalog,setCatalog]=useState<Guide[]>([]);const [active,setActive]=useState<Guide|null>(null);const [synced,setSynced]=useState("");const [busy,setBusy]=useState(false);const reader=useRef<ScrollView>(null);const positions=useRef<Record<string,number>>({});
  const load=async(sync=false)=>{setBusy(true);try{const r=sync?await api.syncGuides():await api.guides();setCatalog(r.items);setSynced(r.synced_at)}catch(e){Alert.alert("Guides недоступны",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}};useEffect(()=>{void load()},[]);
  async function open(item:Guide){setBusy(true);try{setActive(await api.guide(item.id));positions.current={}}catch(e){Alert.alert("Документ недоступен",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
  const filtered=catalog.filter(g=>`${g.title} ${g.code} ${g.category} ${g.developers?.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0,120);
  return <><ScrollView contentContainerStyle={s.scroll}><View style={s.rowBetween}><View style={{flex:1}}><Text style={s.sectionIntro}>Официальный каталог клинических рекомендаций Минздрава России.</Text>{synced?<Text style={s.analysisMeta}>Синхронизировано: {new Date(synced).toLocaleString("ru-RU")}</Text>:null}</View><Pressable style={s.iconButton} onPress={()=>void load(true)}>{busy?<ActivityIndicator/>:<Ionicons name="refresh" size={21} color={colors.brand}/>}</Pressable></View><View style={s.doctorSearch}><Ionicons name="search" size={21} color={colors.muted}/><TextInput style={s.doctorSearchInput} value={query} onChangeText={setQuery} placeholder="Название, МКБ или раздел…"/></View><View style={s.guidelineGrid}>{filtered.map(g=><Pressable key={g.id} style={s.guidelineCard} onPress={()=>void open(g)}><View style={s.wellnessIcon}><Ionicons name="book-outline" size={23} color={colors.brand}/></View><View style={{flex:1}}><Text style={s.doctorDirectoryName}>{g.title}</Text><Text style={s.analysisMeta}>{[g.code,g.category,g.status].filter(Boolean).join(" · ")}</Text>{g.published_at?<Text style={s.guidePublished}>Опубликовано {date(g.published_at)}</Text>:null}</View><Ionicons name="chevron-forward" size={20} color={colors.brand}/></Pressable>)}</View><View style={s.clinicalNotice}><Ionicons name="shield-checkmark-outline" size={22} color={colors.amber}/><Text style={s.aiDisclaimer}>Перед решением сверяйте редакцию, статус и применимость документа с официальным оригиналом.</Text></View></ScrollView>
  <Modal visible={!!active} animationType="slide" onRequestClose={()=>setActive(null)}><SafeAreaView style={s.guideReader}><View style={s.chatHeader}><Pressable style={s.iconButton} onPress={()=>setActive(null)}><Ionicons name="arrow-back" size={24}/></Pressable><View style={{flex:1}}><Text numberOfLines={1} style={s.doctorDirectoryName}>{active?.title}</Text><Text style={s.analysisMeta}>{[active?.code,active?.status].filter(Boolean).join(" · ")}</Text></View><Pressable style={s.iconButton} onPress={()=>active&&void Linking.openURL(active.source_url)}><Ionicons name="open-outline" size={22} color={colors.brand}/></Pressable></View><ScrollView ref={reader} contentContainerStyle={s.guideBody}><View style={s.guideContents}><Text style={s.cardTitle}>Содержание</Text>{active?.sections?.map((section,index)=><Pressable key={section.id} style={s.contentsRow} onPress={()=>reader.current?.scrollTo({y:positions.current[section.id]||0,animated:true})}><Text style={s.contentsNumber}>{index+1}</Text><Text style={s.contentsTitle}>{section.title}</Text></Pressable>)}</View>{active?.sections?.map(section=><View key={section.id} onLayout={e=>{positions.current[section.id]=e.nativeEvent.layout.y}} style={s.guideSection}><Text style={s.guideSectionTitle}>{section.title}</Text><Text selectable style={s.guideText}>{section.content}</Text><Pressable style={s.backToContents} onPress={()=>reader.current?.scrollTo({y:0,animated:true})}><Ionicons name="arrow-up" size={16} color={colors.brand}/><Text style={s.link}>К содержанию</Text></Pressable></View>)}</ScrollView></SafeAreaView></Modal></>
}

function DoctorsScreen({ user, analyses, onRefresh }: { user: User; analyses: Analysis[]; onRefresh: () => void }) {
  const [query, setQuery] = useState("");
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [analysisID, setAnalysisID] = useState(analyses[0]?.id || "");
  const [question, setQuestion] = useState("Прошу прокомментировать результаты и дальнейшие действия.");
  const [availableSlots, setAvailableSlots] = useState<ScheduleSlot[]>([]);
  const [appointmentAt, setAppointmentAt] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user.role === "patient") api.doctors(query).then(setDoctors).catch(() => setDoctors([])); }, [query, user.role]);
  useEffect(() => { if (!selectedDoctor) { setAvailableSlots([]); return; } const from=new Date(); const to=addDays(from,21); api.schedule(selectedDoctor.id,from.toISOString(),to.toISOString()).then(list=>setAvailableSlots(list.filter(x=>x.status==="available"&&new Date(x.start_at)>from))).catch(()=>setAvailableSlots([])); }, [selectedDoctor]);
  async function request(serviceType: "consultation" | "appointment" | "home_visit", appointmentAt?: string) {
    if (!selectedDoctor) return;
    if (serviceType === "consultation" && !analysisID) { Alert.alert("Выберите анализ", "Для консультации откройте врачу хотя бы одно исследование."); return; }
    if (serviceType === "appointment" && !appointmentAt) { Alert.alert("Выберите время", "Выберите свободную ячейку в расписании врача."); return; }
    setBusy(true);
    try { await api.requestDoctor({ analysisID: analysisID || undefined, doctorID: selectedDoctor.id, question, serviceType, appointmentAt }); setSelectedDoctor(null); onRefresh(); Alert.alert(serviceType === "appointment" ? "Вы записаны" : "Запрос отправлен", serviceType === "appointment" ? "Время закреплено в расписании врача." : "Врач увидит запрос в карте пациента."); }
    catch (e) { Alert.alert("Не удалось отправить", e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
  if (user.role === "doctor") return <ScrollView contentContainerStyle={s.scroll}><Empty icon="medical-outline" title="Каталог коллег" text="Поиск коллег и направление пациентов будет добавлено после верификации врачебных профилей." /></ScrollView>;
  return <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
    <View style={s.doctorSearch}><Ionicons name="search" size={21} color={colors.muted} /><TextInput style={s.doctorSearchInput} placeholder="Специальность: терапевт, кардиолог…" value={query} onChangeText={setQuery} /></View>
    <Text style={s.sectionIntro}>Выберите специалиста, откройте нужный анализ и запросите услугу.</Text>
    <View style={s.doctorGrid}>{doctors.map((doctorItem) => <Pressable key={doctorItem.id} onPress={() => setSelectedDoctor(doctorItem)} style={({ pressed }) => [s.doctorDirectoryCard, pressed && { opacity: 0.75 }]}><View style={s.doctorAvatar}><Text style={s.avatarText}>{initials(doctorItem.full_name)}</Text></View><View style={{ flex: 1 }}><Text style={s.doctorDirectoryName}>{doctorItem.full_name}</Text><Text style={s.specialtyLine}>{doctorItem.specialization}</Text><View style={s.doctorOptions}><Text style={s.doctorOption}>Онлайн</Text><Text style={s.doctorOption}>Расписание</Text>{doctorItem.home_visits ? <Text style={s.doctorOption}>На дом</Text> : null}</View></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>)}</View>
    {!doctors.length && <Empty icon="medkit-outline" title="Специалисты не найдены" text="Попробуйте другое название специальности." />}
    <Modal visible={!!selectedDoctor} transparent animationType="slide" onRequestClose={() => setSelectedDoctor(null)}><View style={s.modalBackdrop}><View style={s.doctorRequestSheet}><ScrollView contentContainerStyle={{gap:14}}><View style={s.rowBetween}><View><Text style={s.eyebrow}>ЗАПРОС СПЕЦИАЛИСТУ</Text><Text style={s.cardTitle}>{selectedDoctor?.full_name}</Text><Text style={s.specialtyLine}>{selectedDoctor?.specialization}</Text></View><Pressable style={s.iconButton} onPress={() => setSelectedDoctor(null)}><Ionicons name="close" size={26} /></Pressable></View><Text style={s.label}>Свободное время</Text>{availableSlots.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.markerPicker}>{availableSlots.map(slot=><Choice key={slot.id} active={appointmentAt===slot.start_at} label={new Date(slot.start_at).toLocaleString("ru-RU",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} onPress={()=>setAppointmentAt(slot.start_at)}/>)}</ScrollView>:<Text style={s.cardHint}>Врач пока не открыл время для самостоятельной записи.</Text>}<Text style={s.label}>Анализ для доступа врачу (необязательно для записи)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.markerPicker}>{analyses.map((analysis) => <Choice key={analysis.id} active={analysisID === analysis.id} label={`${analysis.title} · ${date(analysis.created_at)}`} onPress={() => setAnalysisID(analysis.id)} />)}</ScrollView><Field label="Комментарий врачу" multiline value={question} onChangeText={setQuestion} /><View style={s.serviceButtons}><Button label="Консультация" compact disabled={busy} onPress={() => void request("consultation")} /><Button label="Записаться" compact kind="ghost" disabled={busy||!appointmentAt} onPress={() => void request("appointment",appointmentAt)} />{selectedDoctor?.home_visits ? <Button label="Вызов на дом" compact kind="ghost" disabled={busy} onPress={() => void request("home_visit")} /> : null}</View></ScrollView></View></View></Modal>
  </ScrollView>;
}

function Profile({ user, onUpdated, onLogout }: { user: User; onUpdated: (u: User) => void; onLogout: () => void }) {
  const profile = user.patient_profile;
  const [age, setAge] = useState(profile ? String(profile.age) : "");
  const [height, setHeight] = useState(profile ? String(profile.height_cm) : "");
  const [weight, setWeight] = useState(profile ? String(profile.weight_kg) : "");
  const [busy, setBusy] = useState(false);
  async function saveProfile() {
    setBusy(true);
    try { const updated = await api.updatePatientProfile({ age: Number(age), heightCM: Number(height), weightKG: Number(weight), activity: profile?.activity || { regular_sport: false }, nutrition: profile?.nutrition || {} }); onUpdated(updated); }
    catch (e) { Alert.alert("Не удалось сохранить", e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.profileCard}>
        <View style={[s.avatar, { width: 72, height: 72, borderRadius: 24 }]}>
          <Text style={[s.avatarText, { fontSize: 22 }]}>
            {initials(user.full_name)}
          </Text>
        </View>
        {user.role === "patient" && <View style={s.profileVitals}><Text style={s.surveyTitle}>Показатели профиля</Text><View style={s.registrationVitals}><Field label="Возраст" keyboardType="number-pad" value={age} onChangeText={setAge} /><Field label="Рост, см" keyboardType="decimal-pad" value={height} onChangeText={setHeight} /><Field label="Вес, кг" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} /></View>{profile ? <View style={s.bmiCard}><Text style={s.bmiValue}>ИМТ {profile.bmi}</Text><Text style={s.analysisMeta}>Используется только для персонализации рекомендаций, не как диагноз.</Text></View> : null}<Button label={busy ? "Сохраняем…" : "Сохранить профиль"} compact disabled={busy} onPress={() => void saveProfile()} /></View>}
        <Text style={s.profileName}>{user.full_name}</Text>
        <Text style={s.cardHint}>{user.email}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>
            {user.role === "doctor"
              ? `Врач · ${user.specialization}`
              : "Пациент"}
          </Text>
        </View>
        {user.role === "doctor" && !user.verified && (
          <View style={s.verifyNote}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={colors.amber}
            />
            <Text style={s.verifyText}>
              Профиль врача ещё не верифицирован. Для production потребуется
              проверка лицензии администратором.
            </Text>
          </View>
        )}
        <Button label="Выйти" kind="ghost" onPress={onLogout} />
      </View>
    </ScrollView>
  );
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
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalBackdrop}>
        <View style={[s.uploadSheet, compact && s.uploadSheetCompact]}>
          <View style={s.sheetHandle} />
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Добавить результат</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              hitSlop={10}
              style={s.iconButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          <Text style={s.cardHint}>
            Сфотографируйте бланк или выберите PDF/изображение. Хорошее
            освещение повышает точность распознавания. При подключённом ИИ
            распознанный текст обрабатывается сервисом DeepSeek.
          </Text>
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
      </View>
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
  const compact = width < 520;
  const [doctors, setDoctors] = useState<User[]>([]);
  const [doctor, setDoctor] = useState("");
  const [question, setQuestion] = useState(
    "Пожалуйста, прокомментируйте результаты анализа.",
  );
  const [exporting, setExporting] = useState<"email" | "share" | "print" | null>(null);
  useEffect(() => {
    if (item && user.role === "patient")
      api
        .doctors()
        .then(setDoctors)
        .catch(() => setDoctors([]));
  }, [item, user.role]);
  if (!item) return null;
  const active = item;
  async function consult() {
    if (!doctor) {
      onError("Выберите врача.");
      return;
    }
    try {
      await api.consult(active.id, doctor, question);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось открыть доступ");
    }
  }
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
  async function performReportAction(kind: "email" | "share" | "print") {
    if (exporting) return;
    setExporting(kind);
    try {
      if (Platform.OS === "web") {
        if (kind === "print") {
          await Linking.openURL(api.reportURL(active.id));
        } else {
          await shareWebReport();
        }
        return;
      }
      const uri = await nativeReport();
      if (kind === "email" && (await MailComposer.isAvailableAsync())) {
        await MailComposer.composeAsync({
          subject: `Результаты анализов: ${active.title}`,
          body: "Во вложении итоговый PDF с распознанными показателями.",
          attachments: [uri],
        });
      } else if (kind === "print") {
        await Print.printAsync({ uri });
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.detailSheet}>
          <View style={s.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{date(active.created_at)}</Text>
              <Text style={s.cardTitle}>{active.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              hitSlop={10}
              style={s.iconButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={28} />
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
            <Text style={s.detailSection}>Показатели</Text>
            {active.markers.length ? (
              active.markers.map((m, i) => (
                <View
                  key={`${m.name}-${i}`}
                  style={[
                    s.marker,
                    compact && s.markerCompact,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.markerName}>{m.name}</Text>
                    <Text style={s.analysisMeta}>
                      {m.reference_text ||
                        [m.reference_min, m.reference_max]
                          .filter((x) => x !== undefined)
                          .join(" — ") ||
                        "Референс не указан"}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.markerResult,
                      compact && s.markerResultCompact,
                    ]}
                  >
                    <Text style={s.markerValue}>
                      {m.value ?? m.text_value} {m.unit}
                    </Text>
                    <Status value={m.status} />
                  </View>
                </View>
              ))
            ) : (
              <Empty
                icon="scan-outline"
                title="Показатели не распознаны"
                text="Проверьте качество снимка или добавьте более чёткий файл."
              />
            )}
            {user.role === "patient" && (
              <>
                <Text style={s.detailSection}>Консультация врача</Text>
                {doctors.length ? (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {doctors.map((d) => (
                        <Pressable
                          key={d.id}
                          onPress={() => setDoctor(d.id)}
                          style={[
                            s.doctorChip,
                            doctor === d.id && s.doctorChipActive,
                          ]}
                        >
                          <View style={s.smallAvatar}>
                            <Text style={s.smallAvatarText}>
                              {initials(d.full_name)}
                            </Text>
                          </View>
                          <View>
                            <Text style={s.doctorName}>{d.full_name}</Text>
                            <Text style={s.analysisMeta}>
                              {d.specialization}
                            </Text>
                          </View>
                          {d.verified && (
                            <Ionicons
                              name="checkmark-circle"
                              color={colors.brand}
                              size={18}
                            />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                    <TextInput
                      style={[s.input, s.replyInput]}
                      multiline
                      value={question}
                      onChangeText={setQuestion}
                    />
                    <Button
                      label="Открыть доступ и отправить запрос"
                      onPress={consult}
                    />
                  </>
                ) : (
                  <Text style={s.cardHint}>
                    Зарегистрированных врачей пока нет.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
          <View style={s.detailFooter}>
            <View style={s.actionRow}>
              <Action
                icon="mail-outline"
                label="По почте"
                busy={exporting === "email"}
                disabled={!!exporting}
                onPress={() => void performReportAction("email")}
              />
              <Action
                icon="share-outline"
                label="Передать"
                busy={exporting === "share"}
                disabled={!!exporting}
                onPress={() => void performReportAction("share")}
              />
              <Action
                icon="print-outline"
                label="Печать"
                busy={exporting === "print"}
                disabled={!!exporting}
                onPress={() => void performReportAction("print")}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
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
              name={icon[t]}
              size={22}
              color={tab === t ? colors.brand : colors.muted}
            />
            <Text style={[s.navText, tab === t && { color: colors.brand }]}>
              {labels[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.sidebarUser}>
        <Text style={s.sidebarName} numberOfLines={1}>
          {user.full_name}
        </Text>
        <Text style={s.analysisMeta}>
          {user.role === "doctor" ? user.specialization : "Пациент"}
        </Text>
      </View>
    </View>
  );
}
function Bottom({ role, tab, onTab }: { role: Role; tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <View style={s.bottom}>
      {tabsFor(role).map((t) => (
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
          <Ionicons
            name={icon[t]}
            size={23}
            color={tab === t ? colors.brand : colors.muted}
          />
          <Text style={[s.bottomText, tab === t && { color: colors.brand }]}>
            {labels[t]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
function Field(props: any) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        {...props}
        label={undefined}
        style={s.input}
        placeholderTextColor="#9AA59F"
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
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[s.segmentItem, active && s.segmentActive]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={active ? colors.brand : colors.muted}
      />
      <Text style={[s.segmentText, active && { color: colors.brand }]}>
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
    <View style={s.loading}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
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
  shell: { flex: 1, width: "100%", flexDirection: "row", overflow: "hidden" },
  main: { flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden" },
  content: { flex: 1, minWidth: 0, maxWidth: "100%" },
  top: {
    height: 94,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topCompact: {
    height: 68,
    paddingHorizontal: 16,
    backgroundColor: colors.paper,
  },
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
    minHeight: 78,
    flexDirection: "row",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 7,
    gap: 4,
    ...shadow,
  },
  bottomItem: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 16,
  },
  bottomItemActive: { backgroundColor: colors.mint },
  bottomText: { fontSize: 11, fontWeight: "700", color: colors.muted },
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
    borderRadius: 20,
    padding: 16,
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderWidth: 1,
    borderColor: colors.line,
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
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteCardButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
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
  authPage: { flex: 1, flexDirection: "row", backgroundColor: colors.paper },
  authPageCompact: {
    flexDirection: "column",
    backgroundColor: colors.brandDark,
  },
  authAside: {
    flex: 1,
    padding: 52,
    justifyContent: "center",
    overflow: "hidden",
  },
  authAsideCompact: {
    flex: 0,
    flexShrink: 0,
    height: 230,
    minHeight: 230,
    maxHeight: 230,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 54,
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
  authVersion: {
    position: "absolute",
    top: 22,
    left: 24,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
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
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.8,
    marginTop: 24,
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
  authScrollCompact: { flex: 1, backgroundColor: colors.paper },
  authFormCompact: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
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
    borderRadius: 26,
    padding: 22,
  },
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
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  field: { gap: 7, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink },
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
  textButton: {
    minHeight: 48,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 25,
    paddingBottom: 35,
    maxWidth: 700,
    width: "100%",
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
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    ...shadow,
  },
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
  patientHome: { width: "100%", maxWidth: 920, alignSelf: "center", padding: 24, paddingBottom: 100, gap: 16 },
  patientHomeCompact: { padding: 12, gap: 12 },
  patientWelcome: { minHeight: 132, paddingVertical: 20 },
  patientWelcomeCompact: { minHeight: 112, padding: 17 },
  wellnessCardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  wellnessIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.violetSoft },
  wellnessTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  wellnessSubtitle: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
  nutritionHomeCard: { minHeight: 160, borderRadius: 24, padding: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, ...shadow },
  foodInfographic: { flexDirection: "row", gap: 8, marginTop: 16 },
  foodPart: { flex: 1, minHeight: 68, borderRadius: 16, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  foodValue: { fontSize: 18, fontWeight: "900" },
  foodLabel: { fontSize: 11, color: colors.muted },
  videoHomeCard: { height: 210, borderRadius: 25, overflow: "hidden", backgroundColor: colors.brandDark, ...shadow },
  homeVideo: { width: "100%", height: "100%" },
  videoOverlay: { ...StyleSheet.absoluteFillObject, padding: 20, flexDirection: "row", alignItems: "flex-end" },
  videoEyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: "900", color: "#C9D6FF" },
  videoTitle: { fontSize: 26, fontWeight: "900", color: colors.white, marginTop: 5 },
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
  dynamicsPanel: { backgroundColor: colors.white, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.line, gap: 15, ...shadow },
  markerPicker: { gap: 8, paddingVertical: 5 },
  viewSwitch: { flexDirection: "row", gap: 8 },
  dynamicList: { gap: 8 },
  dynamicRow: { minHeight: 54, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chartCard: { minHeight: 250, padding: 16, borderRadius: 18, backgroundColor: colors.paper },
  chartBars: { minHeight: 205, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", gap: 8 },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", minWidth: 44 },
  chartValue: { fontSize: 11, fontWeight: "800", color: colors.ink, marginBottom: 5 },
  chartBar: { width: 28, minHeight: 30, borderRadius: 8, backgroundColor: colors.aqua },
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
  doctorSearchInput: { flex: 1, minWidth: 0, fontSize: 15, color: colors.ink, outlineStyle: "none" } as any,
  doctorGrid: { gap: 11 },
  doctorDirectoryCard: { minHeight: 86, padding: 15, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 13, ...shadow },
  doctorAvatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  doctorDirectoryName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  doctorOptions: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  doctorOption: { fontSize: 10, fontWeight: "800", color: colors.brand, backgroundColor: colors.blueSoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  doctorRequestSheet: { width: "100%", maxWidth: 680, maxHeight: "88%", alignSelf: "center", marginTop: "auto", backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 17 },
  serviceButtons: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  profileVitals: { width: "100%", gap: 13, marginBottom: 18 },
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
  chatPage: { flex: 1, backgroundColor: colors.paper },
  chatHeader: { minHeight: 68, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  chatTitleInput: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.ink, padding: 10 },
  messages: { padding: 16, gap: 10, maxWidth: 900, width: "100%", alignSelf: "center" },
  messageBubble: { maxWidth: "82%", borderRadius: 20, padding: 13 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.brand, borderBottomRightRadius: 6 },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: colors.white, borderBottomLeftRadius: 6, ...shadow },
  messageTime: { color: colors.muted, fontSize: 9, marginTop: 6, alignSelf: "flex-end" },
  chatComposer: { minHeight: 76, padding: 10, flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  chatInput: { flex: 1, maxHeight: 120, minHeight: 48, borderRadius: 17, backgroundColor: colors.paper, paddingHorizontal: 15, paddingVertical: 12, color: colors.ink },
  sendButton: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.violet, alignItems: "center", justifyContent: "center" },
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
});
