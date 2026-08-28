import { Platform } from "react-native";
import { Analysis, Consultation, Role, User } from "./types";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api/v1";
const TOKEN_KEY = "lab.session";
let token = "";
export async function restoreToken() {
  if (Platform.OS === "web" && typeof localStorage !== "undefined")
    token = localStorage.getItem(TOKEN_KEY) || "";
  return token;
}
export async function setToken(value: string) {
  token = value;
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }
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
      }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/me"),
  doctors: () => request<User[]>("/doctors"),
  analyses: () => request<Analysis[]>("/analyses"),
  consultations: () => request<Consultation[]>("/consultations"),
  upload: async (
    asset: { uri: string; name: string; mimeType?: string; file?: Blob },
    title: string,
  ) => {
    const form = new FormData();
    form.append("title", title);
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
  reprocess: (analysisID: string) =>
    request<Analysis>(`/analyses/${analysisID}/reprocess`, { method: "POST" }),
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
  reply: (id: string, reply: string) =>
    request(`/consultations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ reply, status: "answered" }),
    }),
  fileURL: (id: string) =>
    `${API_URL}/analyses/${id}/file?access_token=${encodeURIComponent(token)}`,
  token: () => token,
};
