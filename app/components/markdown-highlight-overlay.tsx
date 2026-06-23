'use client';

import { useMemo } from 'react';

interface MarkdownHighlightOverlayProps {
  content: string;
}

/**
 * A read-only overlay that renders syntax-highlighted markdown text.
 * It sits behind/over the textarea to provide visual cues for headings, bold, etc.
 * The textarea itself is transparent for text, allowing this overlay's colors to show through.
 */
export default function MarkdownHighlightOverlay({ content }: MarkdownHighlightOverlayProps) {
  const highlighted = useMemo(() => {
    return content.split('\n').map((line, i) => {
      // Heading lines
      const headingMatch = line.match(/^(#{1,6})\s/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const colors = [
          'text-blue-300 font-bold', // H1
          'text-green-300 font-bold', // H2
          'text-yellow-300 font-semibold', // H3
          'text-purple-300 font-semibold', // H4
          'text-pink-300', // H5
          'text-orange-300', // H6
        ];
        return (
          <div key={i} className={`leading-[21px] ${colors[level - 1] || 'text-gray-300'}`}>
            <span className="text-gray-500">{headingMatch[1]} </span>
            <span>{line.slice(headingMatch[0].length)}</span>
          </div>
        );
      }

      // Blockquote
      if (line.startsWith('>')) {
        return (
          <div key={i} className="leading-[21px] text-green-400/80 italic">
            {line}
          </div>
        );
      }

      // List items
      if (/^(\s*)([-*+]|\d+\.)\s/.test(line)) {
        return (
          <div key={i} className="leading-[21px] text-gray-300">
            <span className="text-cyan-400">{line.match(/^(\s*)([-*+]|\d+\.)\s/)?.[0]}</span>
            <span>{line.slice(line.match(/^(\s*)([-*+]|\d+\.)\s/)?.[0]?.length || 0)}</span>
          </div>
        );
      }

      // Code block markers
      if (line.startsWith('```')) {
        return (
          <div key={i} className="leading-[21px] text-orange-400">
            {line}
          </div>
        );
      }

      // Horizontal rule
      if (/^(---|\*\*\*|___)$/.test(line.trim())) {
        return (
          <div key={i} className="leading-[21px] text-gray-500">
            {line}
          </div>
        );
      }

      // Normal line - render inline formatting with colors
      return (
        <div key={i} className="leading-[21px] text-gray-300">
          {line || '\u00A0'}
        </div>
      );
    });
  }, [content]);

  return (
    <div className="absolute inset-0 pointer-events-none py-3 px-3 font-mono text-sm whitespace-pre overflow-hidden">
      {highlighted}
    </div>
  );
}
