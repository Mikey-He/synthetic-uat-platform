"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { token: string; stickyTop: number };

export function LeftNav({ token, stickyTop }: Props) {
  const pathname = usePathname();
  const base = `/s/${token}`;
  const items = [
    { label: "Overview", href: `${base}/billing`, active: pathname === `${base}/billing` },
    { label: "Reports", href: `${base}/stub/reports`, active: pathname === `${base}/stub/reports` },
    {
      label: "Budgets & alerts",
      href: `${base}/billing/budgets`,
      active: pathname.startsWith(`${base}/billing/budgets`),
    },
    {
      label: "Account management",
      href: `${base}/billing/account`,
      active: pathname === `${base}/billing/account`,
    },
  ];

  return (
    <nav
      className="sticky w-64 shrink-0 self-start border-r border-line py-2"
      style={{ top: stickyTop, height: `calc(100vh - ${stickyTop}px)` }}
    >
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className={`mr-3 block rounded-r-full py-2 pl-6 pr-4 ${
                item.active ? "bg-selected font-medium text-selected-ink" : "hover:bg-surface"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
