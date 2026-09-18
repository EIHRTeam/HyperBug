import { defineConfig, type DefaultTheme } from 'vitepress';

const sections = [
  { en: 'Use HyperBug', zh: '使用 HyperBug', pages: [
    ['getting-started', 'Get started', '快速入门'],
    ['issues', 'Issues and discussion', '问题与讨论'],
    ['accounts', 'Accounts and access', '账号与权限'],
    ['project-management', 'Project management', '项目管理'],
  ] },
  { en: 'Deploy and operate', zh: '部署与运维', pages: [
    ['deployment', 'Installation overview', '安装概览'],
    ['deploy-cloudflare', 'Cloudflare', 'Cloudflare'],
    ['deploy-self-hosted', 'Self-hosted', '自托管'],
    ['deploy-frontend', 'Static frontend', '静态前端'],
    ['operations', 'Upgrades and recovery', '升级与恢复'],
  ] },
  { en: 'Develop and get help', zh: '开发与帮助', pages: [
    ['api', 'Public API', '公共 API'],
    ['extensions', 'Extensions', '扩展'],
    ['troubleshooting', 'Troubleshooting', '故障排查'],
    ['releases', 'Release notes', '发布说明'],
  ] },
];

function sidebar(chinese = false): DefaultTheme.SidebarItem[] {
  const prefix = chinese ? '/zh-CN' : '';
  return sections.map((section) => ({
    text: chinese ? section.zh : section.en,
    items: section.pages.map(([slug, en, zh]) => ({
      text: chinese ? zh! : en!,
      link: `${prefix}/guide/${slug}`,
    })),
  }));
}

export default defineConfig({
  title: 'HyperBug',
  description: 'Documentation for HyperBug, an open-source public feedback and issue tracker.',
  srcDir: './site',
  // Project Pages needs the repository prefix. Use / for root/custom-domain hosting.
  base: process.env.DOCS_BASE ?? '/HyperBug/',
  cleanUrls: false,
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [{ text: 'Guide', link: '/guide/getting-started' }],
        sidebar: sidebar(),
      },
    },
    'zh-CN': {
      label: '简体中文',
      lang: 'zh-CN',
      description: 'HyperBug 开源公众反馈与问题跟踪平台文档。',
      themeConfig: {
        nav: [{ text: '指南', link: '/zh-CN/guide/getting-started' }],
        sidebar: sidebar(true),
        docFooter: { prev: '上一页', next: '下一页' },
        outline: { label: '本页目录' },
        langMenuLabel: '语言',
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '目录',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        skipToContentLabel: '跳转到内容',
        notFound: {
          title: '页面未找到',
          quote: '这个页面不存在，请从文档首页继续浏览。',
          linkLabel: '前往文档首页',
          linkText: '返回首页',
        },
      },
    },
  },
  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/EIHRTeam/HyperBug' },
      { icon: 'youtube', link: 'https://www.youtube.com/@EIHRTeam' },
      { icon: 'bilibili', link: 'https://space.bilibili.com/3546749463431245' },
      { icon: 'xiaohongshu', link: 'https://www.xiaohongshu.com/user/profile/69f5d2f00000000002000c01' }
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          'zh-CN': {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到相关结果',
                footer: {
                  selectText: '选择', selectKeyAriaLabel: '回车键',
                  navigateText: '切换', navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭', closeKeyAriaLabel: 'Esc 键',
                },
              },
            },
          },
        },
      },
    },
  },
});
