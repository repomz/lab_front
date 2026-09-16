import { Platform } from "react-native";
import { PROFILE_PROMPT_KEY } from "../../config";
import { User } from "../../types";

export function shouldPromptForProfile(user: User) {
  if (user.role !== "patient" || user.patient_profile) return false;
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return true;
  return localStorage.getItem(`${PROFILE_PROMPT_KEY}:${user.id}`) !== "1";
}

export function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
}

export function ageFromBirthDate(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > new Date()) return 0;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age >= 0 && age <= 120 ? age : 0;
}


