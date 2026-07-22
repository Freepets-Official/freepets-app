import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

export interface Evidence {
  uri: string;
  /** 데모: 서버의 Claude 비전 검증 결과를 흉내 낸다 */
  aiVerified: boolean;
}

/**
 * 증거 사진 첨부 — 안내판 사진 한 장이 조건 변경을 즉시 입증한다.
 * 실제 구현에서는 업로드 시 서버가 EXIF를 제거하고, GPS는 거리 검증에만 쓰고 폐기한다.
 */
export function EvidencePicker({
  evidence,
  onChange,
}: {
  evidence: Evidence | null;
  onChange: (e: Evidence | null) => void;
}) {
  const p = usePalette();

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      onChange({ uri: result.assets[0].uri, aiVerified: true });
    }
  };

  if (evidence) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.preview, { borderColor: p.line }]}>
          <Image source={{ uri: evidence.uri }} style={styles.image} contentFit="cover" />
          <Pressable
            onPress={() => onChange(null)}
            style={[styles.remove, { backgroundColor: p.ink }]}
            hitSlop={6}>
            <Ionicons name="close" size={14} color={p.bg} />
          </Pressable>
        </View>

        {evidence.aiVerified && (
          <View style={[styles.verified, { backgroundColor: p.successSoft }]}>
            <Ionicons name="shield-checkmark" size={14} color={p.success} />
            <Text style={[styles.verifiedText, { color: p.success }]}>
              출입 안내물로 확인됐어요 · 제보 신뢰도가 올라갑니다
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={pick}
        style={({ pressed }) => [
          styles.button,
          { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
        ]}>
        <Ionicons name="camera" size={19} color={p.accent} />
        <Text style={[styles.buttonLabel, { color: p.accent }]}>안내판 사진 첨부</Text>
      </Pressable>
      <Text style={[styles.hint, { color: p.muted }]}>
        출입 조건이 적힌 안내판·입간판 사진을 올리면 더 빠르게 반영돼요. 사진은 검토용으로만
        쓰이고 다른 사용자에게 공개되지 않아요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: 16,
  },
  buttonLabel: { fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 11.5, lineHeight: 17 },
  preview: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    height: 180,
  },
  image: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  verifiedText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
