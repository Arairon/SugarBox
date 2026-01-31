declare namespace Express {
  export interface Request {
    auth?: UserAuthObject | null;
  }
}
declare interface UserAuthObject {
  userId: number;
  role: user_role;
  sessionTokenId: number;
  sessionId: number;
  type: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;
      LOG_LEVEL: "debug" | "info" | "warn" | "error";
      PORT?: string;
    }
  }
}
