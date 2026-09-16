import { Platform } from "react-native";
import { ActivitySurvey, AIChat, AIMessage, Analysis, AppStats, ClinicalArticle, ClinicalAssistResult, Consultation, DoctorProfile, NutritionSurvey, PatientHealthSummary, PatientNote, Role, ScheduleSlot, SupportMessage, User } from "./types";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || (Platform.OS === "web" ? "/api/v1" : "http://localhost:8080/api/v1");
let token = "";
export async function restoreToken() {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.removeItem("lab.session");
  return token;
}
export async function setToken(value: string) {
  token = value;
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте интернет и повторите попытку.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Не удалось выполнить запрос");
  return body as T;
}
async function requestList<T>(path: string, init: RequestInit = {}): Promise<T[]> {
  const body = await request<T[] | null>(path, init);
  return Array.isArray(body) ? body : [];
}
async function download(path: string): Promise<Blob> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте интернет и повторите попытку.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Не удалось загрузить файл");
  }
  return res.blob();
}
export const api = {
  register: (v: {
    email: string;
    pin: string;
    role: Role;
    fullName: string;
    birthDate: string;
    gender: "female" | "male";
    specialization?: string;
    licenseNumber?: string;
    age?: number;
    heightCM?: number;
    weightKG?: number;
  }) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: v.email,
        pin: v.pin,
        role: v.role,
        fullName: v.fullName,
        birthDate: v.birthDate,
        gender: v.gender,
        specialization: v.specialization,
        licenseNumber: v.licenseNumber,
        age: v.age,
        heightCM: v.heightCM,
        weightKG: v.weightKG,
      }),
    }),
  login: (email: string, pin: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, pin }),
    }),
  me: () => request<User>("/me"),
  requestAccountDeletion: () => request<User>("/me/deletion-request", { method: "POST" }),
  cancelAccountDeletion: () => request<User>("/me/deletion-request", { method: "DELETE" }),
  updatePatientProfile: (value: { age: number; birthDate?: string; heightCM: number; weightKG: number; activity: ActivitySurvey; nutrition: NutritionSurvey; devDataTTLHours?: number }) =>
    request<User>("/me/patient-profile", { method: "PATCH", body: JSON.stringify(value) }),
  updateContactProfile: (value: { fullName: string; contactEmail: string; phone: string; city: string }) =>
    request<User>("/me/contact-profile", { method: "PATCH", body: JSON.stringify(value) }),
  updateDoctorProfile: (value: { fullName: string; specialization: string; city: string } & DoctorProfile) =>
    request<User>("/me/doctor-profile", { method: "PATCH", body: JSON.stringify(value) }),
  updateSettings: (onlineClinic: boolean) => request<User>("/me/settings", { method: "PATCH", body: JSON.stringify({ onlineClinic }) }),
  uploadAvatar: async (asset: { uri: string; name: string; mimeType?: string; file?: Blob }) => {
    const form=new FormData(); if(Platform.OS==="web"){let file=asset.file;if(!file){file=await (await fetch(asset.uri)).blob()}form.append("file",file,asset.name)}else{form.append("file",{uri:asset.uri,name:asset.name,type:asset.mimeType||"image/jpeg"} as unknown as Blob)};return request<User>("/me/avatar",{method:"POST",body:form});
  },
  avatarPreset: (preset: string) => request<User>("/me/avatar-preset",{method:"PATCH",body:JSON.stringify({preset})}),
  doctors: (specialty = "", city = "") => { const q=new URLSearchParams();if(specialty)q.set("specialty",specialty);if(city)q.set("city",city);return requestList<User>(`/doctors${q.toString()?`?${q}`:""}`) },
  patients: () => requestList<User>("/patients"),
  appStats: () => request<AppStats>("/admin/stats"),
  impersonate: (role: "patient"|"doctor") => request<{token:string;user:User}>("/admin/impersonate", {method:"POST",body:JSON.stringify({role})}),
  analyses: () => requestList<Analysis>("/analyses"),
  healthSummary: () => request<PatientHealthSummary>("/me/health-summary"),
  consultations: () => requestList<Consultation>("/consultations"),
  supportMessages: () => requestList<SupportMessage>("/support/messages"),
  sendSupportMessage: (text: string, userId?: string) => request<SupportMessage>("/support/messages", { method: "POST", body: JSON.stringify({ text, userId }) }),
  upload: async (
    asset: { uri: string; name: string; mimeType?: string; file?: Blob },
  ) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      let file = asset.file;
      if (!file) {
        const response = await fetch(asset.uri);
        if (!response.ok)
          throw new Error("Не удалось прочитать выбранный файл");
        file = await response.blob();
      }
      if (!file.type && asset.mimeType)
        file = new Blob([file], { type: asset.mimeType });
      form.append("file", file, asset.name);
    } else {
      form.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/octet-stream",
      } as unknown as Blob);
    }
    return request<Analysis>("/analyses", { method: "POST", body: form });
  },
  confirmAnalysis: (analysisID: string, markers: Analysis["markers"]) =>
    request<Analysis>(`/analyses/${analysisID}/confirm`, { method: "POST", body: JSON.stringify({ markers }) }),
  reprocessAnalysis: (analysisID: string) =>
    request<Analysis>(`/analyses/${analysisID}/reprocess`, { method: "POST" }),
  deleteAnalysis: (analysisID: string) =>
    request<void>(`/analyses/${analysisID}`, { method: "DELETE" }),
  share: (analysisID: string, doctorID: string) =>
    request(`/analyses/${analysisID}/share`, {
      method: "POST",
      body: JSON.stringify({ doctor_id: doctorID }),
    }),
  consult: (analysisID: string, doctorID: string, question: string) =>
    request<Consultation>("/consultations", {
      method: "POST",
      body: JSON.stringify({ analysisID, doctorID, question }),
    }),
  requestDoctor: (value: { doctorID: string; question: string; serviceType: "consultation" | "appointment" | "home_visit"; appointmentAt?: string; personalDataConsent: boolean; medicalDataConsent: boolean }) =>
    request<Consultation>("/consultations", { method: "POST", body: JSON.stringify(value) }),
  aiConsult: (question: string) =>
    request<Consultation>("/consultations/ai", { method: "POST", body: JSON.stringify({ question }) }),
  recommendation: (kind: "activity" | "nutrition", value: { activity?: ActivitySurvey; nutrition?: NutritionSurvey }) =>
    request<{ recommendation: string; user: User }>(`/recommendations/${kind}`, { method: "POST", body: JSON.stringify(value) }),
  clinicalAssist: (value: { patientID: string; objective: string; clinical: string }) =>
    request<ClinicalAssistResult>("/clinical-assist", { method: "POST", body: JSON.stringify({ patient_id: value.patientID, objective: value.objective, clinical: value.clinical }) }),
  reply: (id: string, reply: string) =>
    request(`/consultations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ reply, status: "answered" }),
    }),
  consultationMessage: (id:string,text:string) => request(`/consultations/${id}/messages`,{method:"POST",body:JSON.stringify({text})}),
  schedule: (doctorID: string, from: string, to: string) => requestList<ScheduleSlot>(`/doctors/${doctorID}/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  saveSchedule: (from: string, to: string, starts: string[], slotMinutes = 30) => request("/doctor/schedule", { method: "PUT", body: JSON.stringify({ from, to, starts, slotMinutes }) }),
  patientNotes: (patientID: string) => requestList<PatientNote>(`/patients/${patientID}/notes`),
  addPatientNote: (patientID: string, text: string) => request<PatientNote>(`/patients/${patientID}/notes`, { method: "POST", body: JSON.stringify({ text }) }),
  aiChats: () => requestList<AIChat>("/ai/chats"),
  createAIChat: (title = "") => request<AIChat>("/ai/chats", { method: "POST", body: JSON.stringify({ title }) }),
  aiChat: (id: string) => request<AIChat>(`/ai/chats/${id}`),
  renameAIChat: (id: string, title: string) => request(`/ai/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteAIChat: (id: string) => request<void>(`/ai/chats/${id}`, { method: "DELETE" }),
  aiMessage: (id: string, content: string) => request<AIMessage>(`/ai/chats/${id}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
  articles: () => requestList<ClinicalArticle>("/articles"),
  article: (id: string) => request<ClinicalArticle>(`/articles/${id}`),
  createArticle: (value: Omit<ClinicalArticle,"id"|"doctor_id"|"created_at"|"updated_at">) => request<ClinicalArticle>("/articles", { method:"POST", body:JSON.stringify(value) }),
  updateArticle: (id: string, value: Omit<ClinicalArticle,"id"|"doctor_id"|"created_at"|"updated_at">) => request<ClinicalArticle>(`/articles/${id}`, { method:"PATCH", body:JSON.stringify(value) }),
  deleteArticle: (id: string) => request<void>(`/articles/${id}`, { method:"DELETE" }),
  uploadArticleImage: async (asset: { uri: string; name: string; mimeType?: string; file?: Blob }) => {
    const form=new FormData(); if(Platform.OS==="web"){let file=asset.file;if(!file)file=await(await fetch(asset.uri)).blob();form.append("file",file,asset.name)}else{form.append("file",{uri:asset.uri,name:asset.name,type:asset.mimeType||"image/jpeg"} as unknown as Blob)}
    return request<{url:string}>("/articles/media",{method:"POST",body:form});
  },
  reportBlob: (id: string) => download(`/analyses/${id}/report.pdf`),
  fileURL: (id: string) =>
    `${API_URL}/analyses/${id}/file?access_token=${encodeURIComponent(token)}`,
  reportURL: (id: string) =>
    `${API_URL}/analyses/${id}/report.pdf?access_token=${encodeURIComponent(token)}`,
  token: () => token,
  avatarURL: (user: User) => user.avatar_updated_at && !user.avatar_preset ? `${API_URL}/users/${user.id}/avatar?access_token=${encodeURIComponent(token)}&v=${encodeURIComponent(user.avatar_updated_at)}` : "",
};
