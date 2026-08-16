import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

const LOGO = require('../../assets/images/logo-paw.png');

/**
 * 브랜드 로고 마크 — 분홍 라운드 스퀘어 안의 강아지·고양이 손그림(앱 아이콘과 동일).
 * 로그인·회원가입 등에서 공통으로 쓴다. 가로로 넓은 그림이라 배지를 넉넉히 채운다.
 */
export function AppLogo({ size = 64 }: { size?: number }) {
  const p = usePalette();
  const radius = size <= 40 ? Radius.md : Radius.lg;
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: radius, backgroundColor: p.accentSoft },
      ]}>
      <Image source={LOGO} style={{ width: size * 0.86, height: size * 0.86 }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
