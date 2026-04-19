'use client'

import { Editor, type SidebarTab, ViewerToolbarLeft, ViewerToolbarRight } from '@pascal-app/editor'
import AIChatPanel from '@pascal-app/editor/components/ui/ai-chat/ai-chat-panel'

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
      <Editor
        layoutVersion="v2"
        projectId="local-editor"
        sidebarTabs={SIDEBAR_TABS}
        viewerToolbarLeft={<ViewerToolbarLeft />}
        viewerToolbarRight={<ViewerToolbarRight />}
      />
    </div>
  )
}
