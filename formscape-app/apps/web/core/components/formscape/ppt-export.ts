export type ExportSlideModel = {
  id: string;
  title: string;
  bullets: string[];
  images?: string[];
  accent?: boolean;
};

type ExportDeckInput = {
  projectName: string;
  templateName: string;
  slides: ExportSlideModel[];
};

const COLORS = {
  ink: "172033",
  muted: "667085",
  brand: "5B5BD6",
  brandSoft: "EEEEFF",
  line: "E5E7EB",
  paper: "FAFAFC",
  white: "FFFFFF",
};

async function imageAsData(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 生成标准 16:9、文字与图片都可继续编辑的真实 PPTX。 */
export async function buildProjectPptx(input: ExportDeckInput): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "构境AI";
  pptx.company = "构境工作室";
  pptx.subject = input.templateName;
  pptx.title = `${input.projectName} · ${input.templateName}`;
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
  };

  for (const [index, model] of input.slides.entries()) {
    const slide = pptx.addSlide();
    const isDark = index === 0 || (index > 0 && Boolean(model.accent));
    slide.background = { color: isDark ? COLORS.ink : COLORS.paper };
    const imageData = (await Promise.all((model.images ?? []).slice(0, index === 0 ? 1 : 3).map(imageAsData))).filter(
      (data): data is string => Boolean(data)
    );

    if (index === 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 0.18,
        h: 7.5,
        line: { color: COLORS.brand, transparency: 100 },
        fill: { color: COLORS.brand },
      });
      slide.addText(input.templateName, {
        x: 0.8,
        y: 0.72,
        w: 5.4,
        h: 0.35,
        fontFace: "Microsoft YaHei",
        fontSize: 16,
        bold: true,
        color: "B8B8FF",
        margin: 0,
        breakLine: false,
      });
      slide.addText(model.title, {
        x: 0.8,
        y: 1.55,
        w: imageData.length ? 5.7 : 11.7,
        h: 1.55,
        fontFace: "Microsoft YaHei",
        fontSize: 50,
        bold: true,
        color: COLORS.white,
        margin: 0,
        breakLine: false,
        fit: "shrink",
      });
      slide.addText(model.bullets.filter(Boolean).slice(0, 2).join("\n"), {
        x: 0.82,
        y: 3.35,
        w: imageData.length ? 5.2 : 9.8,
        h: 1.1,
        fontFace: "Microsoft YaHei",
        fontSize: 20,
        color: "D0D5DD",
        breakLine: false,
        margin: 0,
      });
      if (imageData[0]) {
        slide.addImage({
          data: imageData[0],
          x: 7.1,
          y: 0.75,
          w: 5.45,
          h: 6,
          sizing: { type: "cover", w: 5.45, h: 6 },
          altText: `${input.projectName} 项目成果`,
        });
      }
    } else {
      slide.addText(model.title, {
        x: 0.75,
        y: 0.55,
        w: 11.8,
        h: 0.65,
        fontFace: "Microsoft YaHei",
        fontSize: 35,
        bold: true,
        color: isDark ? COLORS.white : COLORS.ink,
        margin: 0,
        breakLine: false,
        fit: "shrink",
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.75,
        y: 1.42,
        w: model.accent ? 2.25 : 1.1,
        h: 0,
        line: { color: model.accent ? "8585FF" : COLORS.line, width: 2.5 },
      });

      const bullets = model.bullets.filter(Boolean).slice(0, 6);
      if (imageData.length === 0 && model.accent) {
        const [lead, ...details] = bullets;
        slide.addText(lead ?? "", {
          x: 0.85,
          y: 2.15,
          w: 7.8,
          h: 1.25,
          fontFace: "Microsoft YaHei",
          fontSize: 29,
          bold: true,
          color: COLORS.white,
          breakLine: false,
          fit: "shrink",
          margin: 0,
        });
        slide.addText(details.map((bullet) => `•  ${bullet}`).join("\n"), {
          x: 0.9,
          y: 3.7,
          w: 7.6,
          h: 1.8,
          fontFace: "Microsoft YaHei",
          fontSize: 18,
          color: "D0D5DD",
          breakLine: false,
          margin: 0,
          paraSpaceAfter: 16,
        });
      } else {
        slide.addText(bullets.map((bullet) => `•  ${bullet}`).join("\n"), {
          x: 0.85,
          y: 1.9,
          w: imageData.length ? 4.55 : 7.65,
          h: 4.6,
          fontFace: "Microsoft YaHei",
          fontSize: imageData.length ? 18 : 21,
          color: COLORS.muted,
          breakLine: false,
          margin: 0.04,
          valign: "middle",
          paraSpaceAfter: 16,
        });
      }

      if (imageData.length === 0) {
        slide.addText(String(index + 1).padStart(2, "0"), {
          x: 8.8,
          y: 1.8,
          w: 3.6,
          h: 3,
          fontFace: "Microsoft YaHei",
          fontSize: 104,
          bold: true,
          color: isDark ? "303A54" : "EAECF2",
          align: "right",
          margin: 0,
          breakLine: false,
        });
        slide.addText(model.accent ? "DECISION" : "PROJECT UPDATE", {
          x: 9.55,
          y: 5.35,
          w: 2.85,
          h: 0.3,
          fontFace: "Aptos",
          fontSize: 11,
          bold: true,
          color: isDark ? "8585FF" : COLORS.brand,
          charSpacing: 2,
          align: "right",
          margin: 0,
          breakLine: false,
        });
      }

      if (imageData.length === 1) {
        slide.addImage({
          data: imageData[0],
          x: 5.75,
          y: 1.72,
          w: 6.75,
          h: 4.95,
          sizing: { type: "cover", w: 6.75, h: 4.95 },
          altText: `${model.title} 项目成果`,
        });
      } else if (imageData.length > 1) {
        const gap = 0.16;
        const width = (6.75 - gap * (imageData.length - 1)) / imageData.length;
        imageData.forEach((data, imageIndex) => {
          slide.addImage({
            data,
            x: 5.75 + imageIndex * (width + gap),
            y: 1.72,
            w: width,
            h: 4.95,
            sizing: { type: "cover", w: width, h: 4.95 },
            altText: `${model.title} 项目成果 ${imageIndex + 1}`,
          });
        });
      }
    }

    slide.addText(`${String(index + 1).padStart(2, "0")}  ·  构境AI`, {
      x: 10.9,
      y: 7.05,
      w: 1.65,
      h: 0.2,
      fontFace: "Microsoft YaHei",
      fontSize: 9,
      color: "98A2B3",
      align: "right",
      margin: 0,
      breakLine: false,
    });
    slide.addNotes(`[Sources]\n- 构境AI 项目业务数据与项目内成果资产`);
  }

  const output = await pptx.write({ outputType: "blob", compression: true });
  if (!(output instanceof Blob)) throw new Error("PPTX 生成失败");
  return output;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
