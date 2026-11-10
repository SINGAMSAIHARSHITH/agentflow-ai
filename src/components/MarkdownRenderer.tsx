import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Handle inline code `...`, bold **...**, italic *...*
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-md bg-[#F0EFED] border border-[#E8E3DF] font-mono text-[12.5px] text-[#302C29]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-[#302C29]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div
          key={`code-${i}`}
          className="my-3 rounded-xl overflow-hidden border border-[#E8E3DF] bg-[#FAF8F6]"
        >
          {lang && (
            <div className="px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#79736E] bg-[#F0EFED] border-b border-[#E8E3DF]">
              {lang}
            </div>
          )}
          <pre className="p-3.5 text-[12.5px] font-mono text-[#302C29] overflow-x-auto leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown Table
    if (
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('|') &&
      lines[i + 1].includes('---')
    ) {
      const headerCells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        rows.push(rowCells);
        i++;
      }
      elements.push(
        <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-[#E8E3DF] bg-[#FFFFFF]">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#FAF8F6] border-b border-[#E8E3DF]">
                {headerCells.map((cell, cIdx) => (
                  <th key={cIdx} className="py-2.5 px-3.5 font-semibold text-[#302C29]">
                    {renderInlineFormatting(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E3DF]">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#FAF8F6]/70 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2 px-3.5 text-[#302C29] align-top">
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-[15px] font-semibold text-[#302C29] mt-4 mb-1.5">
          {renderInlineFormatting(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-[16.5px] font-semibold text-[#302C29] mt-4 mb-2">
          {renderInlineFormatting(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-[18px] font-bold text-[#302C29] mt-4 mb-2">
          {renderInlineFormatting(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 pl-5 space-y-1.5 list-disc marker:text-[#C78A4A]">
          {items.map((item, idx) => (
            <li key={idx} className="text-[14.5px] leading-relaxed text-[#302C29]">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 pl-5 space-y-1.5 list-decimal marker:text-[#79736E] marker:font-medium">
          {items.map((item, idx) => (
            <li key={idx} className="text-[14.5px] leading-relaxed text-[#302C29]">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${i}`} className="text-[14.5px] leading-relaxed text-[#302C29] my-2">
        {renderInlineFormatting(line)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
};
