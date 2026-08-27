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
import * as Sharing from "expo-sharing";
import { api, API_URL, restoreToken, setToken } from "./src/api";
import { Analysis, Consultation, Role, User } from "./src/types";
import { colors, shadow } from "./src/theme";

type Tab = "home" | "analyses" | "consultations" | "profile";
type Asset = { uri: string; name: string; mimeType?: string; file?: Blob };
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
        consultations={consultations}
        onUpload={() => setUpload({ uri: "", name: "" })}
        onOpen={setSelected}
        onTab={setTab}
      />
    ) : tab === "analyses" ? (
      <Analyses
        compact={compact}
        data={analyses}
        doctor={user.role === "doctor"}
        onOpen={setSelected}
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
                LAB HEALTH
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
      <View style={[s.authAside, compact && s.authAsideCompact]}>
        <View style={s.logo}>
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
      </View>
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
  consultations,
  onUpload,
  onOpen,
  onTab,
}: {
  compact: boolean;
  user: User;
  analyses: Analysis[];
  consultations: Consultation[];
  onUpload: () => void;
  onOpen: (a: Analysis) => void;
  onTab: (t: Tab) => void;
}) {
  const abnormal = analyses.reduce(
    (n, a) =>
      n +
      a.markers.filter((m) => m.status === "high" || m.status === "low").length,
    0,
  );
  return (
    <ScrollView contentContainerStyle={[s.scroll, compact && s.scrollCompact]}>
      <View style={[s.welcome, compact && s.welcomeCompact]}>
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
      </View>
      <View style={[s.metrics, compact && s.metricsCompact]}>
        <Metric
          compact={compact}
          label={
            user.role === "doctor" ? "Доступно анализов" : "Всего анализов"
          }
          value={`${analyses.length}`}
          icon="documents-outline"
        />
        <Metric
          compact={compact}
          label="Отклонений"
          value={`${abnormal}`}
          icon="analytics-outline"
          tone={abnormal ? "warn" : "normal"}
        />
        <Metric
          compact={compact}
          label="Консультаций"
          value={`${consultations.length}`}
          icon="chatbubble-ellipses-outline"
        />
      </View>
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
              <AnalysisCard key={a.id} item={a} onPress={() => onOpen(a)} />
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
  onUpload,
}: {
  compact: boolean;
  data: Analysis[];
  doctor: boolean;
  onOpen: (a: Analysis) => void;
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
            <AnalysisCard key={a.id} item={a} onPress={() => onOpen(a)} />
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
}: {
  item: Analysis;
  onPress: () => void;
}) {
  const out = item.markers.filter(
    (m) => m.status === "high" || m.status === "low",
  ).length;
  const recognized = item.status === "ready" && item.markers.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть результат: ${item.title}`}
      style={({ pressed }) => [s.analysisCard, pressed && { opacity: 0.78 }]}
      onPress={onPress}
    >
      <View style={s.analysisIcon}>
        <Ionicons name="document-text-outline" size={25} color={colors.brand} />
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
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
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
  const [error, setError] = useState("");
  useEffect(() => {
    if (visible) {
      setAsset(seed?.uri ? seed : null);
      setTitle("");
      setError("");
    }
  }, [visible, seed]);
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
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
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
  useEffect(() => {
    if (item && user.role === "patient")
      api
        .doctors()
        .then(setDoctors)
        .catch(() => setDoctors([]));
  }, [item, user.role]);
  if (!item) return null;
  const active = item;
  const abnormalities = active.markers.filter(
    (m) => m.status === "low" || m.status === "high",
  );
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
  async function shareFile() {
    const url = api.fileURL(active.id);
    if (Platform.OS === "web") {
      await Linking.openURL(url);
      return;
    }
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(url);
  }
  async function email() {
    const body = `Результат: ${active.title}\n\n${active.ai_review.summary}\n\nОткрыть файл: ${api.fileURL(active.id)}`;
    if (await MailComposer.isAvailableAsync())
      await MailComposer.composeAsync({
        subject: `Результаты анализов: ${active.title}`,
        body,
      });
    else
      await Linking.openURL(
        `mailto:?subject=${encodeURIComponent("Результаты анализов")}&body=${encodeURIComponent(body)}`,
      );
  }
  function print() {
    if (Platform.OS === "web") window.print();
    else shareFile();
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
            contentContainerStyle={[
              s.detailBody,
              compact && s.detailBodyCompact,
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                s.recognitionState,
                active.status !== "ready" && s.recognitionStateWarn,
              ]}
            >
              <Ionicons
                name={active.status === "ready" ? "checkmark-circle" : "alert-circle"}
                size={21}
                color={active.status === "ready" ? colors.brand : colors.amber}
              />
              <View style={s.recognitionStateCopy}>
                <Text style={s.recognitionStateTitle}>
                  {active.status === "ready"
                    ? `Распознано показателей: ${active.markers.length}`
                    : active.status === "failed"
                      ? "Распознавание не удалось"
                      : "Распознавание требует проверки"}
                </Text>
                <Text style={s.analysisMeta}>
                  {active.status === "ready"
                    ? "Ниже можно посмотреть каждое найденное значение."
                    : "Оригинал сохранён. Загрузите более чёткое фото или PDF."}
                </Text>
                <Text style={s.providerText}>
                  Обработка: {active.ai_review.provider === "deepseek" ? "DeepSeek + локальный OCR" : "локальный OCR"}
                </Text>
              </View>
            </View>
            <View
              style={[
                s.reviewBox,
                abnormalities.length
                  ? { backgroundColor: colors.amberSoft }
                  : null,
              ]}
            >
              <View style={s.reviewHead}>
                <Ionicons
                  name="sparkles"
                  size={22}
                  color={abnormalities.length ? colors.amber : colors.brand}
                />
                <Text style={s.reviewTitle}>Автоматическая сводка</Text>
              </View>
              <Text style={s.body}>{active.ai_review.summary}</Text>
              <Text style={s.disclaimer}>{active.ai_review.disclaimer}</Text>
            </View>
            <Text style={s.detailSection}>Показатели</Text>
            {active.markers.length ? (
              active.markers.map((m, i) => (
                <View
                  key={`${m.name}-${i}`}
                  style={[s.marker, compact && s.markerCompact]}
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
                text="Ниже показан текст, который удалось прочитать. Проверьте качество снимка или добавьте более чёткий файл."
              />
            )}
            <Text style={s.detailSection}>Распознанный текст</Text>
            <View style={s.ocrBox}>
              {active.ocr_text?.trim() ? (
                <Text selectable style={s.ocrText}>
                  {active.ocr_text.trim()}
                </Text>
              ) : (
                <View style={s.ocrEmpty}>
                  <Ionicons name="scan-outline" size={22} color={colors.amber} />
                  <Text style={s.ocrEmptyText}>
                    Текст из документа получить не удалось. Попробуйте более
                    чёткое фото без бликов или загрузите PDF.
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.detailSection}>Действия</Text>
            <View style={[s.actionRow, compact && s.actionRowCompact]}>
              <Action icon="mail-outline" label="По почте" onPress={email} />
              <Action
                icon="share-outline"
                label="Поделиться"
                onPress={shareFile}
              />
              {Platform.OS === "web" && (
                <Action icon="print-outline" label="Печать" onPress={print} />
              )}
            </View>
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
function Metric({
  compact,
  label,
  value,
  icon,
  tone,
}: {
  compact?: boolean;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: string;
}) {
  return (
    <View style={[s.metric, compact && s.metricCompact]}>
      <View
        style={[
          s.metricIcon,
          compact && s.metricIconCompact,
          tone === "warn" && { backgroundColor: colors.amberSoft },
        ]}
      >
        <Ionicons
          name={icon}
          size={23}
          color={tone === "warn" ? colors.amber : colors.brand}
        />
      </View>
      <View style={compact && s.metricCopyCompact}>
        <Text style={[s.metricValue, compact && s.metricValueCompact]}>
          {value}
        </Text>
        <Text
          style={[s.metricLabel, compact && s.metricLabelCompact]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed && s.pressablePressed]}
    >
      <Ionicons name={icon} size={23} color={colors.brand} />
      <Text style={s.sourceText}>{label}</Text>
    </Pressable>
  );
}
function Status({ value }: { value: string }) {
  const bad = value === "low" || value === "high";
  return (
    <View style={[s.status, bad && s.statusBad]}>
      <Text style={[s.statusText, bad && { color: colors.amber }]}>
        {value === "high"
          ? "выше"
          : value === "low"
            ? "ниже"
            : value === "normal"
              ? "норма"
              : "—"}
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
    backgroundColor: colors.brandDark,
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
  metrics: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  metricsCompact: { gap: 10, flexWrap: "wrap" },
  metric: {
    flexGrow: 1,
    minWidth: 200,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...shadow,
  },
  metricCompact: {
    flex: 1,
    minWidth: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconCompact: { width: 38, height: 38, borderRadius: 12 },
  metricCopyCompact: { minWidth: 0, width: "100%" },
  metricValue: { fontSize: 25, fontWeight: "800", color: colors.ink },
  metricValueCompact: { fontSize: 21 },
  metricLabel: { fontSize: 13, color: colors.muted },
  metricLabelCompact: { fontSize: 11, lineHeight: 14 },
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
    backgroundColor: colors.brandDark,
    padding: 52,
    justifyContent: "center",
  },
  authAsideCompact: {
    flex: 0,
    minHeight: 230,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 54,
    justifyContent: "flex-start",
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
  detailBody: { padding: 24, paddingBottom: 60 },
  detailBodyCompact: { padding: 16, paddingBottom: 44 },
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
  recognitionState: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.mint,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recognitionStateWarn: { backgroundColor: colors.amberSoft },
  recognitionStateCopy: { flex: 1, minWidth: 0 },
  recognitionStateTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  providerText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
  },
  reviewBox: { padding: 18, borderRadius: 18, backgroundColor: colors.mint },
  reviewHead: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  reviewTitle: { fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.ink },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 12,
  },
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
  ocrBox: {
    padding: 15,
    borderRadius: 15,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ocrText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  ocrEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ocrEmptyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.mint,
  },
  statusBad: { backgroundColor: colors.amberSoft },
  statusText: { fontSize: 10, fontWeight: "800", color: colors.brand },
  actionRow: { flexDirection: "row", gap: 10 },
  actionRowCompact: { flexWrap: "wrap" },
  action: {
    minWidth: 105,
    flexGrow: 1,
    minHeight: 76,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
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
