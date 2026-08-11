import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';

// 로그인 상단 히어로 — 강아지·고양이·새·토끼가 풀숲에 있는 실사 배경.
// 정적인 사진에 은은한 줌(켄 번스)을 더해 생기를 준다.
const MEADOW = require('../../assets/images/login-meadow.jpg');

export function LoginScene() {
  const zoom = useSharedValue(0);

  useEffect(() => {
    zoom.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [zoom]);

  // 얼굴이 잘리지 않도록 가운데 기준 아주 약한 줌만(팬 없음). 사진은 2:1로 맞춰둠
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(zoom.value, [0, 1], [1.0, 1.04]) }],
  }));

  return (
    <View style={styles.scene}>
      <Animated.View style={[styles.fill, imgStyle]}>
        <Image source={MEADOW} style={styles.fill} contentFit="cover" transition={300} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    height: 180,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#DDEFC9',
  },
  fill: { width: '100%', height: '100%' },
});
