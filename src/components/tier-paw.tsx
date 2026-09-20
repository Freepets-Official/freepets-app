import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { useAppStore } from '@/store/app-store';
import { TIER_COLOR_HEX, tierLook, tierName, type Gamification, type TierAnimal } from '@/data/level';

/**
 * 레벨 배지 — 색칠한 발바닥.
 *
 * 모양은 사용자가 고르고(개·고양이), **색과 투명도가 레벨을 나타낸다** — 한 색 안에서
 * 투명도 80→60→40→20→0%로 다섯 칸을 채우면 다음 색으로 넘어가고(색 7 × 5 = 35레벨),
 * 36~40은 무지개가 같은 방식으로 진해진다. 그래서 이미지 리소스가 없어도 레벨대가 읽힌다.
 *
 * 투명도 80%(불투명도 0.2) 칸은 배경에 묻히므로, 같은 색의 옅은 원을 깔아
 * "빈자리"가 아니라 "아직 덜 채워진 자리"로 보이게 한다.
 */
export function TierPaw({ gamification, size = 56 }: { gamification: Gamification; size?: number }) {
  const { settings } = useAppStore();
  // 한 화면에 배지가 여럿이면 그라데이션 id가 겹쳐 엉뚱한 색이 칠해진다
  const gradientId = `tier-paw-${useId()}`;
  // 색·투명도는 레벨 하나로 정해진다(`tierLook`) — 서버 tierColor/tierFinish를 쓰지 않는다
  const look = tierLook(gamification.level);
  const fill = look.rainbow ? `url(#${gradientId})` : TIER_COLOR_HEX[look.color ?? 'RED'];
  const rainbow = look.rainbow;
  const opacity = look.opacity;
  // 사용자가 퀘스트 화면에서 고른 발바닥이 서버의 레벨 기반 값보다 우선한다
  const animal = settings.pawAnimal || gamification.tierAnimal;

  return (
    <View accessibilityLabel={tierName(gamification, animal)} accessible>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={TIER_COLOR_HEX.RED} />
            <Stop offset="0.17" stopColor={TIER_COLOR_HEX.ORANGE} />
            <Stop offset="0.34" stopColor={TIER_COLOR_HEX.YELLOW} />
            <Stop offset="0.5" stopColor={TIER_COLOR_HEX.GREEN} />
            <Stop offset="0.66" stopColor={TIER_COLOR_HEX.BLUE} />
            <Stop offset="0.83" stopColor={TIER_COLOR_HEX.INDIGO} />
            <Stop offset="1" stopColor={TIER_COLOR_HEX.VIOLET} />
          </LinearGradient>
        </Defs>

        {/* 바탕 원 — 흐릿한 단계에서도 배지 자리가 보이게 */}
        <Circle cx="32" cy="32" r="30" fill={fill} opacity={rainbow ? 0.16 : 0.1} />
        {/* 완전히 선명해진 칸(투명도 0%)은 테두리까지 채워 "이 색을 다 모았다"가 보이게 한다 */}
        {look.transparency === 0 && (
          <Circle cx="32" cy="32" r="29" fill="none" stroke={fill} strokeWidth={2} opacity={0.9} />
        )}

        <G opacity={opacity}>{pawPaths(animal, fill)}</G>

        {/* 마지막 두 칸(투명도 20%·0%)부터 붙는 작은 광택점 — 같은 색에 디테일만 쌓이는 결 */}
        {look.transparency <= 20 && (
          <G opacity={0.9}>
            <Circle cx="50" cy="14" r="2.4" fill={fill} />
            <Circle cx="56" cy="21" r="1.4" fill={fill} />
            <Circle cx="11" cy="46" r="1.6" fill={fill} />
          </G>
        )}
      </Svg>
    </View>
  );
}

