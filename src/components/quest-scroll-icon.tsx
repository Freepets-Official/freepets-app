import Svg, { Path, Rect } from 'react-native-svg';

/**
 * 두루마리(파피루스) 아이콘 — 홈 헤더의 퀘스트 버튼.
 *
 * Ionicons에는 두루마리가 없다. 알림 종과 나란히 놓이므로 같은 선 굵기(1.8)·둥근 끝으로
 * 그려 두 버튼이 한 세트로 보이게 한다. 위아래 말린 축 + 가운데 글줄 두 개.
 */
export function QuestScrollIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 몸통 */}
      <Rect x="5.5" y="4.5" width="13" height="15" rx="2.2" stroke={color} strokeWidth="1.8" />
      {/* 위아래 말린 축 */}
      <Path d="M4 6.2c0-1 .9-1.7 2-1.7M20 6.2c0-1-.9-1.7-2-1.7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M4 17.8c0 1 .9 1.7 2 1.7M20 17.8c0 1-.9 1.7-2 1.7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* 글줄 */}
      <Path d="M9 10h6M9 13.5h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
