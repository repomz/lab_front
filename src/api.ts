import { Platform } from "react-native";
import { ActivitySurvey, AIChat, AIMessage, Analysis, ClinicalAssistResult, Consultation, Guide, GuideCatalog, NutritionSurvey, PatientNote, Role, ScheduleSlot, SupportMessage, User } from "./types";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api/v1";
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
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Не удалось выполнить запрос");
  return body as T;
}
export const api = {
  register: (v: {
    email: string;
    password: string;
    role: Role;
    fullName: string;
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
        password: v.password,
        role: v.role,
        fullName: v.fullName,
        specialization: v.specialization,
        licenseNumber: v.licenseNumber,
        age: v.age,
        heightCM: v.heightCM,
        weightKG: v.weightKG,
      }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  setPIN: (email: string, currentPassword: string, pin: string) =>
    request<{ token: string; user: User }>("/auth/set-pin", {
      method: "POST",
      body: JSON.stringify({ email, currentPassword, pin }),
    }),
  me: () => request<User>("/me"),
  updatePatientProfile: (value: { age: number; heightCM: number; weightKG: number; activity: ActivitySurvey; nutrition: NutritionSurvey }) =>
    request<User>("/me/patient-profile", { method: "PATCH", body: JSON.stringify(value) }),
  updateContactProfile: (value: { fullName: string; phone: string; residentialAddress: string }) =>
    request<User>("/me/contact-profile", { method: "PATCH", body: JSON.stringify(value) }),
  uploadAvatar: async (asset: { uri: string; name: string; mimeType?: string; file?: Blob }) => {
    const form=new FormData(); if(Platform.OS==="web"){let file=asset.file;if(!file){file=await (await fetch(asset.uri)).blob()}form.append("file",file,asset.name)}else{form.append("file",{uri:asset.uri,name:asset.name,type:asset.mimeType||"image/jpeg"} as unknown as Blob)};return request<User>("/me/avatar",{method:"POST",body:form});
  },
  avatarPreset: (preset: string) => request<User>("/me/avatar-preset",{method:"PATCH",body:JSON.stringify({preset})}),
  doctors: (specialty = "") => request<User[]>(`/doctors${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ""}`),
  patients: () => request<User[]>("/patients"),
  analyses: () => request<Analysis[]>("/analyses"),
  consultations: () => request<Consultation[]>("/consultations"),
  supportMessages: () => request<SupportMessage[]>("/support/messages"),
  sendSupportMessage: (text: string) => request<SupportMessage>("/support/messages", { method: "POST", body: JSON.stringify({ text }) }),
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
  schedule: (doctorID: string, from: string, to: string) => request<ScheduleSlot[]>(`/doctors/${doctorID}/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  saveSchedule: (from: string, to: string, starts: string[]) => request("/doctor/schedule", { method: "PUT", body: JSON.stringify({ from, to, starts }) }),
  patientNotes: (patientID: string) => request<PatientNote[]>(`/patients/${patientID}/notes`),
  addPatientNote: (patientID: string, text: string) => request<PatientNote>(`/patients/${patientID}/notes`, { method: "POST", body: JSON.stringify({ text }) }),
  aiChats: () => request<AIChat[]>("/ai/chats"),
  createAIChat: (title = "") => request<AIChat>("/ai/chats", { method: "POST", body: JSON.stringify({ title }) }),
  aiChat: (id: string) => request<AIChat>(`/ai/chats/${id}`),
  renameAIChat: (id: string, title: string) => request(`/ai/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteAIChat: (id: string) => request<void>(`/ai/chats/${id}`, { method: "DELETE" }),
  aiMessage: (id: string, content: string) => request<AIMessage>(`/ai/chats/${id}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
  guides: () => request<GuideCatalog>("/guides"),
  guide: (id: string) => request<Guide>(`/guides/${encodeURIComponent(id)}`),
  syncGuides: () => request<GuideCatalog>("/guides/sync", { method: "POST" }),
  fileURL: (id: string) =>
    `${API_URL}/analyses/${id}/file?access_token=${encodeURIComponent(token)}`,
  reportURL: (id: string) =>
    `${API_URL}/analyses/${id}/report.pdf?access_token=${encodeURIComponent(token)}`,
  token: () => token,
  avatarURL: (user: User) => user.avatar_updated_at && !user.avatar_preset ? `${API_URL}/users/${user.id}/avatar?access_token=${encodeURIComponent(token)}&v=${encodeURIComponent(user.avatar_updated_at)}` : "",
};