/** 발바닥 모양만. 색·불투명도는 부르는 쪽이 정한다(선택 화면은 티어와 무관하게 쓴다) */
export function PawGlyph({ animal, fill, size = 56, opacity = 1 }: { animal: TierAnimal; fill: string; size?: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G opacity={opacity}>{pawPaths(animal, fill)}</G>
    </Svg>
  );
}

/** 개·고양이 발 모양 — 개는 발가락이 길쭉하고 바닥이 하트에 가깝다, 고양이는 작고 둥글다 */
function pawPaths(animal: TierAnimal, fill: string) {
  if (animal === 'CAT') {
    return (
      <>
        <Ellipse cx="20.5" cy="27" rx="5" ry="6" fill={fill} />
        <Ellipse cx="28.5" cy="21.5" rx="5.2" ry="6.2" fill={fill} />
        <Ellipse cx="37.5" cy="21.5" rx="5.2" ry="6.2" fill={fill} />
        <Ellipse cx="45" cy="27" rx="5" ry="6" fill={fill} />
        <Ellipse cx="32.5" cy="41" rx="12.5" ry="10.5" fill={fill} />
      </>
    );
  }
  return (
    <>
      <Ellipse cx="17.5" cy="29" rx="5.6" ry="7.4" fill={fill} transform="rotate(-18 17.5 29)" />
      <Ellipse cx="27" cy="20.5" rx="5.8" ry="7.8" fill={fill} transform="rotate(-7 27 20.5)" />
      <Ellipse cx="38" cy="20.5" rx="5.8" ry="7.8" fill={fill} transform="rotate(7 38 20.5)" />
      <Ellipse cx="47.5" cy="29" rx="5.6" ry="7.4" fill={fill} transform="rotate(18 47.5 29)" />
      <Path
        d="M32.5 52c-7.6 0-13.5-4.6-13.5-10.6 0-5.2 4.6-8.4 8.4-10.7 2.2-1.3 3.8-2.9 5.1-2.9s2.9 1.6 5.1 2.9c3.8 2.3 8.4 5.5 8.4 10.7C46 47.4 40.1 52 32.5 52z"
        fill={fill}
      />
    </>
  );
}

/**
 * 랭킹 줄에 붙는 작은 티어 점.
 *
 * 남의 줄에는 발바닥을 그리지 않는다 — 개·고양이는 **그 사람이 고른 모양**이라 내 설정으로
 * 대신 그리면 거짓말이 된다. 색과 투명도만 보여주면 레벨대는 그대로 읽힌다.
 *
 * 색을 서버의 `tierColor`가 아니라 `tierLook(level)`에서 뽑는 이유: 배지·명함이 전부 레벨로
 * 계산하는데 여기만 서버 값을 쓰면 같은 사람이 화면마다 다른 색으로 보인다.
 */
export function TierDot({ level, size = 10 }: { level: number; size?: number }) {
  const gradientId = `tier-dot-${useId()}`;
  const look = tierLook(level);
  const fill = look.rainbow ? `url(#${gradientId})` : TIER_COLOR_HEX[look.color ?? 'RED'];
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={TIER_COLOR_HEX.RED} />
          <Stop offset="0.17" stopColor={TIER_COLOR_HEX.ORANGE} />
          <Stop offset="0.34" stopColor={TIER_COLOR_HEX.YELLOW} />
          <Stop offset="0.5" stopColor={TIER_COLOR_HEX.GREEN} />
          <Stop offset="0.66" stopColor={TIER_COLOR_HEX.BLUE} />
          <Stop offset="0.83" stopColor={TIER_COLOR_HEX.INDIGO} />
          <Stop offset="1" stopColor={TIER_COLOR_HEX.VIOLET} />
        </LinearGradient>
      </Defs>
      {/* 투명도 80% 칸은 점이 거의 안 보인다 — 옅은 바탕을 깔아 자리는 남긴다 */}
      <Circle cx="5" cy="5" r="5" fill={fill} opacity={0.18} />
      <Circle cx="5" cy="5" r="5" fill={fill} opacity={look.opacity} />
    </Svg>
  );
}
