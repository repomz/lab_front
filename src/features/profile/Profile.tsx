import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../api";
import { User } from "../../types";
import { colors } from "../../theme";
import { s } from "../../styles";
import { AvatarView, Button, Choice, MiniAction } from "../../components/ui";
import { AmbientCanvas, Modal, ScrollView } from "../../components/platform";
import { doctorSpecialties } from "../../config";
import { ageFromBirthDate, formatBirthDate } from "./utils";

export function ProfileCompletionPrompt({ visible, onLater, onComplete, onNever }: { visible: boolean; onLater: () => void; onComplete: () => void; onNever: () => void }) {
  const benefits: Array<[keyof typeof Ionicons.glyphMap, string]> = [
    ["sparkles-outline", "Персональное резюме анализов с учётом возраста и ИМТ"],
    ["analytics-outline", "Более точная оценка динамики показателей"],
    ["calendar-outline", "Запись на приём и передача врачу необходимых данных"],
  ];
  return <Modal visible={visible} animationType="fade" onRequestClose={onLater}>
    <View style={s.profilePromptScreen}>
      <AmbientCanvas/>
      <SafeAreaView edges={["top","right","left"]} style={s.profilePromptSafe}>
        <View style={s.profilePromptBody}>
          <View style={s.profilePromptIcon}><Ionicons name="person-circle-outline" size={42} color={colors.violet}/></View>
          <Text style={s.profilePromptTitle}>Заполните профиль</Text>
          <Text style={s.profilePromptLead}>Это займёт около минуты и позволит приложению учитывать ваши личные параметры.</Text>
          <View style={s.profilePromptBenefits}>{benefits.map(([name, text]) => <View key={name} style={s.profilePromptBenefit}><View style={s.profilePromptBenefitIcon}><Ionicons name={name} size={21} color={colors.brand}/></View><Text style={s.profilePromptBenefitText}>{text}</Text></View>)}</View>
        </View>
        <View style={s.profilePromptActions}>
          <Button label="Заполнить профиль" kind="glass" onPress={onComplete}/>
          <Pressable accessibilityRole="button" style={s.profilePromptLater} onPress={onLater}><Text style={s.profilePromptLaterText}>Позже</Text></Pressable>
          <Pressable accessibilityRole="button" style={s.profilePromptNever} onPress={onNever}><Text style={s.profilePromptNeverText}>Не напоминать больше</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

export function deletionTimeLabel(scheduledFor: string, now: number) {
	const remaining = Math.max(0, new Date(scheduledFor).getTime() - now);
	const day = 24 * 60 * 60 * 1000;
	if (remaining > day) {
		const days = Math.ceil(remaining / day);
		const suffix = days % 10 === 1 && days % 100 !== 11 ? "день" : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20) ? "дня" : "дней";
		return `${days} ${suffix}`;
	}
	const hours = Math.floor(remaining / (60 * 60 * 1000));
	const minutes = Math.max(1, Math.ceil((remaining % (60 * 60 * 1000)) / (60 * 1000)));
	return `${hours} ч ${minutes} мин`;
}

