declare global {
    interface Window {
      gtag?: (...args: any[]) => void;
      google?: {
        accounts: {
          id: {
            initialize: (config: {
              client_id: string;
              callback: (response: { credential: string }) => void;
              nonce?: string;
              use_fedcm_for_prompt?: boolean;
              auto_select?: boolean;
              cancel_on_tap_outside?: boolean;
            }) => void;
            prompt: () => void;
            cancel: () => void;
          };
        };
      };
    }
  }

  declare module "*.css";

  export {};
