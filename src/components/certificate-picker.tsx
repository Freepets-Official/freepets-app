import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 사업자등록증 사진 — 매장 등록 신청의 필수 첨부.
 *
 * 진위확인(번호·대표자명·개업일)은 "이 사람이 그 사업자와 관계있다"까지만 증명하고
 * "그 사업자 = 이 매장"은 증명하지 못한다. 운영자가 등록증을 보고 승인해야 남의 매장을
 * 먼저 등록해 진짜 사장을 막는 일이 없어진다(백엔드 이슈 #83). 서버가 저장하고, 앱은 올린 뒤
 * 경로를 남기지 않는다.
 */
export function CertificatePicker({ uri, onChange }: { uri: string | null; onChange: (uri: string | null) => void }) {
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
      <View style={[styles.preview, { borderColor: p.line }]}>
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
        <Text style={[styles.btnText, { color: p.ink }]}>촬영</Text>
      </Pressable>
      <Pressable onPress={() => void pick('library')} style={({ pressed }) => [styles.btn, { borderColor: p.line, backgroundColor: pressed ? p.surface : p.card }]}>
        <Ionicons name="images-outline" size={18} color={p.accent} />
        <Text style={[styles.btnText, { color: p.ink }]}>앨범에서</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12 },
  btnText: { fontSize: 13.5, fontWeight: '700' },
  preview: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', height: 180 },
  image: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
