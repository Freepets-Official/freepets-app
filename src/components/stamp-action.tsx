import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { hasStamp } from '@/data/stamps';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 여권 도장 찍기 (게임 요소 1단계) — 다녀온 곳에서 인증샷을 남기면 그 지역 도장이 찍힌다.
 *
 * ⚠️ **인증은 목이다.** 사진을 받되 검사하지 않고 통과시킨다. 실제 비전 판별(펫이 찍혔는지)과
 * GPS 대조는 2단계다. 지금 구조는 "허들"이지 부정 방지가 아니다 — 남의 펫 사진도, 사진을
 * 다시 찍은 것도 막지 못한다. 그 한계를 알고 데모·공모전 범위로 들인다.
 *
 * 사진 없이도 찍을 수 있게 뒀다. 인증샷을 강제하면 이미 다녀온 곳을 기록할 방법이 없어진다.
 */
export function StampAction({
  facilityId,
  facilityName,
  address,
  petIds,
}: {
  facilityId: number;
  facilityName: string;
  address: string;
  petIds: number[];
}) {
  const p = usePalette();
  const router = useRouter();
  const { stamps, stampRegions, addStamp } = useAppStore();

  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const already = hasStamp(stamps, facilityId);

  /** 사진 한 장을 받는다. 취소하면 `undefined`(찍지 않음), 사진 없이 진행하면 `null`. */
  const pickPhoto = async (): Promise<string | null | undefined> => {
    // 웹은 카메라 지원이 고르지 않아 사진첩으로 간다
    if (Platform.OS !== 'web') {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.granted) {
        const shot = await ImagePicker.launchCameraAsync({ quality: 0.6, exif: false });
        if (shot.canceled) return undefined;
        return shot.assets[0]?.uri ?? null;
      }
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // 사진 권한까지 없으면 사진 없이 도장만 찍는다 — 권한 때문에 기능이 막히면 안 된다
    if (!lib.granted) return null;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      exif: false,
    });
    if (picked.canceled) return undefined;
    return picked.assets[0]?.uri ?? null;
  };

  const stamp = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const photoUri = await pickPhoto();
      // 사용자가 창을 닫은 것은 실패가 아니다. 오류를 띄우지 않는다.
      if (photoUri === undefined) return;

      // 목 판정 — 실제로는 서버 비전 API가 들어올 자리다. 즉시 통과시키면 검사한 것처럼
      // 보이지 않아 오히려 흐름이 어색해, 확인하는 시간만큼만 기다린다.
      await new Promise((r) => setTimeout(r, 900));

      const made = addStamp({ facilityId, facilityName, address, petIds, photoUri });
      if (!made) {
        // 주소에서 지역을 못 찾았다. 억지로 추측해 엉뚱한 지역에 찍지 않는다.
        setMessage(
          stampRegions.length === 0
            ? '지역 정보를 불러오지 못해 도장을 찍지 못했어요. 잠시 후 다시 시도해 주세요.'
            : '이 시설의 주소에서 지역을 알아내지 못했어요.',
        );
        return;
      }
      setMessage(`${made.sido} ${made.sigungu} 도장을 찍었어요!`);
    } catch {
      setMessage('도장을 찍지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setRunning(false);
    }
  };

  if (already) {
    return (
      <Pressable
        onPress={() => router.push('/stamps')}
        style={({ pressed }) => [
          styles.button,
          { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card },
        ]}>
        <View style={[styles.icon, { backgroundColor: p.surface }]}>
          <Ionicons name="checkmark-circle" size={19} color={p.accent} />
        </View>
        <View style={styles.texts}>
          <Text style={[styles.title, { color: p.ink }]}>이미 도장을 찍은 곳이에요</Text>
          <Text style={[styles.body, { color: p.muted }]}>도장첩에서 모은 지역을 확인해 보세요</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.muted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={stamp}
        disabled={running}
        style={({ pressed }) => [
          styles.button,
          { borderColor: p.accent, backgroundColor: pressed ? p.accentSoft : p.card },
        ]}>
        <View style={[styles.icon, { backgroundColor: p.accentSoft }]}>
          {running ? (
            <ActivityIndicator size="small" color={p.accent} />
          ) : (
            <Ionicons name="footsteps" size={19} color={p.accent} />
          )}
        </View>
        <View style={styles.texts}>
          <Text style={[styles.title, { color: p.ink }]}>
            {running ? '인증샷을 확인하고 있어요' : '여권 도장 찍기'}
          </Text>
          <Text style={[styles.body, { color: p.muted }]}>
            인증샷을 남기면 이 지역 도장이 도장첩에 쌓여요
          </Text>
        </View>
        {!running && <Ionicons name="chevron-forward" size={18} color={p.accent} />}
      </Pressable>
      {message && <Text style={[styles.message, { color: p.muted }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg,
  },
  icon: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  texts: { flexShrink: 1, gap: 2 },
  title: { fontSize: 13.5, fontWeight: '800' },
  body: { fontSize: 11.5 },
  message: { fontSize: 11.5, paddingHorizontal: 2 },
});
