import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { FONT_SCALE, type FontSizeMode } from '@/data/types';

/**
 * 앱 전체 글씨 크기.
 *
 * **스토어를 직접 구독하지 않고 배율만 별도 컨텍스트로 내린다.** 스토어는 판별·리뷰 로드
 * 같은 일로 자주 바뀌는데, 모든 `Text`가 그걸 구독하면 화면 전체가 그때마다 다시 그려진다.
 * 컨텍스트 값이 숫자 하나면 배율이 실제로 바뀔 때만 리렌더된다.
 */
const FontScaleContext = createContext(1);

export function FontScaleProvider({ mode, children }: { mode: FontSizeMode; children: ReactNode }) {
  const scale = FONT_SCALE[mode] ?? 1;
  return <FontScaleContext.Provider value={scale}>{children}</FontScaleContext.Provider>;
}

export function useFontScale(): number {
  return useContext(FontScaleContext);
}

/**
 * 배율을 적용한 스타일을 만든다.
 *
 * `lineHeight`도 같이 곱한다 — 글자만 키우면 줄 간격이 그대로라 윗줄과 겹치거나 잘린다.
 * 큰 제목에 `lineHeight`를 명시해 둔 것도 같은 이유였다.
 *
 * 배율이 1이면 원본 스타일을 그대로 돌려준다. 새 객체를 만들면 `StyleSheet` 참조가 깨져
 * 매 렌더마다 스타일이 달라진 것으로 취급된다.
 */
function useScaledStyle(style: TextProps['style']): TextProps['style'] {
  const scale = useFontScale();
  return useMemo(() => {
    if (scale === 1 || !style) return style;
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    if (!flat) return style;

    const patch: TextStyle = {};
    if (typeof flat.fontSize === 'number') patch.fontSize = flat.fontSize * scale;
    if (typeof flat.lineHeight === 'number') patch.lineHeight = flat.lineHeight * scale;
    // fontSize가 없는 스타일은 RN 기본 크기(14)를 쓴다. 그대로 두면 그 텍스트만 안 커진다.
    if (patch.fontSize === undefined) patch.fontSize = 14 * scale;

    return [style, patch];
  }, [style, scale]);
}

/**
 * 앱의 기본 텍스트. `react-native`의 `Text` 대신 이걸 쓴다.
 *
 * 설정에서 고른 글씨 크기를 여기 한 곳에서 적용한다. 화면마다 배율을 곱하게 두면
 * 새로 만든 화면에서 빠뜨리고, 그 화면만 크기가 안 바뀐다.
 */
export function Text({ style, ...rest }: TextProps) {
  return <RNText style={useScaledStyle(style)} {...rest} />;
}

/**
 * 애니메이션이 걸리는 텍스트(공유 요소 전환 등). `Animated.Text`를 직접 쓰면 배율이 빠진다.
 *
 * `Animated.Text`에 스타일을 바로 넘기면 Reanimated가 그 스타일 객체를 다루므로,
 * 배율은 미리 계산해서 넣는다.
 */
const RNAnimatedText = Animated.Text;

export function AnimatedText({
  style,
  ...rest
}: React.ComponentProps<typeof RNAnimatedText>) {
  // Reanimated의 스타일 타입은 shared value를 품을 수 있어 일반 TextStyle과 맞지 않는다.
  // 여기 들어오는 건 전부 정적 스타일이라 계산에는 문제가 없다.
  const scaled = useScaledStyle(style as TextProps['style']);
  return <RNAnimatedText style={scaled as never} {...rest} />;
}
