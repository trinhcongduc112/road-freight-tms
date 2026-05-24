// @ts-check
// Docusaurus config — Road Freight TMS user docs

import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Road Freight TMS",
  tagline: "Hệ thống quản lý vận tải đường bộ đa tổ chức",
  favicon: "img/favicon.ico",

  // Hai môi trường deploy:
  //   - GitHub Pages (default): https://trinhcongduc112.github.io/road-freight-tms/
  //   - Self-hosted EC2 / domain: set env DOCS_URL + DOCS_BASE_URL khi build
  // VD build cho EC2:  DOCS_URL=http://47.129.225.75:8081 DOCS_BASE_URL=/ npm run build
  url: process.env.DOCS_URL || "https://trinhcongduc112.github.io",
  baseUrl: process.env.DOCS_BASE_URL || "/road-freight-tms/",

  organizationName: "trinhcongduc112",
  projectName: "road-freight-tms",
  deploymentBranch: "gh-pages",
  trailingSlash: false,

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  markdown: {
    hooks: {
      onBrokenMarkdownImages: "warn"
    }
  },

  i18n: {
    defaultLocale: "vi",
    locales: ["vi", "en"],
    localeConfigs: {
      vi: { label: "Tiếng Việt" },
      en: { label: "English" }
    }
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "/"
          // editUrl đã được tắt — tài liệu sản phẩm, không nhận đóng góp công khai
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      })
    ],
    [
      "redocusaurus",
      {
        // Render OpenAPI spec (snapshot từ backend) thành trang API Reference đẹp
        specs: [
          {
            id: "tms-api",
            spec: "static/openapi.json",
            route: "/api/"
          }
        ],
        theme: {
          primaryColor: "#1677ff"
        }
      }
    ]
  ],

  plugins: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        language: ["en", "zh"],
        highlightSearchTermsOnTargetPage: true,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
        docsRouteBasePath: "/",
        indexBlog: false,
        indexPages: true,
        searchResultLimits: 12,
        searchResultContextMaxLength: 80
      }
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/social-card.png",
      colorMode: {
        defaultMode: "light",
        respectPrefersColorScheme: true
      },
      navbar: {
        title: "Road Freight TMS",
        logo: {
          alt: "Road Freight TMS Logo",
          src: "img/logo.svg"
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "userGuide",
            position: "left",
            label: "📘 User Docs"
          },
          {
            to: "/api",
            label: "🔌 API Docs",
            position: "left"
          },
          {
            type: "localeDropdown",
            position: "right"
          }
        ]
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Tài liệu",
            items: [
              { label: "Giới thiệu", to: "/" },
              { label: "API Reference", to: "/api/" },
              { label: "FAQ", to: "/faq" }
            ]
          },
          {
            title: "Vai trò",
            items: [
              { label: "Quản trị viên", to: "/role-admin/quan-ly-to-chuc" },
              { label: "Planner", to: "/role-planner/lap-ke-hoach" },
              { label: "Tài xế", to: "/role-driver/nhan-chuyen" }
            ]
          },
          {
            title: "Liên kết",
            items: [
              { label: "Trang chủ ứng dụng", href: "/" }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Road Freight TMS — Đồ án tốt nghiệp.`
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula
      }
    })
};

export default config;
