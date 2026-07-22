import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { usePalette } from '@/hooks/use-theme';

/**
 * 0.0~10.0 (소수점 1자리) 슬라이더. 네이티브·웹 모두 제스처 응답 시스템으로 동작한다.
 * 별도 슬라이더 패키지 없이 locationX만으로 값을 계산한다.
 */
export function ScoreSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(0);

  const setFromX = (x: number) => {
    if (width <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    onChange(Math.round(ratio * 100) / 10); // 0~10, 소수점 1자리
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onTouch = (e: GestureResponderEvent) => setFromX(e.nativeEvent.locationX);

  const pct = `${value * 10}%` as const;

  return (
    <View
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      style={styles.hit}>
      <View style={[styles.track, { backgroundColor: p.line }]}>
        <View style={[styles.fill, { width: pct, backgroundColor: p.accent }]} />
      </View>
      <View style={[styles.thumb, { left: pct, borderColor: p.accent, backgroundColor: p.bg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 32, justifyContent: 'center' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    marginLeft: -11,
    // 핑크 기운 그림자로 살짝 떠 보이게
    boxShadow: '0 2px 6px rgba(232, 99, 151, 0.3)',
  },
});
