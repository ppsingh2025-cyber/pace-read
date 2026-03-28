/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Set to `'true'` in CI for Android/iOS native builds (VITE_IS_NATIVE=true).
   * Omitted (undefined) in standard web/PWA builds.
   * Controls analytics suppression and donation-link visibility.
   */
  readonly VITE_IS_NATIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
