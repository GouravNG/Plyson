import type { BaseLayoutProps, LayoutTab } from 'fumadocs-ui/layouts/shared';
import { Terminal, TestTube } from 'lucide-react';
import { appName, gitConfig } from './shared';

export const docsTabs: LayoutTab[] = [
  {
    title: 'Plyson Test',
    description: 'Core framework reference',
    url: '/docs/test',
    icon: <TestTube className="size-4 shrink-0" />,
  },
  {
    title: 'Plyson CLI',
    description: 'CLI tool reference',
    url: '/docs/cli',
    icon: <Terminal className="size-4 shrink-0" />,
  },
];

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
} 
