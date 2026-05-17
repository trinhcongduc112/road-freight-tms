// @ts-check
// Docusaurus config — Road Freight TMS user docs

import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Road Freight TMS",
  tagline: "Hệ thống quản lý vận tải đường bộ đa tổ chức",
  favicon: "img/favicon.ico",

  // GitHub Pages URL: https://trinhcongduc112.github.io/road-freight-tms/
  url: "https://trinhcongduc112.github.io",
  baseUrl: "/road-freight-tms/",

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
    locales: ["vi"]
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
            to: "/api/",
            label: "🔌 API Docs",
            position: "left"
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
