"use client";

import { useState, type ReactNode } from "react";
import { TASK_BAR_HEIGHT, TaskBar } from "@/components/taskbar/TaskBar";
import { LeftNav } from "./LeftNav";
import { TopBar } from "./TopBar";

type Props = {
  token: string;
  accountName: string;
  userName: string;
  children: ReactNode;
};

export function ParticipantShell({ token, accountName, userName, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const taskBarHeight = collapsed ? TASK_BAR_HEIGHT.collapsed : TASK_BAR_HEIGHT.expanded;

  return (
    <>
      <TaskBar token={token} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div style={{ paddingTop: taskBarHeight }}>
        <TopBar accountName={accountName} userName={userName} />
        <div className="flex">
          <LeftNav token={token} stickyTop={taskBarHeight} />
          <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
        </div>
      </div>
    </>
  );
}
