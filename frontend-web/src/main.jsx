// Init Sentry trước mọi import khác để hook lỗi lúc module load
import "./sentry.js";

import { ConfigProvider, App as AntApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { LanguageProvider, UiTextTranslator, useLanguage } from "./i18n.jsx";
import { router } from "./router.jsx";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 }
  }
});

const themeConfig = {
  token: {
    colorPrimary: "#1e3a8a",        // Navy-800 — enterprise blue
    colorPrimaryHover: "#1d4ed8",   // Blue-700
    colorBgLayout: "#f8fafc",       // Slate-50
    colorBorderSecondary: "#e2e8f0", // Slate-200
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorText: "#0f172a",           // Slate-900
    colorTextSecondary: "#64748b",  // Slate-500
    colorBgContainer: "#ffffff",
    colorBorder: "#e2e8f0",         // Slate-200
    boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)"
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 60,
      siderBg: "#ffffff",
      bodyBg: "#f8fafc"             // Slate-50
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#dbeafe",     // Blue-100`
      itemSelectedColor: "#1e3a8a",  // Navy-800
      itemHoverBg: "#eff6ff",        // Blue-50
      itemHoverColor: "#1e3a8a",
      itemBorderRadius: 8,
      subMenuItemBg: "transparent",
      itemMarginInline: 8,
      itemHeight: 38,
      fontSize: 13.5,
      fontWeightStrong: 600
    },
    Table: {
      headerBg: "#f8fafc",          // Slate-50
      rowHoverBg: "#f1f5f9",        // Slate-100
      borderColor: "#e2e8f0",       // Slate-200
      fontSize: 13.5
    },
    Card: {
      headerBg: "#ffffff",
      colorBorderSecondary: "#e2e8f0", // Slate-200
      borderRadius: 10
    },
    Button: {
      controlHeight: 36,
      borderRadius: 8,
      fontSize: 13.5,
      fontWeight: 500
    },
    Input: {
      controlHeight: 36,
      borderRadius: 8,
      fontSize: 13.5
    },
    Select: {
      controlHeight: 36,
      borderRadius: 8,
      fontSize: 13.5
    },
    Modal: {
      borderRadius: 12
    },
    Tag: {
      borderRadius: 6,
      fontSize: 12
    }
  }
};

function Root() {
  const { antdLocale } = useLanguage();

  return (
    <ConfigProvider locale={antdLocale} theme={themeConfig}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <UiTextTranslator />
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  </React.StrictMode>
);
