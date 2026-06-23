'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronRight, Pin, PinOff, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;  // 1-6
  offsetTop: number;  // 在内容中的纵向位置比例 (0-1)
}

interface TocSliderProps {
  content: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
}

export default function TocSlider({ content, previewRef }: TocSliderProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0); // 0-100
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
      charOffset += line.length + 1; // +1 for \n
    }
    setTocItems(items);
  }, [content]);

  // 监听预览区域滚动，更新当前激活的标题和滑块位置
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const handleScroll = () => {
      if (dragging) return;
      const scrollRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
      setSliderPosition(Math.min(100, Math.max(0, scrollRatio * 100)));

      // 找到当前滚动位置对应的标题
      const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let currentId = '';
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i] as HTMLElement;
        // 使用 getBoundingClientRect 精确计算相对于滚动容器的位置
        const headingRect = heading.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        const relativeTop = headingRect.top - previewRect.top + preview.scrollTop;
        if (relativeTop <= preview.scrollTop + 100) {
          currentId = tocItems[i]?.id || '';
        }
      }
      setActiveId(currentId);
    };

    preview.addEventListener('scroll', handleScroll, { passive: true });
    return () => preview.removeEventListener('scroll', handleScroll);
  }, [previewRef, tocItems, dragging]);

  // 计算元素相对于滚动容器的偏移量
  const getOffsetRelativeToContainer = useCallback((el: HTMLElement, container: HTMLElement): number => {
    let offset = 0;
    let current: HTMLElement | null = el;
    while (current && current !== container) {
      offset += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }
    return offset;
  }, []);

  // 点击目录项：跳转到对应位置
  const scrollToItem = useCallback((item: TocItem) => {
    const preview = previewRef.current;
    if (!preview) return;

    // 查找对应的 heading 元素
    const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const idx = tocItems.indexOf(item);
    if (idx >= 0 && idx < headings.length) {
      const heading = headings[idx] as HTMLElement;
      const targetOffset = getOffsetRelativeToContainer(heading, preview);
      preview.scrollTo({ top: targetOffset - 20, behavior: 'smooth' });
    } else {
      // 备用：按比例滚动
      const targetScroll = item.offsetTop * (preview.scrollHeight - preview.clientHeight);
      preview.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
    setActiveId(item.id);
  }, [previewRef, tocItems, getOffsetRelativeToContainer]);

  // 滑块拖拽处理
  const handleSliderDrag = useCallback((clientY: number) => {
    const track = sliderTrackRef.current;
    const preview = previewRef.current;
    if (!track || !preview) return;

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setSliderPosition(ratio * 100);

    // 滚动预览区
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  }, [previewRef]);

  // 鼠标拖拽事件
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

  // 点击轨道跳转
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    handleSliderDrag(e.clientY);
  }, [handleSliderDrag]);

  // 目录为空时不显示
  const isVisible = tocItems.length > 0;
  const showPanel = pinned || hovered || dragging;

  // 计算每个标题在轨道上的位置
  const itemPositions = useMemo(() => {
    return tocItems.map(item => ({
      ...item,
      top: item.offsetTop * 100,
    }));
  }, [tocItems]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute top-0 right-0 h-full z-40 flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 触发区域 - 始终可见的小条 */}
      <div className={cn(
        'absolute right-0 top-0 h-full w-6 flex items-start justify-center pt-3 transition-opacity',
        showPanel ? 'opacity-0' : 'opacity-100'
      )}>
        <div className="flex flex-col items-center gap-1">
          <List className="w-3.5 h-3.5 text-gray-400" />
          <div className="w-1 rounded-full bg-gray-300" style={{ height: '60px' }} />
        </div>
      </div>

      {/* 展开的目录面板 */}
      <div className={cn(
        'transition-all duration-200 overflow-hidden flex',
        showPanel ? 'w-64 opacity-100' : 'w-0 opacity-0'
      )}>
        <div className="w-64 h-full flex bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-lg">
          {/* 左侧：迷你地图滑块 */}
          <div className="w-8 flex flex-col items-center py-3 bg-gray-50 border-r border-gray-100">
            <div
              ref={sliderTrackRef}
              className="relative flex-1 w-2 bg-gray-200 rounded-full cursor-pointer"
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
                    height: item.level <= 2 ? '4px' : '2px',
                  }}
                />
              ))}
              {/* 滑块手柄 */}
              <div
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-colors',
                  dragging
                    ? 'bg-blue-500 border-blue-600 scale-125'
                    : 'bg-white border-blue-400 hover:border-blue-500 hover:scale-110'
                )}
                style={{ top: `calc(${sliderPosition}% - 8px)` }}
              />
            </div>
          </div>

          {/* 右侧：文字目录 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">目录</span>
              <button
                onClick={() => setPinned(!pinned)}
                className={cn(
                  'p-1 rounded transition-colors',
                  pinned ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                )}
                title={pinned ? '取消固定' : '固定目录'}
              >
                {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* 目录列表 */}
            <div className="flex-1 overflow-y-auto py-2">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToItem(item)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm truncate transition-colors hover:bg-blue-50',
                    item.id === activeId
                      ? 'text-blue-600 font-medium bg-blue-50/50 border-r-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
                  title={item.text}
                >
                  <span className="flex items-center gap-1.5">
                    {item.level <= 2 && (
                      <ChevronRight className={cn(
                        'w-3 h-3 shrink-0 transition-transform',
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
      </div>
    </div>
  );
}
