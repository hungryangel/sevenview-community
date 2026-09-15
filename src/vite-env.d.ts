/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_REACT_DEVTOOLS?: string
  readonly VITE_USAGE_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Navigator {
  readonly globalPrivacyControl?: boolean
}
