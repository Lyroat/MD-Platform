'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronRight, Pin, PinOff, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
  offsetTop: number; // 0-1 比例
}

interface TocSliderProps {
  content: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
}

export default function TocSlider({ content, previewRef, pinned, onPinChange }: TocSliderProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  // 从 Markdown 内容解析标题
  useEffect(() => {
    const lines = content.split('\n');
    const items: TocItem[] = [];
    let charOffset = 0;
    const totalLength = content.length;

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/[#*`\[\]]/g, '').trim();
        const id = `heading-${items.length}`;
        items.push({
          id,
          text,
          level,
          offsetTop: totalLength > 0 ? charOffset / totalLength : 0,
        });
      }
      charOffset += line.length + 1;
    }
    setTocItems(items);
  }, [content]);

  // 监听预览区域滚动
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const handleScroll = () => {
      if (dragging) return;
      const maxScroll = preview.scrollHeight - preview.clientHeight;
      const scrollRatio = maxScroll > 0 ? preview.scrollTop / maxScroll : 0;
      setSliderPosition(Math.min(100, Math.max(0, scrollRatio * 100)));

      // 找到当前激活标题 - 使用 data-heading-index 属性
      let currentId = '';
      for (let i = 0; i < tocItems.length; i++) {
        const heading = preview.querySelector(`[data-heading-index="${i}"]`) as HTMLElement;
        if (!heading) continue;
        const headingRect = heading.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        const relativeTop = headingRect.top - previewRect.top;
        if (relativeTop <= 100) {
          currentId = tocItems[i].id;
        }
      }
      setActiveId(currentId);
    };

    preview.addEventListener('scroll', handleScroll, { passive: true });
    return () => preview.removeEventListener('scroll', handleScroll);
  }, [previewRef, tocItems, dragging]);

  // 点击目录项：跳转
  const scrollToItem = useCallback((item: TocItem) => {
    const preview = previewRef.current;
    if (!preview) return;

    // 使用 data-heading-index 属性精确定位
    const idx = tocItems.indexOf(item);
    const heading = preview.querySelector(`[data-heading-index="${idx}"]`) as HTMLElement;

    if (heading) {
      // 计算 heading 相对于滚动容器的精确偏移
      const headingRect = heading.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const targetScroll = preview.scrollTop + (headingRect.top - previewRect.top) - 20;
      preview.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    } else {
      // 降级：使用比例滚动
      const targetScroll = item.offsetTop * (preview.scrollHeight - preview.clientHeight);
      preview.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
    setActiveId(item.id);
  }, [previewRef, tocItems]);

  // 滑块拖拽
  const handleSliderDrag = useCallback((clientY: number) => {
    const track = sliderTrackRef.current;
    const preview = previewRef.current;
    if (!track || !preview) return;

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setSliderPosition(ratio * 100);
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  }, [previewRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    handleSliderDrag(e.clientY);

    const handleMouseMove = (e: MouseEvent) => {
      handleSliderDrag(e.clientY);
    };
    const handleMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleSliderDrag]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    handleSliderDrag(e.clientY);
  }, [handleSliderDrag]);

  const isVisible = tocItems.length > 0;
  const showPanel = pinned || hovered || dragging;

  const itemPositions = useMemo(() => {
    return tocItems.map(item => ({
      ...item,
      top: item.offsetTop * 100,
    }));
  }, [tocItems]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'shrink-0 h-full flex transition-all duration-200',
        showPanel ? 'w-56' : 'w-6'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 收起时的触发条 */}
      {!showPanel && (
        <div className="w-6 h-full flex flex-col items-center pt-3 bg-gray-50 border-l border-gray-200 cursor-pointer">
          <List className="w-3.5 h-3.5 text-gray-400 mb-2" />
          <div className="w-1 rounded-full bg-gray-300 flex-1 max-h-32" />
        </div>
      )}

      {/* 展开的目录面板 */}
      {showPanel && (
        <div className="w-56 h-full flex bg-white border-l border-gray-200">
          {/* 左侧：迷你地图滑块 */}
          <div className="w-7 flex flex-col items-center py-3 bg-gray-50 border-r border-gray-100">
            <div
              ref={sliderTrackRef}
              className="relative flex-1 w-1.5 bg-gray-200 rounded-full cursor-pointer"
              onMouseDown={handleMouseDown}
              onClick={handleTrackClick}
            >
              {/* 标题位置标记 */}
              {itemPositions.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'absolute left-0 w-full rounded-full transition-colors',
                    item.id === activeId ? 'bg-blue-500' : 'bg-gray-400'
                  )}
                  style={{
                    top: `${item.top}%`,
                    height: item.level <= 2 ? '3px' : '2px',
                  }}
                />
              ))}
              {/* 滑块手柄 */}
              <div
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-colors shadow-sm',
                  dragging
                    ? 'bg-blue-500 border-blue-600 scale-125'
                    : 'bg-white border-blue-400 hover:border-blue-500 hover:scale-110'
                )}
                style={{ top: `calc(${sliderPosition}% - 7px)` }}
              />
            </div>
          </div>

          {/* 右侧：文字目录 */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">目录</span>
              <button
                onClick={() => onPinChange(!pinned)}
                className={cn(
                  'p-1 rounded transition-colors',
                  pinned ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                )}
                title={pinned ? '取消固定' : '固定目录'}
              >
                {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* 目录列表 - 固定，不随预览内容滚动 */}
            <div className="flex-1 overflow-y-auto py-2">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToItem(item)}
                  className={cn(
                    'w-full text-left px-3 py-1 text-xs truncate transition-colors hover:bg-blue-50',
                    item.id === activeId
                      ? 'text-blue-600 font-medium bg-blue-50/50 border-r-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                  style={{ paddingLeft: `${(item.level - 1) * 10 + 12}px` }}
                  title={item.text}
                >
                  <span className="flex items-center gap-1">
                    {item.level <= 2 && (
                      <ChevronRight className={cn(
                        'w-2.5 h-2.5 shrink-0 transition-transform',
                        item.id === activeId && 'rotate-90'
                      )} />
                    )}
                    <span className="truncate">{item.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
