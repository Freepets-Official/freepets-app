import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * 소셜 로그인 버튼 — 데모는 UI만, 실제 OAuth는 백엔드 연동 시.
 * 한국 앱 표준 조합: 카카오(1순위) · 네이버 · Apple(iOS 심사 대비) · Google.
 */
const PROVIDERS: {
  key: string;
  label: string;
  bg: string;
  fg: string;
  border?: string;
  ionicon?: IconName;
  glyph?: string;
}[] = [
  { key: 'kakao', label: '카카오로 계속하기', bg: '#FEE500', fg: '#191600', ionicon: 'chatbubble' },
  { key: 'naver', label: '네이버로 계속하기', bg: '#03C75A', fg: '#FFFFFF', glyph: 'N' },
  { key: 'apple', label: 'Apple로 계속하기', bg: '#000000', fg: '#FFFFFF', ionicon: 'logo-apple' },
  {
    key: 'google',
    label: 'Google로 계속하기',
    bg: '#FFFFFF',
    fg: '#1F1F1F',
    border: '#E3E0E4',
    ionicon: 'logo-google',
  },
];

export function SocialButtons({ onPress }: { onPress: (key: string) => void }) {
  return (
    <View style={styles.wrap}>
      {PROVIDERS.map((pv) => (
        <Pressable
          key={pv.key}
          onPress={() => onPress(pv.key)}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: pv.bg, opacity: pressed ? 0.9 : 1 },
            pv.border ? { borderWidth: 1, borderColor: pv.border } : null,
          ]}>
          <View style={styles.mark}>
            {pv.ionicon ? (
              <Ionicons name={pv.ionicon} size={17} color={pv.fg} />
            ) : (
              <Text style={[styles.glyph, { color: pv.fg }]}>{pv.glyph}</Text>
            )}
          </View>
          <Text style={[styles.label, { color: pv.fg }]}>{pv.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  btn: {
    height: 52,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mark: { width: 22, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 17, fontWeight: '900' },
  label: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', marginLeft: -22 },
});
