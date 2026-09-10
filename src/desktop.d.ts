export {};

declare global {
  interface Window {
    tkDesktop?: {
      isDesktop: boolean;
      loadSettings: () => Promise<any>;
      saveSettings: (value: any) => Promise<void>;
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<any>;
      installUpdate: () => Promise<any>;
      openExternal: (url: string) => Promise<any>;
      onUpdateStatus: (callback: (payload: { state: string; message?: string; version?: string; percent?: number }) => void) => () => void;
    };
  }
}
