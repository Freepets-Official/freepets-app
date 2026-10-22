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
    /* ───── 산책 ───── */
    case 'cap':
      return (
        <>
          <Path d="M-16 0 C-16 -18 14 -19 16 0 Z" fill="#4C8DF5" {...line} />
          <Path d="M12 -2 C19 -5 27 -3 29 2 C21 4 14 3 12 1 Z" fill="#3C74D0" {...line} />
          <Circle cx={-1} cy={-14} r={2.2} fill="#FFFFFF" {...line} strokeWidth={1.6} />
          <Path d="M-4 -6 L4 -6" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
        </>
      );
    case 'pouch':
      return (
        <>
          <Path d="M-4 -14 C-4 -19 4 -19 4 -14" fill="none" {...line} strokeWidth={2} />
          <Rect x={-10} y={-13} width={20} height={22} rx={7} fill="#8BC48A" {...line} />
          <Circle cx={0} cy={1} r={3} fill="#FFFFFF" stroke="none" />
          <Circle cx={-4} cy={-4} r={1.5} fill="#FFFFFF" stroke="none" />
          <Circle cx={0} cy={-6} r={1.5} fill="#FFFFFF" stroke="none" />
          <Circle cx={4} cy={-4} r={1.5} fill="#FFFFFF" stroke="none" />
        </>
      );
    case 'nametag':
      return (
        <>
          <Path d="M-24 -2 Q0 8 24 -2" fill="none" stroke="#C8553D" strokeWidth={4.5} strokeLinecap="round" />
          <Path
            d="M-9 8 C-13 4 -13 12 -9 11 L9 11 C13 12 13 4 9 8 C13 4 13 16 9 13 L-9 13 C-13 16 -13 4 -9 8 Z"
            fill="#F5C04A"
            {...line}
            strokeWidth={1.8}
          />
        </>
      );
    /* ───── 여행 ───── */
    case 'straw':
      return (
        <>
          <Path d="M-28 2 C-20 -4 20 -4 28 2 C20 7 -20 7 -28 2 Z" fill="#F2D38A" {...line} />
          <Path d="M-14 0 C-14 -16 14 -16 14 0 Z" fill="#F2D38A" {...line} />
          <Path d="M-14 -3 C-4 0 4 0 14 -3" fill="none" stroke="#E2604E" strokeWidth={3.2} />
        </>
      );
    case 'sunglasses':
      return (
        <>
          <Rect x={-26} y={-6} width={18} height={12} rx={5} fill="#2D2622" {...line} strokeWidth={2.2} />
          <Rect x={8} y={-6} width={18} height={12} rx={5} fill="#2D2622" {...line} strokeWidth={2.2} />
          <Path d="M-8 -2 Q0 -6 8 -2" fill="none" {...line} strokeWidth={2.2} />
          <Path d="M-22 -3 L-17 -3 M12 -3 L17 -3" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
        </>
      );
    case 'backpack':
      return (
        <>
          <Rect x={-12} y={-14} width={24} height={27} rx={8} fill="#6FA8DC" {...line} />
          <Path d="M-12 -6 C-6 -2 6 -2 12 -6" fill="none" {...line} strokeWidth={1.8} />
          <Rect x={-7} y={1} width={14} height={9} rx={3} fill="#5B93C7" {...line} strokeWidth={1.8} />
          <Circle cx={0} cy={-4} r={1.6} fill="#F5C04A" stroke="none" />
        </>
      );
    case 'camera':
      return (
        <>
          <Path d="M-22 -2 Q0 8 22 -2" fill="none" stroke="#2D2622" strokeWidth={2.4} strokeLinecap="round" />
          <Rect x={-10} y={3} width={20} height={14} rx={3.5} fill="#4A4A4A" {...line} />
          <Rect x={-4} y={0} width={8} height={4} rx={1.5} fill="#4A4A4A" {...line} strokeWidth={1.6} />
          <Circle cx={0} cy={10} r={4.5} fill="#9DC3E6" {...line} strokeWidth={1.8} />
          <Circle cx={6} cy={6} r={1.2} fill="#F5C04A" stroke="none" />
        </>
      );
    /* ───── 파티 ───── */
    case 'partyhat':
      return (
        <>
          <Path d="M-11 2 L0 -24 L11 2 Z" fill="#B57EDC" {...line} />
          <Path d="M-6 -9 L6 -9 M-8.5 -3 L8.5 -3" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <Circle cx={0} cy={-25} r={3.6} fill="#F27D98" {...line} strokeWidth={1.8} />
        </>
      );
    case 'heartglasses':
      return (
        <>
          <Path d="M-16 7 C-27 -1 -24 -10 -16 -5 C-8 -10 -5 -1 -16 7 Z" fill="#F27D98" {...line} strokeWidth={2.2} />
          <Path d="M16 7 C5 -1 8 -10 16 -5 C24 -10 27 -1 16 7 Z" fill="#F27D98" {...line} strokeWidth={2.2} />
          <Path d="M-8 -3 Q0 -7 8 -3" fill="none" {...line} strokeWidth={2.2} />
        </>
      );
    case 'cape':
      return (
        <>
          <Path d="M-12 -12 C-20 2 -18 18 -6 22 C2 24 10 22 15 18 C10 6 9 -4 6 -12 Z" fill="#D6342E" {...line} />
          <Path d="M-6 22 C-2 14 -2 4 -4 -8" fill="none" stroke="#B42A24" strokeWidth={2} strokeLinecap="round" />
          <Circle cx={-3} cy={-11} r={3.2} fill="#F2C14E" {...line} strokeWidth={1.6} />
        </>
      );
    /* ───── 봄 ───── */
    case 'flowercrown':
      return (
        <>
          <Path d="M-21 2 Q0 -10 21 2" fill="none" stroke="#5EA35A" strokeWidth={3} strokeLinecap="round" />
          {[
            [-17, -1, '#FFB7C9'],
            [-8, -5, '#F5C04A'],
            [1, -7, '#F59DB0'],
            [10, -5, '#FFFFFF'],
            [18, -1, '#FFB7C9'],
          ].map(([x, y, c]) => (
            <G key={`${x}`}>
              <Circle cx={x as number} cy={y as number} r={4.6} fill={c as string} {...line} strokeWidth={1.6} />
              <Circle cx={x as number} cy={y as number} r={1.5} fill="#F2A33A" stroke="none" />
            </G>
          ))}
        </>
      );
    case 'lei':
      return (
        <>
          {[-22, -15, -8, 0, 8, 15, 22].map((x, i) => (
            <Circle key={x} cx={x} cy={2 + (1 - (x / 22) ** 2) * 6} r={4.2} fill={i % 2 ? '#F5C04A' : '#F59DB0'} {...line} strokeWidth={1.5} />
          ))}
        </>
      );
    case 'butterfly':
      return (
        <>
          <Path d="M0 0 C-6 -14 -20 -16 -18 -4 C-17 2 -8 3 0 0 Z" fill="#F7B0D0" {...line} />
          <Path d="M0 0 C6 -14 20 -16 18 -4 C17 2 8 3 0 0 Z" fill="#F7B0D0" {...line} />
          <Path d="M0 0 C-5 8 -14 12 -13 4 C-12 0 -6 0 0 0 Z" fill="#FFD27A" {...line} />
          <Path d="M0 0 C5 8 14 12 13 4 C12 0 6 0 0 0 Z" fill="#FFD27A" {...line} />
          <Circle cx={-10} cy={-7} r={2} fill="#FFFFFF" stroke="none" opacity={0.8} />
          <Circle cx={10} cy={-7} r={2} fill="#FFFFFF" stroke="none" opacity={0.8} />
        </>
      );
    /* ───── 여름 ───── */
    case 'watermelon':
      return (
        <>
          <Path d="M-17 1 A17 17 0 0 1 17 1 Z" fill="#E2604E" {...line} />
          <Path d="M-17 1 L17 1" fill="none" stroke="#5EA35A" strokeWidth={4} strokeLinecap="round" />
          {[
            [-8, -6],
            [0, -10],
            [8, -6],
            [-3, -3],
            [4, -3],
          ].map(([x, y]) => (
            <Path key={`${x}${y}`} d={`M${x} ${y} l0 2.6`} stroke="#2D2622" strokeWidth={2} strokeLinecap="round" />
          ))}
        </>
      );
    case 'tube':
      return (
        <>
          <Path d="M-27 4 C-27 -6 27 -6 27 4 C27 14 -27 14 -27 4 Z" fill="#FF8FA3" {...line} />
          <Path d="M-15 4 C-15 0 15 0 15 4 C15 8 -15 8 -15 4 Z" fill="#FFF6EF" {...line} strokeWidth={1.6} />
          <Path d="M-23 -1 L-19 9 M19 -1 L23 9" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" />
        </>
      );
    case 'goggles':
      return (
        <>
          <Path d="M-28 -2 L-24 -2 M24 -2 L28 -2" fill="none" stroke="#1F9AAD" strokeWidth={3} strokeLinecap="round" />
          <Circle cx={-15} cy={0} r={9} fill="rgba(120,200,240,0.45)" stroke="#1F9AAD" strokeWidth={3} />
          <Circle cx={15} cy={0} r={9} fill="rgba(120,200,240,0.45)" stroke="#1F9AAD" strokeWidth={3} />
          <Path d="M-6 0 L6 0" fill="none" stroke="#1F9AAD" strokeWidth={3} />
          <Path d="M-19 -4 L-15 -6 M11 -4 L15 -6" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    /* ───── 가을 ───── */
    case 'acorn':
      return (
        <>
          <Path d="M-15 1 C-15 -14 15 -14 15 1 C8 4 -8 4 -15 1 Z" fill="#8B5A2B" {...line} />
          <Path d="M-9 -8 L-3 -1 M-3 -10 L3 -2 M3 -10 L9 -2 M-12 -3 L-8 1" fill="none" stroke="#6E4520" strokeWidth={1.4} />
          <Path d="M0 -12 C0 -16 2 -18 4 -19" fill="none" {...line} strokeWidth={2.4} />
        </>
      );
    case 'maplescarf':
      return (
        <>
          <Path d="M-25 -4 C-10 6 10 6 25 -4 L26 4 C10 14 -10 14 -26 4 Z" fill="#D9733E" {...line} />
          <Path d="M8 8 L13 26 L4 27 L1 10" fill="#D9733E" {...line} />
          <Path d={star(5, 8.5, 21)} fill="#F2C14E" stroke="none" />
          <Path d="M-14 3 L-14 9 M-4 5 L-4 11 M14 2 L14 8" fill="none" stroke="#B85A2A" strokeWidth={1.4} />
        </>
      );
    case 'acornbag':
      return (
        <>
          <Path d="M-11 -5 C-14 8 -8 16 0 17 C8 16 14 8 11 -5 Z" fill="#C98A4B" {...line} />
          <Path d="M-13 -5 C-13 -14 13 -14 13 -5 C6 -2 -6 -2 -13 -5 Z" fill="#8B5A2B" {...line} />
          <Path d="M0 -12 C0 -15 2 -17 4 -18" fill="none" {...line} strokeWidth={2.2} />
          <Path d="M-5 4 C-3 8 3 8 5 4" fill="none" stroke="#A86E37" strokeWidth={1.6} strokeLinecap="round" />
        </>
      );
    /* ───── 겨울 ───── */
    case 'santa':
      return (
        <>
          <Path d="M-15 0 C-12 -16 6 -24 18 -12 L12 -6 C6 -12 -4 -10 -6 0 Z" fill="#D6342E" {...line} />
          <Rect x={-19} y={-3} width={30} height={7} rx={3.5} fill="#FFFFFF" {...line} strokeWidth={1.8} />
          <Circle cx={18} cy={-12} r={4.2} fill="#FFFFFF" {...line} strokeWidth={1.8} />
        </>
      );
    case 'muffler':
      return (
        <>
          <Path d="M-25 -4 C-10 6 10 6 25 -4 L26 4 C10 14 -10 14 -26 4 Z" fill="#3C74D0" {...line} />
          <Path d="M8 8 L13 26 L4 27 L1 10" fill="#3C74D0" {...line} />
          <Path d="M-18 1 L-18 8 M-8 4 L-8 11 M2 5 L2 12 M12 3 L12 10 M5 18 L11 18" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
        </>
      );
    case 'luckybag':
      return (
        <>
          <Path d="M-11 -4 C-17 6 -13 17 0 17 C13 17 17 6 11 -4 Z" fill="#E2604E" {...line} />
          <Path d="M-8 -4 C-6 -10 -3 -12 0 -12 C3 -12 6 -10 8 -4" fill="#E2604E" {...line} strokeWidth={1.8} />
          <Path d="M-10 -4 L10 -4" fill="none" stroke="#F2C14E" strokeWidth={3} strokeLinecap="round" />
          <Circle cx={0} cy={6} r={4.5} fill="none" stroke="#F2C14E" strokeWidth={1.8} />
          <Path d="M-2 6 L2 6 M0 4 L0 8" stroke="#F2C14E" strokeWidth={1.4} />
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
    // 등 — 몸 왼쪽 위(꼬리 쪽). 배낭·망토가 어깨에 걸친 것처럼
    back: { x: 74, y: 127, r: -8, s: 0.9 },
  },
  cat: {
    head: { x: 185, y: 56, r: 0, s: 0.95 },
    neck: { x: 186, y: 113, r: 0 },
    face: { x: 184, y: 82, r: 0 },
    back: { x: 203, y: 128, r: 8, s: 0.85 },
  },
};

