import { useMemo, useState, type MouseEvent } from "react";
import { Pin, X } from "@/icons";
import { cn } from "@plane/utils";
import {
  CANVAS_SKILLS,
  SKILL_CATEGORIES,
  skillMatchesCategory,
  type CanvasSkillDef,
  type SkillCategory,
} from "../skills/registry";

const PIN_KEY = "formscape.canvas.pinned.skills";

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return CANVAS_SKILLS.filter((s) => s.popular).map((s) => s.id).slice(0, 4);
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function savePinned(ids: string[]) {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify(ids.slice(0, 4)));
  } catch {
    /* ignore */
  }
}

type CatKey = SkillCategory | "all" | "fav";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (skill: CanvasSkillDef) => void;
};

export function SkillsStrip({ open, onClose, onPick }: Props) {
  const [cat, setCat] = useState<CatKey>("all");
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    return CANVAS_SKILLS.filter((s) => {
      if (cat === "fav") return pinned.includes(s.id);
      if (!skillMatchesCategory(s, cat)) return false;
      if (q && !s.name.includes(q) && !s.desc.includes(q)) return false;
      return true;
    });
  }, [cat, q, pinned]);

  const togglePin = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4);
      savePinned(next);
      return next;
    });
  };

  if (!open) return null;

  const pinnedSkills = pinned.map((id) => CANVAS_SKILLS.find((s) => s.id === id)).filter(Boolean) as CanvasSkillDef[];

  return (
    <div className="w-full">
      <div className="rounded-lg border border-subtle bg-surface-1 p-2.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <span className="mr-1 text-11 font-semibold text-primary">技能库</span>
            {SKILL_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCat(c.key)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                  cat === c.key
                    ? "bg-accent-subtle text-accent-primary"
                    : "text-secondary hover:bg-layer-transparent-hover"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索技能…"
              className="w-28 rounded-md border border-subtle bg-surface-1 px-2 py-1 text-11 text-primary outline-none placeholder:text-placeholder focus:border-accent-primary sm:w-36"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-tertiary hover:bg-layer-transparent-hover"
              aria-label="关闭技能条"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {pinnedSkills.length > 0 && cat === "all" && (
          <div className="mb-2 flex flex-wrap gap-1.5 border-b border-subtle pb-2">
            {pinnedSkills.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className="inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-2 px-2 py-1 text-11 text-primary hover:border-accent-primary"
              >
                <span
                  className="size-3 rounded-sm"
                  style={{ background: `linear-gradient(135deg, ${s.colors.join(",")})` }}
                />
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s)}
              className="group relative flex flex-col overflow-hidden rounded-md border border-subtle text-left hover:border-accent-primary"
            >
              <div
                className="h-16 w-full"
                style={{ background: `linear-gradient(135deg, ${s.colors.join(",")})` }}
              />
              <div className="flex items-start justify-between gap-1 p-1.5">
                <div className="min-w-0">
                  <div className="truncate text-11 font-medium text-primary">{s.name}</div>
                  <div className="line-clamp-1 text-[10px] text-tertiary">{s.desc}</div>
                </div>
                <button
                  type="button"
                  title="固定到顶栏"
                  onClick={(e) => togglePin(s.id, e)}
                  className={cn(
                    "shrink-0 rounded p-0.5",
                    pinned.includes(s.id)
                      ? "text-accent-primary"
                      : "text-placeholder opacity-0 group-hover:opacity-100"
                  )}
                >
                  <Pin className="size-3" />
                </button>
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <div className="col-span-full py-6 text-center text-11 text-tertiary">无匹配技能</div>
          )}
        </div>
      </div>
    </div>
  );
}
