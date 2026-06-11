import { useRef, useState, useEffect, useCallback } from "react";
import { FixedSizeGrid, GridChildComponentProps } from "react-window";
import PhotoCard from "./PhotoCard";
import { Photo } from "../types";

const CELL = 168;
const GAP = 6;
const CELL_STRIDE = CELL + GAP;

type Props = {
  photos: Photo[];
  selectedId: string | null;
  onSelect: (photo: Photo) => void;
  printQueue: Record<string, number>;
  onQtyDelta: (photoId: string, delta: number) => void;
};

export default function Gallery({ photos, selectedId, onSelect, printQueue, onQtyDelta }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colCount = Math.max(1, Math.floor((size.width + GAP) / CELL_STRIDE));
  const rowCount = Math.ceil(photos.length / colCount);

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
      const idx = rowIndex * colCount + columnIndex;
      if (idx >= photos.length) return <div style={style} />;
      const photo = photos[idx];
      return (
        <div
          style={{
            ...style,
            left: (style.left as number) + GAP,
            top: (style.top as number) + GAP,
            width: CELL,
            height: CELL,
          }}
        >
          <PhotoCard
            photo={photo}
            selected={photo.id === selectedId}
            onClick={() => onSelect(photo)}
            cellSize={CELL}
            printQty={printQueue[photo.id] ?? 0}
            onQtyDelta={(delta) => onQtyDelta(photo.id, delta)}
          />
        </div>
      );
    },
    [photos, selectedId, onSelect, colCount, printQueue, onQtyDelta]
  );

  if (photos.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center text-neutral-600 text-sm"
      >
        No photos in this batch
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-neutral-900">
      {size.width > 0 && (
        <FixedSizeGrid
          columnCount={colCount}
          columnWidth={CELL_STRIDE}
          rowCount={rowCount}
          rowHeight={CELL_STRIDE}
          width={size.width}
          height={size.height}
          overscanRowCount={3}
          style={{ overflowX: "hidden" }}
        >
          {Cell}
        </FixedSizeGrid>
      )}
    </div>
  );
}
