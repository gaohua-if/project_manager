import type { ThemeConfig } from "antd";
import { theme } from "antd";

import { uiTokens } from "./tokens";

export const antdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: uiTokens.color.primary,
    colorSuccess: uiTokens.color.success,
    colorWarning: uiTokens.color.warning,
    colorError: uiTokens.color.danger,
    colorInfo: uiTokens.color.info,
    colorLink: uiTokens.color.primary,
    colorLinkHover: uiTokens.color.primaryHover,
    colorTextBase: uiTokens.color.textPrimary,
    colorBgBase: uiTokens.color.cardBg,
    colorPrimaryBg: uiTokens.color.primaryBg,
    colorPrimaryBgHover: uiTokens.color.primaryBgStrong,
    colorPrimaryBorder: "#91CAFF",
    colorPrimaryBorderHover: "#69B1FF",
    colorPrimaryHover: uiTokens.color.primaryHover,
    colorPrimaryActive: uiTokens.color.primaryActive,
    colorPrimaryText: uiTokens.color.primary,
    colorSuccessBg: uiTokens.color.successBg,
    colorSuccessBgHover: "#C8E6C9",
    colorSuccessBorder: uiTokens.color.successBorder,
    colorSuccessBorderHover: "#81C784",
    colorSuccessHover: "#4CAF50",
    colorSuccessActive: uiTokens.color.successHover,
    colorSuccessText: uiTokens.color.success,
    colorSuccessTextHover: "#4CAF50",
    colorSuccessTextActive: uiTokens.color.successHover,
    colorWarningBg: uiTokens.color.warningBg,
    colorWarningBgHover: "#FFE0B2",
    colorWarningBorder: uiTokens.color.warningBorder,
    colorWarningBorderHover: "#FFB74D",
    colorWarningHover: "#FF9800",
    colorWarningActive: uiTokens.color.warningHover,
    colorWarningText: uiTokens.color.warning,
    colorWarningTextHover: "#FF9800",
    colorWarningTextActive: uiTokens.color.warningHover,
    colorErrorBg: uiTokens.color.dangerBg,
    colorErrorBgHover: "#FFCDD2",
    colorErrorBorder: uiTokens.color.dangerBorder,
    colorErrorBorderHover: "#E57373",
    colorErrorHover: uiTokens.color.dangerHover,
    colorErrorActive: "#D9363E",
    colorErrorText: uiTokens.color.danger,
    colorErrorTextHover: uiTokens.color.dangerHover,
    colorErrorTextActive: "#D9363E",
    colorInfoBg: uiTokens.color.infoBg,
    colorInfoBgHover: "#B3E5FC",
    colorInfoBorder: uiTokens.color.infoBorder,
    colorInfoBorderHover: "#4FC3F7",
    colorInfoHover: "#03A9F4",
    colorInfoActive: "#01579B",
    colorInfoText: uiTokens.color.info,
    colorInfoTextHover: "#03A9F4",
    colorInfoTextActive: "#01579B",
    borderRadius: uiTokens.radius.md,
    borderRadiusXS: 4,
    borderRadiusSM: uiTokens.radius.sm,
    borderRadiusLG: uiTokens.radius.xl,
    controlHeight: 36,
    controlHeightSM: 28,
    controlHeightLG: 40,
    fontSize: 14,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorText: uiTokens.color.textPrimary,
    colorTextSecondary: uiTokens.color.textSecondary,
    colorTextTertiary: uiTokens.color.textTertiary,
    colorTextQuaternary: uiTokens.color.textDisabled,
    colorTextDisabled: uiTokens.color.textDisabled,
    colorBgLayout: uiTokens.color.pageBg,
    colorBgContainer: uiTokens.color.cardBg,
    colorBgElevated: uiTokens.color.cardBg,
    colorBgSpotlight: "rgba(33, 33, 33, 0.85)",
    colorBgMask: "rgba(33, 33, 33, 0.5)",
    colorBorder: uiTokens.color.borderStrong,
    colorBorderSecondary: uiTokens.color.border,
    controlOutline: "rgba(22, 119, 255, 0.2)",
    boxShadow: uiTokens.shadow.soft,
    boxShadowSecondary: uiTokens.shadow.cardHover
  },
  components: {
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
      defaultBorderColor: uiTokens.color.borderStrong,
      defaultColor: uiTokens.color.textPrimary,
      defaultBg: "#FFFFFF",
      defaultHoverBg: "rgba(22, 119, 255, 0.04)",
      defaultHoverBorderColor: "rgba(0, 0, 0, 0.23)",
      defaultHoverColor: uiTokens.color.primary,
      defaultActiveBg: "rgba(22, 119, 255, 0.08)",
      defaultActiveBorderColor: "rgba(0, 0, 0, 0.23)",
      borderRadius: uiTokens.radius.sm,
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 40
    },
    Card: {
      borderRadiusLG: uiTokens.radius.xl,
      colorBorderSecondary: uiTokens.color.border
    },
    Input: {
      activeShadow: "none",
      hoverBorderColor: uiTokens.color.primary,
      activeBorderColor: uiTokens.color.primary,
      borderRadius: uiTokens.radius.sm,
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 40
    },
    Select: {
      optionSelectedBg: uiTokens.color.primaryBg,
      optionActiveBg: "rgba(22, 119, 255, 0.04)",
      optionSelectedFontWeight: 500,
      borderRadius: uiTokens.radius.sm,
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 40
    },
    DatePicker: {
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 40
    },
    InputNumber: {
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 40
    },
    Layout: {
      bodyBg: uiTokens.color.pageBg,
      headerBg: uiTokens.color.headerBg,
      siderBg: uiTokens.color.sidebarBg
    },
    Menu: {
      itemBorderRadius: uiTokens.radius.md,
      itemColor: uiTokens.color.textSecondary,
      itemHoverBg: "rgba(22, 119, 255, 0.04)",
      itemHoverColor: uiTokens.color.primaryHover,
      itemSelectedBg: uiTokens.color.primaryBg,
      itemSelectedColor: uiTokens.color.primary
    },
    Alert: {
      borderRadiusLG: uiTokens.radius.md,
      defaultPadding: "10px 12px",
      withDescriptionPadding: "14px 16px"
    },
    Modal: {
      contentBg: uiTokens.color.cardBg,
      headerBg: uiTokens.color.cardBg,
      titleColor: uiTokens.color.textPrimary,
      borderRadiusLG: uiTokens.radius.xl
    },
    Table: {
      headerBg: uiTokens.color.tableHeaderBg,
      headerColor: uiTokens.color.textSecondary,
      rowHoverBg: "#F8FAFC",
      borderColor: uiTokens.color.split
    },
    Form: {
      labelColor: "rgba(33, 33, 33, 0.87)"
    },
    Tag: {
      borderRadiusSM: 999
    },
    Progress: {
      defaultColor: uiTokens.color.primary,
      remainingColor: "rgba(22, 119, 255, 0.12)"
    },
    Steps: {
      iconSize: 24
    },
    Checkbox: {
      borderRadiusSM: uiTokens.radius.sm
    },
    Slider: {
      trackBg: "rgba(22, 119, 255, 0.26)",
      trackHoverBg: "rgba(22, 119, 255, 0.38)",
      handleSize: 20,
      handleSizeHover: 20,
      railSize: 4
    },
    ColorPicker: {
      borderRadius: uiTokens.radius.md
    }
  }
};
