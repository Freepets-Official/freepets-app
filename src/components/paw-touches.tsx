import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '@/hooks/use-theme';

/**
 * 화면을 터치하면 그 자리에 강아지 발자국이 톡 찍혔다 사라지는 마이크로 인터랙션.
 * 터치를 '가로채지 않고 관찰만' 하므로(onStartShouldSetResponderCapture → false)
 * 버튼·스크롤 등 원래 동작에는 영향이 없다. 웹(마우스)·네이티브(터치) 모두 동작.
 */
const SIZE = 26;
const DURATION = 700;

type Print = { id: number; x: number; y: number; rot: number };

export function PawTouches({ children }: { children: ReactNode }) {
  const [prints, setPrints] = useState<Print[]>([]);
  const idRef = useRef(0);

  const spawn = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    if (pageX == null || pageY == null) return;
    const id = (idRef.current += 1);
    const rot = Math.random() * 44 - 22; // -22°~22° 살짝 기울여 자연스럽게
    // 동시에 너무 많이 쌓이지 않게 최근 것만 유지
    setPrints((prev) => [...prev.slice(-14), { id, x: pageX, y: pageY, rot }]);
  }, []);

  const remove = useCallback((id: number) => {
    setPrints((prev) => prev.filter((pr) => pr.id !== id));
  }, []);

  return (
    <View
      style={styles.flex}
      onStartShouldSetResponderCapture={(e) => {
        spawn(e);
        return false; // 책임(responder)을 가져가지 않음 → 버튼·스크롤 정상 동작
      }}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {prints.map((pr) => (
          <PawPrint key={pr.id} print={pr} onDone={() => remove(pr.id)} />
        ))}
      </View>
    </View>
  );
}

function PawPrint({ print, onDone }: { print: Print; onDone: () => void }) {
  const p = usePalette();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [t, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.12, 0.6, 1], [0, 0.85, 0.65, 0]),
    transform: [
      { scale: interpolate(t.value, [0, 0.2, 1], [0.4, 1, 1.3]) },
      { rotate: `${print.rot}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.print, { left: print.x - SIZE / 2, top: print.y - SIZE / 2 }, style]}>
      <Ionicons name="paw" size={SIZE} color={p.accent} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  print: { position: 'absolute', width: SIZE, height: SIZE },
});
