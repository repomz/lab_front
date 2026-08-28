import React, { useEffect, useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { api, API_URL, restoreToken, setToken } from "./src/api";
import { Analysis, Consultation, Role, User } from "./src/types";
import { colors, shadow } from "./src/theme";

type Tab = "home" | "analyses" | "consultations" | "profile";
type Asset = { uri: string; name: string; mimeType?: string; file?: Blob };
const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || "0.2.3";
const icon: Record<Tab, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  analyses: "flask-outline",
  consultations: "chatbubbles-outline",
  profile: "person-outline",
};
const labels: Record<Tab, string> = {
  home: "Главная",
  analyses: "Анализы",
  consultations: "Консультации",
  profile: "Профиль",
};

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
        onUpload={() => setUpload({ uri: "", name: "" })}
        onOpen={setSelected}
        onDelete={user.role === "patient" ? requestDelete : undefined}
        onTab={setTab}
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
    ) : tab === "consultations" ? (
      <Consultations
        data={consultations}
        user={user}
        onRefresh={() => refresh()}
      />
    ) : (
      <Profile
        user={user}
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
          {!desktop && <Bottom tab={tab} onTab={setTab} />}
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
          : await api.register({ ...form, role });
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
  onUpload,
  onOpen,
  onDelete,
  onTab,
}: {
  compact: boolean;
  user: User;
  analyses: Analysis[];
  onUpload: () => void;
  onOpen: (a: Analysis) => void;
  onDelete?: (a: Analysis) => void;
  onTab: (t: Tab) => void;
}) {
  return (
    <ScrollView contentContainerStyle={[s.scroll, compact && s.scrollCompact]}>
      <LinearGradient
        colors={["#17214B", "#3C3A86", "#147D83"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.welcome, compact && s.welcomeCompact]}
      >
        <View style={s.welcomeOrb} />
        <View style={{ flex: 1 }}>
          <Text style={s.welcomeOver}>
            {user.role === "doctor"
              ? "РАБОЧЕЕ ПРОСТРАНСТВО ВРАЧА"
              : "ВАША ИСТОРИЯ ЗДОРОВЬЯ"}
          </Text>
          <Text style={[s.welcomeTitle, compact && s.welcomeTitleCompact]}>
            Здравствуйте, {firstName(user.full_name)}
          </Text>
          <Text style={[s.welcomeText, compact && s.welcomeTextCompact]}>
            {user.role === "doctor"
              ? "Здесь собраны пациенты, которые открыли вам доступ, и новые запросы на консультацию."
              : "Добавляйте лабораторные результаты — сервис распознает показатели и соберёт их в понятном виде."}
          </Text>
          {user.role === "patient" && (
            <Button
              label="Добавить анализ"
              icon="add"
              onPress={onUpload}
              compact
            />
          )}
        </View>
        {!compact && (
          <View style={s.welcomeMark}>
            <Ionicons name="pulse" size={50} color={colors.brand} />
          </View>
        )}
      </LinearGradient>
      <Section
        title={
          user.role === "doctor"
            ? "Недавно открытые пациентами"
            : "Последние результаты"
        }
        action="Все анализы"
        onAction={() => onTab("analyses")}
      >
        {analyses.length ? (
          <View style={s.cardGrid}>
            {analyses.slice(0, 3).map((a) => (
              <AnalysisCard
                key={a.id}
                item={a}
                onPress={() => onOpen(a)}
                onDelete={onDelete ? () => onDelete(a) : undefined}
              />
            ))}
          </View>
        ) : (
          <Empty
            icon="flask-outline"
            title="Пока нет результатов"
            text={
              user.role === "patient"
                ? "Сфотографируйте бланк или выберите PDF из файлов."
                : "Когда пациент откроет вам доступ, анализ появится здесь."
            }
          />
        )}
      </Section>
    </ScrollView>
  );
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
      {data.length ? (
        <View style={s.cardGrid}>
          {data.map((a) => (
            <AnalysisCard
              key={a.id}
              item={a}
              onPress={() => onOpen(a)}
              onDelete={onDelete ? () => onDelete(a) : undefined}
            />
          ))}
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
        <Text style={s.analysisMeta}>
          {date(item.created_at)} · {item.markers.length} показателей
        </Text>
        <View style={[s.pill, out || !recognized ? s.pillWarn : s.pillOk]}>
          <Text
            style={[
              s.pillText,
              out || !recognized ? { color: colors.amber } : undefined,
            ]}
          >
            {!recognized
              ? item.status === "failed"
                ? "Ошибка распознавания"
                : "Нужно проверить документ"
              : out
                ? `${out} вне диапазона`
                : "Распознано без отклонений"}
          </Text>
        </View>
        <Text style={s.openResult}>Открыть результат →</Text>
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
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {data.length ? (
        data.map((c) => (
          <View key={c.id} style={s.consultCard}>
            <View style={s.rowBetween}>
              <Text style={s.consultStatus}>
                {c.status === "answered" ? "Ответ дан" : "Ожидает ответа"}
              </Text>
              <Text style={s.analysisMeta}>{date(c.created_at)}</Text>
            </View>
            <Text style={s.consultQuestion}>
              {c.question || "Просьба прокомментировать результат"}
            </Text>
            {c.reply ? (
              <View style={s.replyBox}>
                <Text style={s.replyLabel}>Ответ врача</Text>
                <Text style={s.body}>{c.reply}</Text>
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
function Profile({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.profileCard}>
        <View style={[s.avatar, { width: 72, height: 72, borderRadius: 24 }]}>
          <Text style={[s.avatarText, { fontSize: 22 }]}>
            {initials(user.full_name)}
          </Text>
        </View>
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
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (visible) {
      setAsset(seed?.uri ? seed : null);
      setTitle("");
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
      const result = await api.upload(
        asset,
        title || asset.name.replace(/\.[^.]+$/, ""),
      );
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
          <Field
            label="Название"
            placeholder="Например, общий анализ крови"
            value={title}
            onChangeText={setTitle}
          />
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
        {(Object.keys(labels) as Tab[]).map((t) => (
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
function Bottom({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <View style={s.bottom}>
      {(Object.keys(labels) as Tab[]).map((t) => (
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
    minHeight: 230,
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
});
