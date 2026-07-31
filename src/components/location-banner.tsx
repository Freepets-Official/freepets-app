import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

type Status = 'undetermined' | 'loading' | 'granted' | 'denied';

/**
 * 위치 권한 요청 UX — 권한만 받아둔다. 실제 거리 정렬은 관광공사 데이터(위경도)가
 * 붙는 백엔드 연동 때 `GET /facilities/nearby(lat,lng,radius)`로 채운다.
 * 지금은 목데이터라 허용해도 목록은 강릉역 기준 그대로.
 */
export function LocationBanner() {
  const p = usePalette();
  const [status, setStatus] = useState<Status>('undetermined');

  useEffect(() => {
    let mounted = true;
    Location.getForegroundPermissionsAsync()
      .then((r) => {
        if (!mounted) return;
        setStatus(r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied');
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const request = async () => {
    setStatus('loading');
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      setStatus(r.granted ? 'granted' : 'denied');
    } catch {
      setStatus('denied');
    }
  };

  if (status === 'granted') {
    return (
      <View style={[styles.banner, { backgroundColor: p.successSoft, borderColor: p.success }]}>
        <Ionicons name="location" size={16} color={p.success} />
        <Text style={[styles.note, { color: p.ink }]}>
          위치 허용됨 — 실제 거리순 정렬은 데이터 연동 후 적용돼요
        </Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={[styles.banner, { backgroundColor: p.surface, borderColor: p.line }]}>
        <Ionicons name="location-outline" size={16} color={p.muted} />
        <Text style={[styles.note, { color: p.muted }]}>
          위치 권한이 꺼져 있어요. 기기 설정에서 허용하면 내 주변 순으로 볼 수 있어요.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={request}
      disabled={status === 'loading'}
      style={({ pressed }) => [
        styles.banner,
        { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : p.card },
      ]}>
      <View style={[styles.icon, { backgroundColor: p.accentSoft }]}>
        <Ionicons name="navigate" size={16} color={p.accent} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: p.ink }]}>내 위치로 주변 시설 보기</Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          {status === 'loading' ? '권한 요청 중…' : '위치를 허용하면 내 주변 순으로 정렬돼요'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 12, lineHeight: 16 },
  note: { fontSize: 12.5, fontWeight: '600', lineHeight: 17, flexShrink: 1 },
});
