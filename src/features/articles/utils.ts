import { Platform } from "react-native";
import { API_URL } from "../../api";

export const articleImageURI = (value: string) =>
  /^https?:/i.test(value) ? value : Platform.OS === "web" ? value : `${API_URL.replace(/\/api\/v1\/?$/, "")}${value}`;
