import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Chip } from '@/components/chip';
import { PetAvatar } from '@/components/pet-avatar';
import { Screen } from '@/components/screen';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { BREED_SIZE_LABEL, type BreedSize } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const BREED_SIZES = Object.keys(BREED_SIZE_LABEL) as BreedSize[];

export default function PetsScreen() {
  const p = usePalette();
  const { pets, addPet, removePet } = useAppStore();

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [weight, setWeight] = useState('');
  const [breedSize, setBreedSize] = useState<BreedSize>('SMALL');
  const [vaccinated, setVaccinated] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const submit = () => {
    const w = Number(weight);
    if (!name.trim()) return setError('이름을 입력해 주세요');
    if (!species.trim()) return setError('견종을 입력해 주세요');
    if (!weight.trim() || Number.isNaN(w) || w <= 0) return setError('체중을 숫자로 입력해 주세요 (kg)');

    addPet({
      name: name.trim(),
      species: species.trim(),
      weight: w,
      breedSize,
      vaccinated,
      vaccinationDate: vaccinated ? new Date().toISOString().slice(0, 10) : null,
      photoUri,
    });
    setName('');
    setSpecies('');
    setWeight('');
    setBreedSize('SMALL');
    setVaccinated(false);
    setPhotoUri(null);
    setError(null);
    setFormOpen(false);
  };

  return (
    <Screen
      eyebrow="내 반려동물"
      title="함께 가는 아이들"
      subtitle="등록한 정보를 기준으로 출입 조건을 판별해요.">
      <View style={styles.list}>
        {pets.map((pet) => (
          <View
            key={pet.petId}
            style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
            <PetAvatar pet={pet} size={50} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: p.ink }]}>{pet.name}</Text>
              <Text style={[styles.detail, { color: p.muted }]}>
                {pet.species} · {pet.weight}kg
              </Text>
              <View style={styles.badges}>
                <Badge
                  label={`${BREED_SIZE_LABEL[pet.breedSize]}견`}
                  color={p.unknown}
                  background={p.unknownSoft}
                />
                {pet.vaccinated ? (
                  <Badge label="접종 완료" color={p.success} background={p.successSoft} />
                ) : (
                  <Badge label="접종 필요" color={p.warn} background={p.warnSoft} />
                )}
              </View>
            </View>
            <Pressable
              onPress={() => removePet(pet.petId)}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Ionicons name="trash-outline" size={18} color={p.muted} />
            </Pressable>
          </View>
        ))}
      </View>

      {formOpen ? (
        <View style={[styles.form, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
          <Text style={[styles.formTitle, { color: p.ink }]}>새 반려동물 등록</Text>

          <Pressable onPress={pickPhoto} style={styles.photoPick}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: p.accentSoft }]}>
                <Ionicons name="camera" size={22} color={p.accent} />
              </View>
            )}
            <Text style={[styles.photoLabel, { color: p.accent }]}>
              {photoUri ? '사진 변경' : '프로필 사진 추가 (선택)'}
            </Text>
          </Pressable>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="이름 (예: 몽이)"
            placeholderTextColor={p.muted}
            style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
          />
          <TextInput
            value={species}
            onChangeText={setSpecies}
            placeholder="견종 (예: 말티즈)"
            placeholderTextColor={p.muted}
            style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
          />
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="체중 (kg)"
            placeholderTextColor={p.muted}
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
          />

          <Text style={[styles.label, { color: p.muted }]}>체급</Text>
          <View style={styles.sizeRow}>
            {BREED_SIZES.map((s) => (
              <Chip
                key={s}
                label={BREED_SIZE_LABEL[s]}
                selected={breedSize === s}
                onPress={() => setBreedSize(s)}
              />
            ))}
          </View>

          <View style={[styles.switchRow, { borderTopColor: p.line }]}>
            <Text style={[styles.label, { color: p.ink }]}>종합 예방접종 완료</Text>
            <Switch
              value={vaccinated}
              onValueChange={setVaccinated}
              trackColor={{ true: p.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

          <View style={styles.formActions}>
            <Pressable
              onPress={() => {
                setFormOpen(false);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.button,
                { borderColor: p.line, borderWidth: 1, opacity: pressed ? 0.85 : 1 },
              ]}>
              <Text style={[styles.buttonLabel, { color: p.ink }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: pressed ? p.accentDark : p.accent },
              ]}>
              <Text style={[styles.buttonLabel, { color: p.onAccent }]}>등록</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setFormOpen(true)}
          style={({ pressed }) => [
            styles.addButton,
            { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
          ]}>
          <Ionicons name="add-circle" size={19} color={p.accent} />
          <Text style={[styles.addLabel, { color: p.accent }]}>반려동물 등록</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  photoPick: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  photoPreview: { width: 76, height: 76, borderRadius: Radius.full },
  photoPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: { fontSize: 13, fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  detail: { fontSize: 13 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: 16,
  },
  addLabel: { fontSize: 14.5, fontWeight: '800' },
  form: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  formTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  label: { fontSize: 13, fontWeight: '700' },
  sizeRow: { flexDirection: 'row', gap: Spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: Spacing.lg,
    marginTop: 4,
  },
  error: { fontSize: 13, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  buttonLabel: { fontSize: 14.5, fontWeight: '800' },
});
