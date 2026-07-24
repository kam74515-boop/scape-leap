/**
 * 技能参数轨 — 对齐 Lovspark CanvasSkillPanel
 *
 * 结构：
 *  顶栏：工具 · 技能名
 *  上传槽：空间图 / 参考图 / 材质图（按技能 uploads 配置）
 *  画面比例：预览框 + 滑块
 *  生成数量：1–4
 *  底部：生成图像到画布
 *
 * 无自由提示词、无动态 tag 字段
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Sparkles, X } from "@/icons";
import { cn } from "@plane/utils";
import {
  buildPromptFromSkill,
  type CanvasSkillDef,
  type SkillUploadSlot,
} from "../skills/registry";
import { getMockSkillBundle } from "../skills/mock-skill-assets";

type Props = {
  skill: CanvasSkillDef | null;
  onClose: () => void;
  onGenerate: (payload: {
    skill: CanvasSkillDef;
    prompt: string;
    model: string;
    count: number;
    values: Record<string, string | number>;
  }) => void;
  busy?: boolean;
};

type UploadMap = Record<string, string[]>;

export function SkillRail({ skill, onClose, onGenerate, busy }: Props) {
  const [uploads, setUploads] = useState<UploadMap>({});
  const [aspect, setAspect] = useState("1:1");
  const [count, setCount] = useState(1);
  const activeSlotRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!skill) return;
    setAspect(skill.defaultAspect);
    setCount(skill.defaultCount);
    // Demo 全自动：打开技能时自动填入 case 示例图
    const bundle = getMockSkillBundle(skill.id);
    const inputs = bundle?.inputs?.length ? bundle.inputs : bundle?.outputs ?? [];
    if (!inputs.length) {
      setUploads({});
      return;
    }
    const next: UploadMap = {};
    let i = 0;
    for (const slot of skill.uploads) {
      if (slot.multiple) {
        const take = Math.min(slot.max ?? 3, Math.max(1, inputs.length));
        next[slot.key] = inputs.slice(0, take);
      } else {
        next[slot.key] = [inputs[i % inputs.length]];
        i += 1;
      }
    }
    setUploads(next);
  }, [skill]);

  const ratios = skill?.aspectRatios ?? ["9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9"];
  const sliderIndex = Math.max(0, ratios.indexOf(aspect));

  const canGenerate = useMemo(() => {
    if (!skill || busy) return false;
    return skill.uploads
      .filter((s) => s.required)
      .every((s) => (uploads[s.key]?.length ?? 0) > 0);
  }, [skill, uploads, busy]);

  const previewBox = useMemo(() => {
    const [w, h] = aspect.split(":").map(Number);
    if (!w || !h) return { width: 32, height: 32 };
    const max = 32;
    const r = w / h;
    if (r >= 1) return { width: max, height: Math.max(12, Math.round(max / r)) };
    return { width: Math.max(12, Math.round(max * r)), height: max };
  }, [aspect]);

  if (!skill) return null;

  const openPicker = (slotKey: string, multiple?: boolean) => {
    activeSlotRef.current = slotKey;
    if (fileRef.current) {
      if (multiple) fileRef.current.setAttribute("multiple", "");
      else fileRef.current.removeAttribute("multiple");
      fileRef.current.click();
    }
  };

  const onFiles = (files: FileList | null) => {
    const key = activeSlotRef.current;
    if (!key || !files?.length) return;
    const slot = skill.uploads.find((s) => s.key === key);
    if (!slot) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));
    if (!urls.length) return;

    setUploads((prev) => {
      if (slot.multiple) {
        const max = slot.max ?? 6;
        const next = [...(prev[key] ?? []), ...urls].slice(0, max);
        return { ...prev, [key]: next };
      }
      return { ...prev, [key]: [urls[0]] };
    });
    activeSlotRef.current = null;
  };

  const removeAt = (key: string, index: number) => {
    setUploads((prev) => {
      const list = [...(prev[key] ?? [])];
      list.splice(index, 1);
      return { ...prev, [key]: list };
    });
  };

  const clearSlot = (key: string) => {
    setUploads((prev) => ({ ...prev, [key]: [] }));
  };

  /** Demo：从 case 输入图填充必填/可选槽，方便一键体验 */
  const fillMockSamples = () => {
    if (!skill) return;
    const bundle = getMockSkillBundle(skill.id);
    if (!bundle) return;
    const inputs = bundle.inputs.length ? bundle.inputs : bundle.outputs;
    if (!inputs.length) return;
    const next: UploadMap = {};
    let i = 0;
    for (const slot of skill.uploads) {
      if (slot.multiple) {
        const take = Math.min(slot.max ?? 3, Math.max(1, inputs.length));
        next[slot.key] = inputs.slice(0, take);
      } else {
        next[slot.key] = [inputs[i % inputs.length]];
        i += 1;
      }
    }
    setUploads(next);
  };

  const run = () => {
    if (!canGenerate) return;
    const values: Record<string, string | number> = {
      aspect,
      count,
    };
    for (const slot of skill.uploads) {
      const list = uploads[slot.key] ?? [];
      if (list[0]) values[slot.key] = list[0];
      values[`${slot.key}_count`] = list.length;
    }
    const prompt = buildPromptFromSkill(skill, values);
    onGenerate({
      skill,
      prompt,
      model: skill.model,
      count,
      values,
    });
  };

  return (
    <aside className="fs-skill-rail" aria-label="技能参数">
      <div className="fs-csp-header">
        <div className="min-w-0 flex-1">
          <div className="fs-csp-title-sub">工具</div>
          <div className="fs-csp-title-main truncate">{skill.name}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-0.5 text-tertiary hover:bg-layer-transparent-hover"
          aria-label="关闭"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="fs-csp-body">
        {skill.uploads.map((slot) => (
          <UploadSlotBlock
            key={slot.key}
            slot={slot}
            images={uploads[slot.key] ?? []}
            onPick={() => openPicker(slot.key, slot.multiple)}
            onClear={() => clearSlot(slot.key)}
            onRemoveAt={(i) => removeAt(slot.key, i)}
          />
        ))}

        {/* 画面比例滑块 — SizeView */}
        <div className="fs-skill-section-label">画面比例</div>
        <div className="fs-skill-size-block">
          <div className="fs-skill-size-preview">
            <div className="fs-skill-size-frame" style={previewBox}>
              {aspect}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, ratios.length - 1)}
            step={1}
            value={sliderIndex}
            onChange={(e) => {
              const i = Number(e.target.value);
              const next = ratios[i];
              if (next) setAspect(next);
            }}
            className="fs-skill-size-slider"
            aria-label="画面比例"
          />
          <div className="flex justify-between px-0.5 text-[9px] text-placeholder">
            <span>竖</span>
            <span className="font-medium text-secondary">{aspect}</span>
            <span>横</span>
          </div>
        </div>

        {/* 通高占位：上传/比例在上，数量+生成贴底 */}
        <div className="fs-skill-rail-spacer" aria-hidden />
      </div>

      <div className="fs-skill-rail-foot">
        <div className="fs-skill-section-label">生成数量</div>
        <div className="fs-skill-gens-row mb-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={cn("fs-skill-gen-btn", count === n && "is-active")}
              onClick={() => setCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={run}
          className={cn("fs-skill-action", !canGenerate && "is-disabled")}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          一键生成落图
          {skill.credits != null && (
            <span className="text-[10px] font-normal opacity-70">{skill.credits} CU</span>
          )}
        </button>
        {!canGenerate && !busy && (
          <div className="mt-1 text-center text-[9px] text-placeholder">
            请先上传必填图片
            <span className="ml-0.5 font-semibold text-danger-primary">*</span>
            <button
              type="button"
              className="ml-1.5 text-accent-primary hover:underline"
              onClick={fillMockSamples}
            >
              填入示例
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </aside>
  );
}

function UploadSlotBlock({
  slot,
  images,
  onPick,
  onClear,
  onRemoveAt,
}: {
  slot: SkillUploadSlot;
  images: string[];
  onPick: () => void;
  onClear: () => void;
  onRemoveAt: (i: number) => void;
}) {
  const reqStar = slot.required ? (
    <span className="ml-0.5 text-[11px] font-semibold text-danger-primary" aria-label="必填">
      *
    </span>
  ) : null;

  if (slot.multiple) {
    const max = slot.max ?? 6;
    return (
      <div>
        <div className="fs-skill-section-label">
          <span>
            {slot.label}
            {reqStar}
          </span>
          <span className="ml-auto normal-case tracking-normal text-placeholder">
            {images.length} / {max}
          </span>
        </div>
        <div className="fs-skill-product-slots">
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="fs-skill-product-slot is-filled">
              <img src={src} alt="" />
              <button
                type="button"
                className="fs-skill-product-slot-remove"
                aria-label="移除"
                onClick={() => onRemoveAt(i)}
              >
                <X className="size-2.5" strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {images.length < max && (
            <button type="button" className="fs-skill-product-slot is-cta" onClick={onPick}>
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const src = images[0];
  return (
    <div>
      <div className="fs-skill-section-label">
        <span>
          {slot.label}
          {reqStar}
        </span>
      </div>
      <div className={cn("fs-skill-upload", src && "is-filled")}>
        {src ? (
          <>
            <img src={src} alt="" className="fs-skill-upload-thumb" />
            <button type="button" className="fs-skill-upload-remove" onClick={onClear} aria-label="移除">
              <X className="size-3" strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="fs-skill-upload-main" onClick={onPick}>
              <Plus className="size-5 text-tertiary" />
              <span>
                {slot.label}
                {reqStar}
              </span>
            </button>
            <button type="button" className="fs-skill-upload-lib" onClick={onPick}>
              <ImagePlus className="size-2.5" />
              图库
            </button>
          </>
        )}
      </div>
    </div>
  );
}
