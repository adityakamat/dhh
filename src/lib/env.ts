import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

export const env = {
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  redirectUri: isNative
    ? ((import.meta.env.VITE_NATIVE_REDIRECT_URI as string | undefined) ?? "com.adityakamat.dhh://callback")
    : ((import.meta.env.VITE_REDIRECT_URI as string | undefined) ?? `${location.origin}/`),
};
