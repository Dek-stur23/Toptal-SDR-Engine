import type { AccountData, ToolId } from "@/lib/types";

export type AccountDataUpdater =
  | AccountData
  | ((prev: AccountData) => AccountData);

export interface StepProps {
  accountData: AccountData;
  setAccountData: (updater: AccountDataUpdater) => void;
  onComplete: () => void;
}

export interface ToolProps {
  accountData: AccountData;
  setAccountData: (updater: AccountDataUpdater) => void;
  setActiveActionTool?: (toolId: ToolId) => void;
}
