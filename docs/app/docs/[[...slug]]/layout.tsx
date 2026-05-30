import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions, docsTabs } from '@/lib/layout.shared';
import type { Folder, Node, Root } from 'fumadocs-core/page-tree';

function filterNode(node: Node, prefix: string): Node | null {
  if (node.type === 'page') {
    return node.url.startsWith(prefix) ? node : null;
  }

  if (node.type === 'separator') {
    return node;
  }

  const index = node.index?.url.startsWith(prefix) ? node.index : undefined;
  const children = node.children
    .map((child) => filterNode(child, prefix))
    .filter((child): child is Node => child !== null);

  if (!index && children.length === 0) {
    return null;
  }

  return {
    ...node,
    index,
    children,
  } satisfies Folder;
}

function filterTreeByPrefix(tree: Root, prefix: string): Root {
  const children = tree.children
    .map((child) => filterNode(child, prefix))
    .filter((child): child is Node => child !== null);

  return {
    ...tree,
    children,
  };
}

function getTreeForSection(section?: string) {
  const prefix = section === 'cli' ? '/docs/cli' : '/docs/test';

  return filterTreeByPrefix(source.getPageTree(), prefix);
}

export default async function Layout({
  children,
  params,
}: LayoutProps<'/docs/[[...slug]]'>) {
  const { slug } = await params;
  const section = slug?.[0];

  return (
    <DocsLayout tree={getTreeForSection(section)} tabs={docsTabs} tabMode="auto" {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
