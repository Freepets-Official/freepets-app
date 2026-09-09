import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius } from '@/constants/theme';
import type { SocialProvider } from '@/lib/api';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * 소셜 로그인 버튼. 한국 앱 표준 조합: 카카오(1순위) · 네이버 · Apple(iOS 심사 대비) · Google.
 *
 * 아직 붙지 않은 제공자는 **버튼을 감춘다.** 눌러도 안 되는 버튼을 남겨두면 사용자는
 * 앱이 고장난 줄 알고, 검수 캡처에도 동작하지 않는 버튼이 찍힌다.
 * 애플은 안드로이드용 SDK가 없어 iOS에서만 노출한다.
 */
const PROVIDERS: {
  key: SocialProvider;
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

export function SocialButtons({
  onPress,
  available,
  pending,
}: {
  onPress: (key: SocialProvider) => void;
  /** 지금 실제로 동작하는 제공자만 그린다 */
  available: (key: SocialProvider) => boolean;
  pending?: SocialProvider | null;
}) {
  const shown = PROVIDERS.filter(
    (pv) => available(pv.key) && (pv.key !== 'apple' || Platform.OS === 'ios'),
  );
  if (shown.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {shown.map((pv) => (
        <Pressable
          key={pv.key}
          onPress={() => onPress(pv.key)}
          disabled={pending != null}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: pv.bg, opacity: pressed || pending != null ? 0.9 : 1 },
            pv.border ? { borderWidth: 1, borderColor: pv.border } : null,
          ]}>
          <View style={styles.mark}>
            {pending === pv.key ? (
              <ActivityIndicator size="small" color={pv.fg} />
            ) : pv.ionicon ? (
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
