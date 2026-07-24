/**
 * L2 技能库 — 对齐 Lovspark SkillsBank 卡片网格
 * - 双列瀑布 / 封面 1:1 图区 + 标题
 * - hover 切换第二封面 · 收藏星标 · NEW
 * - 一级分类：全部 / 收藏 / 出图 / 视频 / 空间 / 3D
 */
import { useMemo, useState } from "react";
import { Star } from "@/icons";
import { cn } from "@plane/utils";
import {
  CANVAS_SKILLS,
  SKILL_CATEGORIES,
  loadFavoriteSkillIds,
  skillMatchesCategory,
  toggleFavoriteSkillId,
  type CanvasSkillDef,
  type SkillCategory,
} from "../skills/registry";

type Props = {
  query?: string;
  onPickSkill: (skill: CanvasSkillDef) => void;
};

type CatKey = SkillCategory | "all" | "fav";

export function SkillsLibraryGrid({ query = "", onPickSkill }: Props) {
  const [cat, setCat] = useState<CatKey>("all");
  const [favIds, setFavIds] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadFavoriteSkillIds()
  );

  const skills = useMemo(() => {
    const qq = query.trim().toLowerCase();
    return CANVAS_SKILLS.filter((s) => {
      if (cat === "fav" && !favIds.includes(s.id)) return false;
      if (!skillMatchesCategory(s, cat)) return false;
      if (!qq) return true;
      return (
        s.name.toLowerCase().includes(qq) ||
        s.desc.toLowerCase().includes(qq) ||
        s.id.toLowerCase().includes(qq)
      );
    });
  }, [cat, query, favIds]);

  const onToggleFav = (id: string) => {
    setFavIds(toggleFavoriteSkillId(id));
  };

  return (
    <div className="w-full">
      <div
        className="mb-1.5 flex flex-nowrap items-center gap-0.5 overflow-x-auto"
        role="tablist"
        aria-label="技能分类"
      >
        {SKILL_CATEGORIES.map((c) => {
          const active = cat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCat(c.key)}
              title={c.label}
              style={{ fontSize: 10, lineHeight: "16px", height: 16, padding: "0 6px" }}
              className={cn(
                "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm font-normal transition-colors",
                active
                  ? "bg-accent-subtle text-accent-primary"
                  : "text-tertiary hover:bg-layer-transparent-hover hover:text-secondary"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {skills.length === 0 ? (
        <div className="py-10 text-center text-11 text-tertiary">
          {cat === "fav" ? "暂无收藏技能" : "无匹配技能"}
        </div>
      ) : (
        <div className="columns-2 gap-2">
          {skills.map((skill) => (
            <SkillBankCard
              key={skill.id}
              skill={skill}
              favorited={favIds.includes(skill.id)}
              onToggleFav={() => onToggleFav(skill.id)}
              onPick={() => onPickSkill(skill)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Lovspark SkillsBank card-item：图区 + 标题，悬停切图/显示收藏 */
function SkillBankCard({
  skill,
  favorited,
  onToggleFav,
  onPick,
}: {
  skill: CanvasSkillDef;
  favorited: boolean;
  onToggleFav: () => void;
  onPick: () => void;
}) {
  const cover = skill.colors;
  const hover = skill.hoverColors ?? [...skill.colors].reverse();
  const coverSrc = skill.coverSrc;
  const hoverSrc = skill.coverHoverSrc ?? skill.coverSrc;

  return (
    <button
      type="button"
      onClick={onPick}
      className="fs-skill-card mb-2 w-full break-inside-avoid text-left"
    >
      <div className="fs-skill-card-image group relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
        {/* default 封面：case 模拟图优先，否则色板 */}
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className="absolute inset-0 size-full object-cover transition-opacity duration-200 group-hover:opacity-0"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 transition-opacity duration-200 group-hover:opacity-0"
            style={{ background: `linear-gradient(145deg, ${cover.join(",")})` }}
          />
        )}
        {/* hover 封面 */}
        {hoverSrc ? (
          <img
            src={hoverSrc}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{ background: `linear-gradient(145deg, ${hover.join(",")})` }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.18),transparent_42%)]" />

        {/* 收藏星 — Lovspark star-icon */}
        <span
          role="button"
          tabIndex={0}
          title={favorited ? "取消收藏" : "收藏"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onToggleFav();
            }
          }}
          className={cn(
            "absolute left-1.5 top-1.5 z-[1] flex size-6 items-center justify-center rounded-md bg-black/50 transition-opacity",
            favorited ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <Star
            className={cn("size-3.5", favorited ? "fill-[#EBB95E] text-[#EBB95E]" : "text-white")}
            strokeWidth={2}
          />
        </span>

        {skill.isNew && (
          <span className="absolute right-1.5 top-1.5 z-[1] rounded bg-accent-primary px-1 py-px text-[8px] font-semibold text-on-color">
            NEW
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-lg bg-white/20 text-12 font-semibold text-white backdrop-blur-[2px]">
          {skill.name.slice(0, 1)}
        </div>
      </div>
      <div className="mt-1.5 truncate px-0.5 text-[11px] font-medium leading-snug text-primary">
        {skill.name}
      </div>
    </button>
  );
}
