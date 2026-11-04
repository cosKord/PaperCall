import type { ReactNode } from "react";
import Link from "next/link";

import { BrandName } from "@/components/brand-name";
import { PageTransition } from "@/components/page-transition";

function renderBrandText(text: string): ReactNode[] {
  return text.split(/(PaperCall)/g).map((part, index) =>
    part === "PaperCall" ? <BrandName key={`brand-${index}`} /> : part,
  );
}

function renderInline(text: string): ReactNode[] {
  const expression = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const addText = (value: string) => {
    for (const part of value.split(/(PaperCall)/g)) {
      if (part === "PaperCall") {
        parts.push(<BrandName key={key++} />);
      } else if (part) {
        parts.push(part);
      }
    }
  };

  while ((match = expression.exec(text)) !== null) {
    if (match.index > cursor) {
      addText(text.slice(cursor, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={key++}>{renderBrandText(match[1])}</strong>);
    } else {
      const href = match[3] === "/privacy" ? "/privacy-policy" : match[3];
      const safeHref = /^(\/|https:\/\/|mailto:)/.test(href);
      parts.push(
        safeHref ? (
          <a key={key++} className="font-bold text-ink underline underline-offset-4" href={href}>
            {renderBrandText(match[2])}
          </a>
        ) : (
          renderBrandText(match[2])
        ),
      );
    }

    cursor = expression.lastIndex;
  }

  if (cursor < text.length) {
    addText(text.slice(cursor));
  }

  return parts;
}

function renderMarkdown(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line || line.startsWith("<!--")) {
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={index} className="mb-3 mt-10 text-2xl font-black tracking-tight first:mt-0">
          {renderInline(line.slice(3))}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (line === "---") {
      blocks.push(<hr key={index} className="my-8 border-0 border-t-2 border-ink/15" />);
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quoteLines.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(
        <blockquote key={index} className="my-6 border-2 border-ink bg-acid/30 px-5 py-4 leading-7">
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex} className="m-0">{renderInline(quoteLine)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const row = lines[index]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());
        if (!row.every((cell) => /^:?-{3,}:?$/.test(cell))) {
          rows.push(row);
        }
        index += 1;
      }
      blocks.push(
        <div key={index} className="my-6 overflow-x-auto border-2 border-ink">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {rows[0]?.map((cell, cellIndex) => (
                  <th key={cellIndex} className="border-b-2 border-ink px-4 py-3 font-black">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-paper/70">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-t border-ink/15 px-4 py-3 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={index} className="my-4 list-disc space-y-2 pl-6 leading-7 marker:text-ink-soft">
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(# |## |---$|> |\||- )/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith("<!--")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      <p key={index} className="my-4 leading-7 text-ink-soft">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  return blocks;
}

export function LegalDocument({ title, content }: { title: string; content: string }) {
  return (
    <PageTransition>
      <main className="min-h-screen bg-paper text-ink">
        <header className="flex items-center justify-between gap-4 border-b-2 border-ink px-[clamp(22px,5vw,74px)] py-5">
          <Link className="font-black no-underline" href="/"><BrandName /></Link>
          <Link className="font-bold text-ink-soft underline underline-offset-4" href="/">Back to home</Link>
        </header>
        <article className="mx-auto w-[min(760px,calc(100%-44px))] py-[clamp(56px,10vw,120px)]">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[.18em] text-ink-soft">Legal</p>
          <h1 className="mb-6 text-[clamp(2.4rem,7vw,4.5rem)] font-black leading-none tracking-tight">{title}</h1>
          <div className="[&_blockquote]:text-ink [&_h2]:text-ink [&_strong]:text-ink">
            {renderMarkdown(content)}
          </div>
        </article>
      </main>
    </PageTransition>
  );
}
