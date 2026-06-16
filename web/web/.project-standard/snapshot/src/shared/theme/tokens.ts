export const uiTokens = {
  color: {
    primary: "#1677FF",
    primaryHover: "#4096FF",
    primaryActive: "#0958D9",
    primaryBg: "#E6F4FF",
    primaryBgStrong: "#BAE0FF",
    pageBg: "#F4F6FA",
    sidebarBg: "#FFFFFF",
    headerBg: "#FFFFFF",
    cardBg: "#FFFFFF",
    tableHeaderBg: "#FBFCFE",
    shellBorder: "#D9E1EC",
    border: "#E5EAF0",
    borderStrong: "#CCD5E1",
    split: "#EDF1F6",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textTertiary: "#94A3B8",
    textDisabled: "#94A3B8",
    infoBg: "#E1F5FE",
    infoBorder: "#81D4FA",
    info: "#3B6AA0",
    successBg: "#E8F5E9",
    successBorder: "#A5D6A7",
    success: "#2F7D46",
    successHover: "#246437",
    warningBg: "#FFF3E0",
    warningBorder: "#FFCC02",
    warning: "#A86617",
    warningHover: "#865113",
    dangerBg: "#FFF2F0",
    dangerBorder: "#FFCCC7",
    danger: "#FF4D4F",
    dangerHover: "#FF7875"
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 8,
    xl: 10
  },
  shadow: {
    soft: "0 1px 2px rgba(15, 23, 42, 0.035)",
    cardHover: "0 8px 18px rgba(15, 23, 42, 0.08)",
    modal:
      "0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)"
  }
} as const;

export const statusTokens = {
  success: { bg: uiTokens.color.successBg, color: uiTokens.color.success },
  processing: { bg: uiTokens.color.infoBg, color: uiTokens.color.info },
  warning: { bg: uiTokens.color.warningBg, color: uiTokens.color.warning },
  danger: { bg: uiTokens.color.dangerBg, color: uiTokens.color.danger },
  neutral: { bg: "#F5F5F5", color: "rgba(33, 33, 33, 0.6)" }
} as const;

export const chartTokens = {
  blue: uiTokens.color.primary,
  green: uiTokens.color.success,
  orange: uiTokens.color.warning,
  red: uiTokens.color.danger,
  purple: "#7E57C2",
  cyan: uiTokens.color.info,
  slate: "rgba(33, 33, 33, 0.38)",
  axis: "rgba(33, 33, 33, 0.38)",
  legend: "rgba(33, 33, 33, 0.6)",
  splitLine: "#EEEEEE"
} as const;

export const chartStatusColor = {
  succeeded: chartTokens.green,
  failed: chartTokens.red,
  processing: chartTokens.blue,
  pending: chartTokens.orange,
  draft: chartTokens.slate,
  offline: chartTokens.slate
} as const;
