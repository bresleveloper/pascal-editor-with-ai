'use client'

import { AIChatPanel, Editor, type SidebarTab } from '@pascal-app/editor'

const SIDEBAR_TABS: (SidebarTab & { component: React.ComponentType })[] = [
  {
    id: 'site',
    label: 'Scene',
    component: () => null, // Built-in SitePanel handles this
  },
  {
    id: 'ai-chat',
    label: 'AI Agent',
    component: AIChatPanel,
  },
]

export default function Home() {
  return (
    <div className="h-screen w-screen">
      <Editor layoutVersion="v2" projectId="local-editor" sidebarTabs={SIDEBAR_TABS} />
    </div>
  )
}