export function DeletionPendingPrompt({visible,user,onContinue,onCancelled}:{visible:boolean;user:User;onContinue:()=>void;onCancelled:(user:User)=>void}) {
	const [now,setNow]=useState(Date.now());
	const [busy,setBusy]=useState(false);
	useEffect(()=>{if(!visible)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[visible]);
	if(!user.deletion_scheduled_for)return null;
	const remaining=deletionTimeLabel(user.deletion_scheduled_for,now);
	async function cancelDeletion(){if(busy)return;setBusy(true);try{onCancelled(await api.cancelAccountDeletion())}catch(e){Alert.alert("Не удалось отменить удаление",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}}
	return <Modal visible={visible} animationType="fade" onRequestClose={onContinue}>
		<View style={s.profilePromptScreen}><AmbientCanvas/><SafeAreaView edges={["top","right","left"]} style={s.profilePromptSafe}>
			<View style={s.profilePromptBody}>
				<View style={s.deletionPendingIcon}><Ionicons name="hourglass-outline" size={40} color={colors.red}/></View>
				<Text style={s.profilePromptTitle}>Профиль в процессе удаления</Text>
				<Text style={s.deletionPendingCountdown}>Осталось: {remaining}</Text>
				<Text style={s.profilePromptLead}>До указанного срока приложение работает как обычно. Сохраните или распечатайте необходимые обследования заранее.</Text>
				<Text style={s.profilePromptLead}>После окончания срока профиль и связанные с ним данные будут удалены полностью.</Text>
			</View>
			<View style={s.deletionPendingActions}><Button label={busy?"Отменяем…":"Отменить удаление"} disabled={busy} onPress={()=>void cancelDeletion()}/><Button label="Продолжить" kind="glass" disabled={busy} onPress={onContinue}/></View>
		</SafeAreaView></View>
	</Modal>
}

export function ProfileCompletionModal({ visible, user, onUpdated, onClose }: { visible: boolean; user: User; onUpdated: (user: User) => void; onClose: () => void }) {
  const initialParts = user.full_name.trim().split(/\s+/).filter(Boolean);
  const [name, setName] = useState(initialParts[0] || "");
  const [surname, setSurname] = useState(initialParts[1] || "");
  const [patronymic, setPatronymic] = useState(initialParts.slice(2).join(" "));
  const [birthDate, setBirthDate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [contactEmail, setContactEmail] = useState(user.contact_email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [city, setCity] = useState(user.city || "");
  const [specialization,setSpecialization]=useState(user.specialization||doctorSpecialties[0]);
  const [about,setAbout]=useState(user.doctor_profile?.about||"");
  const [workplace,setWorkplace]=useState(user.doctor_profile?.workplace||"");
  const [experience,setExperience]=useState((user.doctor_profile?.experience||[]).join("\n"));
  const [services,setServices]=useState((user.doctor_profile?.services||[]).join("\n"));
  const [retentionHours, setRetentionHours] = useState(String(user.dev_data_ttl_hours || 24));
  const [busy, setBusy] = useState(false);
  const age = ageFromBirthDate(birthDate);
  const retentionReady = !user.is_developer || (Number(retentionHours) >= 1 && Number(retentionHours) <= 720);
  const ready = !!name.trim() && age > 0 && Number(height) >= 50 && Number(height) <= 250 && Number(weight) >= 5 && Number(weight) <= 400 && retentionReady;
  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const fullName = [name.trim(), surname.trim(), patronymic.trim()].filter(Boolean).join(" ");
      await api.updateContactProfile({ fullName, contactEmail: contactEmail.trim(), phone: phone.trim(), city: city.trim() });
      const updated = await api.updatePatientProfile({ age, birthDate, heightCM: Number(height), weightKG: Number(weight), activity: { regular_sport: false }, nutrition: {}, devDataTTLHours: user.is_developer ? Number(retentionHours) : undefined });
      onUpdated(updated);
    } catch (e) {
      Alert.alert("Не удалось сохранить", e instanceof Error ? e.message : "Проверьте введённые данные");
    } finally {
      setBusy(false);
    }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={s.profileCompletionScreen}>
      <AmbientCanvas/>
      <SafeAreaView edges={["top","right","bottom","left"]} style={s.profileCompletionSafe}>
        <View style={s.profileHeader}><Pressable accessibilityRole="button" accessibilityLabel="Назад" style={s.profileBack} onPress={onClose}><Ionicons name="arrow-back" size={27}/></Pressable><Text style={s.fullScreenTitle}>Ваш профиль</Text><View style={s.headerSpacer}/></View>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.profileCompletionBody}>
            <Text style={s.profileCompletionTitle}>Личные параметры</Text>
            <Text style={s.profileCompletionHint}>Они нужны для персонализации результатов и не меняют исходные значения анализов.</Text>
            <ProfileLine label="Имя" value={name} onChangeText={setName}/>
            <ProfileLine label="Фамилия" value={surname} placeholder="Необязательно" onChangeText={setSurname}/>
            <ProfileLine label="Отчество" value={patronymic} placeholder="Необязательно" onChangeText={setPatronymic}/>
            <ProfileLine label="Дата рождения" value={birthDate} placeholder="ДД.ММ.ГГГГ" keyboardType="number-pad" maxLength={10} onChangeText={(value:string)=>setBirthDate(formatBirthDate(value))}/>
            <ProfileLine label="Рост" suffix="см" value={height} keyboardType="decimal-pad" onChangeText={setHeight}/>
            <ProfileLine label="Вес" suffix="кг" value={weight} keyboardType="decimal-pad" onChangeText={setWeight}/>
            <Text style={s.profileSectionTitle}>Контакты — необязательно</Text>
            <ProfileLine label="Почта" value={contactEmail} keyboardType="email-address" autoCapitalize="none" onChangeText={setContactEmail}/>
            <ProfileLine label="Телефон" value={phone} keyboardType="phone-pad" onChangeText={setPhone}/>
            <ProfileLine label="Город" value={city} placeholder="Например, Томск" onChangeText={setCity}/>
            {user.is_developer&&<><Text style={s.profileSectionTitle}>Режим разработки</Text><ProfileLine label="Хранить тестовые данные" suffix="ч" value={retentionHours} keyboardType="number-pad" onChangeText={setRetentionHours}/><Text style={s.profileCompletionHint}>Анализы, визиты и сообщения Dev автоматически удаляются по истечении этого срока и не попадают в статистику.</Text></>}
          </ScrollView>
          <View style={s.profileCompletionFooter}><Button label={busy ? "Сохраняем…" : "Сохранить"} kind="glass" disabled={!ready || busy} onPress={() => void save()}/></View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  </Modal>;
}


export function ConsentControls({ personal, medical, onPersonal, onMedical }: { personal: boolean; medical: boolean; onPersonal: (value: boolean) => void; onMedical: (value: boolean) => void }) {
  const [legal, setLegal] = useState<"personal" | "medical" | null>(null);
  const row = (kind: "personal" | "medical", checked: boolean, label: string, onChange: (value: boolean) => void) => <View style={s.consentRow}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Отметить: ${label}`} accessibilityState={{ checked }} hitSlop={8} onPress={() => onChange(!checked)} style={[s.consentBox, checked && s.consentBoxChecked]}>{checked && <Ionicons name="checkmark" size={16} color={colors.white}/>}</Pressable>
    <Pressable accessibilityRole="button" onPress={() => setLegal(kind)} style={s.consentTextButton}><Text style={s.consentLabel}>{label}</Text><Text style={s.consentOpen}>Открыть полный текст</Text></Pressable>
  </View>;
  const personalText = "Настоящим я свободно, своей волей и в своём интересе даю оператору приложения Lab согласие на обработку моих персональных данных в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».\n\nПеречень данных: фамилия, имя и отчество (если указаны), возраст, контактные и регистрационные данные, сведения профиля, история обращений, записи на приём и технические сведения, необходимые для работы учётной записи.\n\nЦели обработки: регистрация и идентификация пользователя, организация записи и консультаций, отображение информации выбранному пользователем врачу, обеспечение безопасности и исполнение запросов пользователя.\n\nРазрешённые действия: сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, предоставление выбранному врачу, блокирование и удаление. Обработка может выполняться с использованием средств автоматизации.\n\nСогласие действует до достижения указанных целей либо до его отзыва. Я вправе отозвать согласие обращением к оператору. Отзыв не отменяет обработку, допустимую или обязательную по закону. Я подтверждаю, что согласие является конкретным, предметным, информированным, сознательным и однозначным.";
  const medicalText = "Настоящим я даю согласие на предоставление выбранному мною врачу доступа к сведениям о состоянии здоровья, составляющим врачебную тайну, в соответствии со статьёй 13 Федерального закона № 323-ФЗ «Об основах охраны здоровья граждан в Российской Федерации».\n\nДоступ включает загруженные лабораторные анализы и иные обследования, распознанные показатели, исходные документы, историю показателей и сформированные по ним резюме.\n\nЦель доступа: рассмотрение моего запроса на консультацию или запись, подготовка врачом ответа, заключения и рекомендаций. Доступ предоставляется только выбранному врачу и не означает разрешение на распространение сведений неопределённому кругу лиц.\n\nЯ понимаю, что при отсутствии этого согласия врач не увидит мои анализы и обследования. Согласие действует до отзыва либо прекращения целей предоставления доступа. Я могу отозвать его через обращение к оператору; ранее совершённые на законном основании действия остаются правомерными.";
  return <>
    <View style={s.consentGroup}>
      {row("personal", personal, "Согласие на обработку персональных данных", onPersonal)}
      {row("medical", medical, "Согласие на предоставление доступа к данным обследований", onMedical)}
    </View>
    <Modal visible={!!legal} animationType="slide" onRequestClose={() => setLegal(null)}><SafeAreaView style={s.fullScreenModal}><View style={s.fullScreenHeader}><Pressable accessibilityLabel="Назад" style={s.iconButton} onPress={() => setLegal(null)}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={2} style={s.fullScreenTitle}>{legal === "medical" ? "Доступ к данным обследований" : "Обработка персональных данных"}</Text><View style={s.headerSpacer}/></View><ScrollView contentContainerStyle={s.legalBody}><Text selectable style={s.legalText}>{legal === "medical" ? medicalText : personalText}</Text></ScrollView></SafeAreaView></Modal>
  </>;
}

export function Profile({ user, onUpdated, canDeleteAccount = true }: { user: User; onUpdated: (u: User) => void; canDeleteAccount?: boolean }) {
  const profile = user.patient_profile;
  const [fullName, setFullName] = useState(user.full_name);
  const [contactEmail, setContactEmail] = useState(user.contact_email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [city, setCity] = useState(user.city || "");
  const [specialization,setSpecialization]=useState(user.specialization||doctorSpecialties[0]);
  const [about,setAbout]=useState(user.doctor_profile?.about||"");
  const [workplace,setWorkplace]=useState(user.doctor_profile?.workplace||"");
  const [experience,setExperience]=useState((user.doctor_profile?.experience||[]).join("\n"));
  const [services,setServices]=useState((user.doctor_profile?.services||[]).join("\n"));
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [height, setHeight] = useState(profile ? String(profile.height_cm) : "");
  const [weight, setWeight] = useState(profile ? String(profile.weight_kg) : "");
  const [retentionHours, setRetentionHours] = useState(String(user.dev_data_ttl_hours || 24));
  const [busy, setBusy] = useState(false);
	const [deletionConfirm,setDeletionConfirm]=useState(false);
  async function chooseAvatar(source:"camera"|"gallery"){
    const permission=source==="camera"?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){Alert.alert("Нет доступа",source==="camera"?"Разрешите доступ к камере.":"Разрешите доступ к галерее.");return}
    const result=source==="camera"?await ImagePicker.launchCameraAsync({mediaTypes:["images"],quality:.85,allowsEditing:true,aspect:[1,1]}):await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:.85,allowsEditing:true,aspect:[1,1]});
    if(result.canceled)return;const x=result.assets[0];if(!x)return;setBusy(true);try{onUpdated(await api.uploadAvatar({uri:x.uri,name:x.fileName||`avatar-${Date.now()}.jpg`,mimeType:x.mimeType||"image/jpeg",file:x.file}))}catch(e){Alert.alert("Фото не загружено",e instanceof Error?e.message:"Ошибка")}finally{setBusy(false)}
  }
  async function saveProfile() {
    setBusy(true);
    try {
      let updated = await api.updateContactProfile({ fullName, contactEmail, phone, city });
      if (user.role === "patient") updated = await api.updatePatientProfile({ age: ageFromBirthDate(birthDate) || profile?.age || 0, birthDate, heightCM: Number(height), weightKG: Number(weight), activity: profile?.activity || { regular_sport: false }, nutrition: profile?.nutrition || {}, devDataTTLHours: user.is_developer ? Number(retentionHours) : undefined });
      if (user.role === "doctor") updated = await api.updateDoctorProfile({fullName,specialization:specialization||doctorSpecialties[0]!,city,about,workplace,experience:experience.split("\n"),services:services.split("\n"),schedule_step:user.doctor_profile?.schedule_step||30,visible_days:user.doctor_profile?.visible_days||6});
      onUpdated(updated);
      Alert.alert("Готово", "Данные профиля сохранены.");
    }
    catch (e) { Alert.alert("Не удалось сохранить", e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
	async function requestDeletion() {
		if (busy) return;
		setBusy(true);
		try {
			const updated = await api.requestAccountDeletion();
			setDeletionConfirm(false);
			onUpdated(updated);
		} catch (e) {
			Alert.alert("Удаление не запланировано", e instanceof Error ? e.message : "Ошибка");
		} finally {
			setBusy(false);
		}
	}
  return (
    <ScrollView contentContainerStyle={s.profileScreen}>
      <View style={s.profileIdentity}><View style={s.profileIdentityIcon}>{user.role === "doctor" ? <AvatarView user={user} size={58}/> : <Ionicons name="person-outline" size={31} color={colors.brand}/>}</View><View style={{flex:1}}><Text style={s.profileIdentityName}>{user.full_name}</Text><Text style={s.profileIdentityRole}>{user.role === "doctor" ? user.specialization : "Пользователь"}</Text></View></View>
      <Text style={s.profileSectionTitle}>Личные данные</Text>
      <ProfileLine label="Имя" value={fullName} onChangeText={setFullName}/>
      <ProfileLine label="Почта" value={contactEmail} placeholder="name@example.ru" keyboardType="email-address" autoCapitalize="none" onChangeText={setContactEmail}/>
      <ProfileLine label="Мобильный телефон" value={phone} placeholder="+7 900 000-00-00" keyboardType="phone-pad" onChangeText={setPhone}/>
      <ProfileLine label="Город" value={city} placeholder="Например, Томск" onChangeText={setCity}/>
      {user.role === "doctor" && <><Text style={s.profileSectionTitle}>Профессиональный профиль</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.specialtyScroller}>{doctorSpecialties.map(item=><Choice key={item} active={specialization===item} label={item} onPress={()=>setSpecialization(item)}/>)}</ScrollView><ProfileLine label="Место работы" value={workplace} onChangeText={setWorkplace}/><ProfileLine label="О себе" multiline value={about} onChangeText={setAbout}/><ProfileLine label="Опыт — один пункт на строку" multiline value={experience} onChangeText={setExperience}/><ProfileLine label="Услуги — один пункт на строку" multiline value={services} onChangeText={setServices}/><Text style={s.profileSectionTitle}>Фотография</Text><View style={s.profilePhotoActions}><MiniAction label="Камера" icon="camera-outline" onPress={()=>void chooseAvatar("camera")}/><MiniAction label="Галерея" icon="images-outline" onPress={()=>void chooseAvatar("gallery")}/></View></>}
      {user.role === "patient" && <><Text style={s.profileSectionTitle}>Показатели здоровья</Text><ProfileLine label="Дата рождения" value={birthDate} placeholder="ДД.ММ.ГГГГ" keyboardType="number-pad" maxLength={10} onChangeText={(value:string)=>setBirthDate(formatBirthDate(value))}/><ProfileLine label="Рост" suffix="см" value={height} keyboardType="decimal-pad" onChangeText={setHeight}/><ProfileLine label="Вес" suffix="кг" value={weight} keyboardType="decimal-pad" onChangeText={setWeight}/>{profile ? <View style={s.profileInfoLine}><Text style={s.profileInfoLabel}>Индекс массы тела</Text><Text style={s.profileInfoValue}>{profile.bmi}</Text></View> : null}</>}
      {user.is_developer&&<><Text style={s.profileSectionTitle}>Режим разработки</Text><ProfileLine label="Хранить тестовые данные" suffix="ч" value={retentionHours} keyboardType="number-pad" onChangeText={setRetentionHours}/><Text style={s.profileCompletionHint}>Материалы Dev удаляются автоматически и не учитываются в метриках приложения.</Text></>}
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
	  {canDeleteAccount && <View style={s.profileDeletionSection}>
		<Text style={s.profileDeletionTitle}>Управление профилем</Text>
		<Pressable accessibilityRole="button" disabled={busy} onPress={()=>setDeletionConfirm(true)} style={({pressed})=>[s.profileDeletionAction,pressed&&s.pressablePressed]}><Ionicons name="trash-outline" size={21} color={colors.red}/><Text style={s.profileDeletionActionText}>Удалить профиль</Text></Pressable>
	  </View>}
	  <Modal visible={deletionConfirm} transparent animationType="fade" onRequestClose={()=>setDeletionConfirm(false)}>
		<View style={s.deletionConfirmBackdrop}><View style={s.deletionConfirmCard}>
			<View style={s.deletionConfirmIcon}><Ionicons name="warning-outline" size={30} color={colors.red}/></View>
			<Text style={s.deletionConfirmTitle}>Удалить профиль?</Text>
			<Text style={s.deletionConfirmText}>Удаление произойдёт не сразу, а в течение {user.role==="doctor"?"3 дней":"7 дней"}. До окончания этого срока вы сможете входить в приложение и отменить удаление.</Text>
			<Text style={s.deletionConfirmText}>После окончания срока профиль и все ваши данные будут удалены полностью. Пожалуйста, заранее сохраните или распечатайте необходимые обследования.</Text>
			<View style={s.deletionConfirmActions}><Button label="Отмена" kind="glass" disabled={busy} onPress={()=>setDeletionConfirm(false)}/><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void requestDeletion()} style={({pressed})=>[s.deletionConfirmDelete,pressed&&s.pressablePressed,busy&&{opacity:.45}]}>{busy?<ActivityIndicator color={colors.white}/>:<Text style={s.deletionConfirmDeleteText}>Удалить профиль</Text>}</Pressable></View>
		</View></View>
	  </Modal>
    </ScrollView>
  );
}

export function ProfileLine({ label, suffix, ...props }: any) {
  return <View style={s.profileLine}><Text style={s.profileLineLabel}>{label}</Text><View style={s.profileLineValue}><TextInput {...props} style={s.profileLineInput} placeholderTextColor={colors.muted}/>{suffix ? <Text style={s.profileLineSuffix}>{suffix}</Text> : null}</View></View>;
}
