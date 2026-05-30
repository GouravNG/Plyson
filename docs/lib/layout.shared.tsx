import type { BaseLayoutProps, LayoutTab } from 'fumadocs-ui/layouts/shared';
import { Terminal, TestTube } from 'lucide-react';
import { appName, gitConfig } from './shared';
import cliPackage from '../../packages/cli/package.json';
import testPackage from '../../packages/test/package.json';

function tabTitle(label: string, version: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <span className="rounded-full border border-fd-border bg-fd-muted px-2 py-0.5 text-[10px] font-medium leading-none text-fd-muted-foreground">
        v{version}
      </span>
    </span>
  );
}

export const docsTabs: LayoutTab[] = [
  {
    title: tabTitle('Plyson Test', testPackage.version),
    description: 'Core framework reference',
    url: '/docs/test',
    icon: <TestTube className="size-4 shrink-0" />,
  },
  {
    title: tabTitle('Plyson CLI', cliPackage.version),
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
