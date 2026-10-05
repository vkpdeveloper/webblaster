import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Web Blaster',
    description: 'Turn any web page into a destructible retro pixel-art level. Run, jump, fly and blow it to bits.',
    permissions: ['activeTab', 'scripting', 'storage', 'contextMenus'],
    action: {
      default_title: 'Web Blaster',
    },
    commands: {
      'destroy-page': {
        suggested_key: { default: 'Alt+Shift+D' },
        description: 'Destroy the current page',
      },
    },
    web_accessible_resources: [
      {
        resources: ['fonts/*.ttf'],
        matches: ['<all_urls>'],
      },
      {
        resources: ['music/dance.mp3'],
        matches: ['*://x.com/*', '*://twitter.com/*', '*://mobile.x.com/*', '*://mobile.twitter.com/*'],
      },
    ],
  },
});
