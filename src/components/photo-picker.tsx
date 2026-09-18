import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 사진 한 장 첨부 — 촬영 또는 앨범. 사업자등록증·리뷰 인증샷이 같은 동작을 쓴다.
 *
 * `exif: false`로 위치 메타데이터를 떼고 보낸다 — 집 좌표가 박힌 사진이 서버·화면에 남으면 안 된다.
 * 권한을 거절하면 조용히 돌아온다(시스템이 이미 안내했고, 여기서 또 띄우면 이중 알림이 된다).
 */
export function PhotoPicker({
  uri,
  onChange,
  height = 180,
  cameraLabel = '촬영',
  libraryLabel = '앨범에서',
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
  height?: number;
  cameraLabel?: string;
  libraryLabel?: string;
}) {
  const p = usePalette();

  const pick = async (from: 'camera' | 'library') => {
    const perm =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  };

  if (uri) {
    return (
      <View style={[styles.preview, { borderColor: p.line, height }]}>
        <Image source={{ uri }} style={styles.image} contentFit="cover" />
        <Pressable onPress={() => onChange(null)} style={[styles.remove, { backgroundColor: p.ink }]} hitSlop={6} accessibilityLabel="사진 지우기">
          <Ionicons name="close" size={14} color={p.bg} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.buttons}>
      <Pressable onPress={() => void pick('camera')} style={({ pressed }) => [styles.btn, { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card }]}>
        <Ionicons name="camera-outline" size={18} color={p.accent} />
        <Text style={[styles.btnText, { color: p.ink }]}>{cameraLabel}</Text>
      </Pressable>
      <Pressable onPress={() => void pick('library')} style={({ pressed }) => [styles.btn, { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card }]}>
        <Ionicons name="images-outline" size={18} color={p.accent} />
        <Text style={[styles.btnText, { color: p.ink }]}>{libraryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12 },
  btnText: { fontSize: 13.5, fontWeight: '700' },
  preview: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
