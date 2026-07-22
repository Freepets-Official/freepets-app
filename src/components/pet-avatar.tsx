import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Pet } from '@/data/types';

/** petId로 고정 배정되는 파스텔 아바타 배경 */
const AVATAR_COLORS = ['#FDE1EC', '#E5EEFB', '#FDF0D9', '#E4F4EA', '#F0E7FB', '#FCE4DE'];
const AVATAR_INK = ['#D8588A', '#4E7BC0', '#B07714', '#2F8A57', '#8A5FC0', '#D06A4E'];

/** 원형 반려동물 아바타 — 사진이 있으면 사진, 없으면 이름 첫 글자 */
export function PetAvatar({ pet, size = 48 }: { pet: Pet; size?: number }) {
  const idx = (pet.petId - 1) % AVATAR_COLORS.length;

  if (pet.photoUri) {
    return (
      <Image
        source={{ uri: pet.photoUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_COLORS[idx] },
      ]}>
      <Text style={[styles.initial, { color: AVATAR_INK[idx], fontSize: size * 0.42 }]}>
        {pet.name.slice(0, 1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '900' },
});
