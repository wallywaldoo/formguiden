"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function useCollapsed(key: string) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(sessionStorage.getItem(key) === "1");
  }, [key]);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      sessionStorage.setItem(key, next ? "1" : "0");
      return next;
    });
  }

  return [collapsed, toggle] as const;
}

export function CollapseToggle({
  collapsed,
  onToggle,
  label,
}: {
  collapsed: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Visa ${label}` : `Dölj ${label}`}
      className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/55 hover:text-foreground md:size-7"
    >
      <ChevronDown
        className={cn("size-4 transition-transform", collapsed && "-rotate-90")}
      />
    </button>
  );
}

export function CollapsiblePanel({
  storageKey,
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  storageKey: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [collapsed, toggle] = useCollapsed(storageKey);

  return (
    <section className={cn("surface overflow-hidden", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 md:px-5",
          !collapsed && "border-b border-white/40",
        )}
      >
        <h2 className="panel-title">{title}</h2>
        <div className="flex items-center gap-1">
          {collapsed ? null : actions}
          <CollapseToggle collapsed={collapsed} onToggle={toggle} label={title} />
        </div>
      </div>
      {collapsed ? null : <div className={bodyClassName}>{children}</div>}
    </section>
  );
}
