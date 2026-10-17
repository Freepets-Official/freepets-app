import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { ItemId, ItemSlot } from '@/data/quest-journey';

/**
 * 꼬리 친구 꾸미기 소품 그림.
 *
 * 소품마다 (0,0)을 기준점으로 한 작은 그림이다. 머리 소품은 기준점이 정수리, 목 소품은 목,
 * 얼굴 소품은 두 눈 사이. 마스코트는 강아지·고양이마다 그 자리에 옮겨 붙인다(`ANCHORS`).
 * 손그림 마스코트와 어울리게 굵은 테두리 + 단색 칠만 쓴다. 소품 색은 테마와 상관없이 고정이다
 * — 리본은 다크에서도 분홍 리본이다.
 */
const INK = '#3A2D24';
const line = { stroke: INK, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const star = (r: number, cx: number, cy: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
};

export function accessoryShape(id: ItemId): ReactNode {
  switch (id) {
    case 'ribbon':
      return (
        <>
          <Path d="M0 -2 C-8 -12 -20 -10 -18 0 C-16 8 -6 5 0 -2 Z" fill="#F59DB0" {...line} />
          <Path d="M0 -2 C8 -12 20 -10 18 0 C16 8 6 5 0 -2 Z" fill="#F59DB0" {...line} />
          <Circle cx={0} cy={-2} r={4.2} fill="#F27D98" {...line} />
        </>
      );
    case 'flower':
      return (
        <>
          {[0, 72, 144, 216, 288].map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            return <Circle key={deg} cx={Math.cos(a) * 6.5} cy={-6 + Math.sin(a) * 6.5} r={5} fill="#FFB7C9" {...line} />;
          })}
          <Circle cx={0} cy={-6} r={3.6} fill="#F5C04A" {...line} />
        </>
      );
    case 'star':
      return <Path d={star(10, 0, -7)} fill="#F5C04A" {...line} />;
    case 'beret':
      return (
        <>
          <Path d="M-22 2 C-25 -13 18 -19 24 -2 C12 4 -9 5 -22 2 Z" fill="#C8553D" {...line} />
          <Path d="M3 -13 L5 -19" fill="none" {...line} />
        </>
      );
    case 'crown':
      return (
        <>
          <Path d="M-15 2 L-17 -12 L-8 -4 L0 -17 L8 -4 L17 -12 L15 2 Z" fill="#F2C14E" {...line} />
          <Circle cx={0} cy={-4} r={2} fill="#E2604E" stroke="none" />
          <Circle cx={-9} cy={-2} r={1.6} fill="#4C8DF5" stroke="none" />
          <Circle cx={9} cy={-2} r={1.6} fill="#4C8DF5" stroke="none" />
        </>
      );
    case 'bandana':
      return (
        <>
          <Path d="M-24 -3 Q0 5 24 -3 L4 18 Q0 21 -4 18 Z" fill="#E2604E" {...line} />
          {[
            [-10, 3],
            [8, 4],
            [0, 11],
          ].map(([x, y]) => (
            <Circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill="#FFFFFF" stroke="none" />
          ))}
        </>
      );
    case 'bowtie':
      return (
        <>
          <Path d="M0 2 L-14 -6 L-14 10 Z" fill="#4C8DF5" {...line} />
          <Path d="M0 2 L14 -6 L14 10 Z" fill="#4C8DF5" {...line} />
          <Rect x={-3.5} y={-2} width={7} height={8} rx={2.5} fill="#3C74D0" {...line} />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M-24 -2 Q0 8 24 -2" fill="none" stroke="#E2604E" strokeWidth={5} strokeLinecap="round" />
          <Path d="M-24 -2 Q0 8 24 -2" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
          <Circle cx={0} cy={9} r={5.5} fill="#F2C14E" {...line} />
          <Path d="M0 11 L0 14" fill="none" {...line} strokeWidth={1.6} />
        </>
      );
    case 'knit':
      return (
        <>
          <Path d="M-25 -4 C-10 6 10 6 25 -4 L26 4 C10 14 -10 14 -26 4 Z" fill="#E0A93B" {...line} />
          <Path d="M8 8 L13 26 L4 27 L1 10" fill="#E0A93B" {...line} />
          <Path d="M-14 3 L-14 9 M-4 5 L-4 11 M14 2 L14 8 M6 20 L10 20" fill="none" {...line} strokeWidth={1.4} opacity={0.6} />
        </>
      );
    case 'glasses':
      return (
        <>
          <Circle cx={-16} cy={0} r={9} fill="rgba(255,255,255,0.28)" {...line} strokeWidth={2.4} />
          <Circle cx={16} cy={0} r={9} fill="rgba(255,255,255,0.28)" {...line} strokeWidth={2.4} />
          <Path d="M-7 -1 Q0 -5 7 -1" fill="none" {...line} strokeWidth={2.4} />
        </>
      );
  }
}

/** 소품을 붙일 자리 — 마스코트 viewBox(270×172) 좌표와 기울기 */
export const ANCHORS: Record<'dog' | 'cat', Record<ItemSlot, { x: number; y: number; r: number; s?: number }>> = {
  dog: {
    head: { x: 96, y: 37, r: -8 },
    neck: { x: 90, y: 112, r: 0 },
    // 강아지 얼굴은 오른쪽으로 돌아 있어 두 눈이 비스듬하다 — 안경도 같이 기운다
    face: { x: 95, y: 73, r: -10 },
  },
  cat: {
    head: { x: 185, y: 56, r: 0, s: 0.95 },
    neck: { x: 186, y: 113, r: 0 },
    face: { x: 184, y: 82, r: 0 },
  },
};

/** 마스코트 안에서 쓰는 소품 묶음 — 기준점으로 옮겨 그린다 */
export function AccessoryAt({ who, slot, id }: { who: 'dog' | 'cat'; slot: ItemSlot; id: ItemId }) {
  const a = ANCHORS[who][slot];
  return <G transform={`translate(${a.x} ${a.y}) rotate(${a.r}) scale(${a.s ?? 1})`}>{accessoryShape(id)}</G>;
}

/** 소품 하나만 그린 아이콘(꾸미기 목록·상자 결과) */
export function AccessoryGlyph({ id, size = 44, dim }: { id: ItemId; size?: number; dim?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="-30 -26 60 52" opacity={dim ? 0.35 : 1}>
      {accessoryShape(id)}
    </Svg>
  );
}