/**
 * 소품이 몸에 드리우는 그림자(2.5D). 모자 챙 아래·목도리 밑에 옅은 그늘을 깔아 "붙어 있는"
 * 스티커가 아니라 "쓰고 있는" 것처럼 보이게 한다. 안경은 얼굴에 바로 닿아 그림자가 없다.
 */
const SHADOW: Partial<Record<ItemId, string>> = {
  ribbon: 'M-12 4 C-4 8 6 8 12 4',
  flower: 'M-8 2 C-2 5 4 5 8 2',
  star: 'M-7 3 C-2 5 3 5 7 3',
  beret: 'M-20 3 C-6 9 12 8 22 1',
  crown: 'M-14 4 C-4 8 6 8 14 4',
  bandana: 'M-22 -1 Q0 9 22 -1',
  bowtie: 'M-12 6 Q0 10 12 6',
  bell: 'M-22 0 Q0 10 22 0',
  knit: 'M-24 2 C-10 12 10 12 24 2',
  cap: 'M-15 2 C-4 7 10 6 18 1',
  straw: 'M-26 4 C-10 11 10 11 26 4',
  partyhat: 'M-10 3 C-3 6 3 6 10 3',
  santa: 'M-17 5 C-6 10 6 10 17 5',
  watermelon: 'M-16 3 C-6 8 6 8 16 3',
  acorn: 'M-14 3 C-4 7 4 7 14 3',
  flowercrown: 'M-18 4 C-6 8 6 8 18 4',
  maplescarf: 'M-24 2 C-10 12 10 12 24 2',
  muffler: 'M-24 2 C-10 12 10 12 24 2',
  nametag: 'M-22 0 Q0 10 22 0',
  camera: 'M-10 18 C-3 21 3 21 10 18',
  backpack: 'M-12 13 C-4 17 4 17 12 13',
  acornbag: 'M-10 16 C-3 20 3 20 10 16',
  luckybag: 'M-10 16 C-3 20 3 20 10 16',
};

/** 마스코트 안에서 쓰는 소품 묶음 — 기준점으로 옮겨 그린다 */
export function AccessoryAt({ who, slot, id }: { who: 'dog' | 'cat'; slot: ItemSlot; id: ItemId }) {
  const a = ANCHORS[who][slot];
  const sh = SHADOW[id];
  return (
    <G transform={`translate(${a.x} ${a.y}) rotate(${a.r}) scale(${a.s ?? 1})`}>
      {sh ? <Path d={sh} transform="translate(0 5)" fill="none" stroke="rgba(90,55,35,0.22)" strokeWidth={6} strokeLinecap="round" /> : null}
      {accessoryShape(id)}
    </G>
  );
}

/** 소품 하나만 그린 아이콘(꾸미기 목록·상자 결과) */
export function AccessoryGlyph({ id, size = 44, dim }: { id: ItemId; size?: number; dim?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="-30 -26 60 52" opacity={dim ? 0.35 : 1}>
      {accessoryShape(id)}
    </Svg>
  );
}
