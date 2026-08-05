import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export default function ProfileEditScreen() {
  const p = usePalette();
  const router = useRouter();
  const { account, updateAccount, session } = useAppStore();

  const [nickname, setNickname] = useState(account.nickname);
  const [avatarUri, setAvatarUri] = useState<string | null>(account.avatarUri);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const save = () => {
    if (!nickname.trim()) return setError('닉네임을 입력해 주세요');
    updateAccount({ nickname: nickname.trim(), avatarUri });
    router.back();
  };

  const initial = nickname.trim()[0] ?? '나';

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '프로필 관리', headerBackButtonDisplayMode: 'minimal' }} />
      <View style={styles.inner}>
        {/* 아바타 */}
        <Pressable onPress={pickPhoto} style={styles.avatarPick}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: p.accentSoft }]}>
              <Text style={[styles.avatarInitial, { color: p.accent }]}>{initial}</Text>
            </View>
          )}
          <View style={[styles.camBadge, { backgroundColor: p.accent, borderColor: p.bg }]}>
            <Ionicons name="camera" size={14} color={p.onAccent} />
          </View>
        </Pressable>
        <Text style={[styles.photoHint, { color: p.muted }]}>사진을 눌러 변경</Text>

        {/* 닉네임 */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: p.ink }]}>닉네임</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="닉네임"
            placeholderTextColor={p.muted}
            maxLength={20}
            style={[styles.input, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]}
          />
          <Text style={[styles.fieldHint, { color: p.muted }]}>리뷰·제보에 표시되는 이름이에요.</Text>
        </View>

        {/* 이메일 (읽기 전용) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: p.ink }]}>이메일</Text>
          <View style={[styles.readonly, { backgroundColor: p.surface, borderColor: p.line }]}>
            <Text style={[styles.readonlyText, { color: p.muted }]}>
              {session.email ?? 'guest@freepets.app'}
            </Text>
            <Ionicons name="lock-closed" size={14} color={p.muted} />
          </View>
        </View>

        {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

        <Pressable
          onPress={save}
          style={({ pressed }) => [styles.save, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
          <Text style={[styles.saveText, { color: p.onAccent }]}>저장하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
    alignItems: 'stretch',
  },
  avatarPick: { alignSelf: 'center' },
  avatar: { width: 96, height: 96, borderRadius: Radius.full },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: '900' },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { fontSize: 12.5, textAlign: 'center', marginTop: -6 },
  field: { gap: 7 },
  label: { fontSize: 14, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    fontSize: 15,
  },
  fieldHint: { fontSize: 11.5, lineHeight: 16 },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
  },
  readonlyText: { fontSize: 14.5 },
  error: { fontSize: 13, fontWeight: '700' },
  save: {
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingVertical: 15,
    marginTop: Spacing.sm,
  },
  saveText: { fontSize: 15.5, fontWeight: '800' },
});
