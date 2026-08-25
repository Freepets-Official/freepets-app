import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Chip } from '@/components/chip';
import { PetAvatar } from '@/components/pet-avatar';
import { Screen } from '@/components/screen';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import {
  AI_JUDGEABLE_KINDS,
  BREED_SIZE_LABEL,
  PET_KIND_LABEL,
  nextVaccinationOf,
  vaccinationDday,
  type BreedSize,
  type PetKind,
} from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const BREED_SIZES = Object.keys(BREED_SIZE_LABEL) as BreedSize[];
const PET_KINDS = Object.keys(PET_KIND_LABEL) as PetKind[];

export default function PetsScreen() {
  const p = usePalette();
  const { pets, addPet, removePet, updatePet, addCalendarEvent } = useAppStore();
  const [addedVax, setAddedVax] = useState<Set<number>>(new Set());
  // 편집 중인 아이 id (null이면 새 등록)
  const [editingId, setEditingId] = useState<number | null>(null);

  const addVaxToCalendar = (petId: number, species: string, date: string) => {
    addCalendarEvent({
      petId,
      type: 'VACCINE',
      title: `${species} 예방접종`,
      date,
      time: null,
      repeat: 'NONE',
      reminder: true,
      notes: '다음 접종 예정 — 정확한 일정은 동물병원 확인',
    });
    setAddedVax((prev) => new Set(prev).add(petId));
  };

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PetKind>('DOG');
  const [species, setSpecies] = useState('');
  const [weight, setWeight] = useState('');
  const [breedSize, setBreedSize] = useState<BreedSize>('SMALL');
  // 개·고양이는 체중·체급으로 판별되지만, 그 외 종은 그 값이 무의미하다
  const sizeMatters = kind === 'DOG' || kind === 'CAT';
  const [vaccinated, setVaccinated] = useState(false);
  const [vaccinationDate, setVaccinationDate] = useState('');
  const [nextVaccinationDate, setNextVaccinationDate] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, // 원본으로 받고 압축은 아래 변환 단계에서
    });
    if (result.canceled || !result.assets[0]) return;
    // 업로드 전 최대 1024px 리사이즈 + jpeg 변환.
    // 용량을 크게 줄여 nginx 10MB 한도(413)를 사실상 안 넘고, iOS HEIC도 jpeg로 정규화한다.
    try {
      const out = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      setPhotoUri(out.uri);
    } catch {
      setPhotoUri(result.assets[0].uri); // 변환 실패 시 원본이라도 사용
    }
  };

  const resetForm = () => {
    setName('');
    setKind('DOG');
    setSpecies('');
    setWeight('');
    setBreedSize('SMALL');
    setVaccinated(false);
    setVaccinationDate('');
    setNextVaccinationDate('');
    setPhotoUri(null);
    setError(null);
    setEditingId(null);
  };

  // 카드 탭 → 편집: 폼을 그 아이 값으로 채우고 연다
  const openEdit = (pet: (typeof pets)[number]) => {
    setEditingId(pet.petId);
    setName(pet.name);
    setKind(pet.kind);
    setSpecies(pet.species);
    setWeight(pet.weight > 0 ? String(pet.weight) : '');
    setBreedSize(pet.breedSize);
    setVaccinated(pet.vaccinated);
    setVaccinationDate(pet.vaccinationDate ?? '');
    setNextVaccinationDate(pet.nextVaccinationDate ?? '');
    setPhotoUri(pet.photoUri);
    setError(null);
    setFormOpen(true);
  };

  const submit = () => {
    const w = Number(weight);
    // 오늘(로컬 기준) — 접종일 과거/미래 검증에 쓴다
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (!name.trim()) return setError('이름을 입력해 주세요');
    if (name.trim().length > 50) return setError('이름은 50자 이하로 입력해 주세요');
    if (!species.trim()) return setError('품종을 입력해 주세요');
    if (species.trim().length > 100) return setError('품종은 100자 이하로 입력해 주세요');
    // 체중은 개·고양이만 필수(판별에 쓰임). 그 외 종은 비워도 된다
    if (sizeMatters && (!weight.trim() || Number.isNaN(w) || w <= 0)) {
      return setError('체중을 숫자로 입력해 주세요 (kg)');
    }
    if (!sizeMatters && weight.trim() && (Number.isNaN(w) || w <= 0)) {
      return setError('체중을 숫자로 입력해 주세요 (kg)');
    }
    // 접종 완료면 날짜를 받는다. 형식이 있으면 검증, 비워두면 날짜 미기재로 저장
    const dateInput = vaccinationDate.trim();
    if (vaccinated && dateInput && !/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return setError('접종 날짜를 YYYY-MM-DD 형식으로 입력해 주세요 (예: 2026-03-15)');
    }
    if (vaccinated && dateInput && dateInput > today) {
      return setError('접종일은 오늘까지의 날짜만 입력할 수 있어요');
    }
    const nextInput = nextVaccinationDate.trim();
    if (nextInput && !/^\d{4}-\d{2}-\d{2}$/.test(nextInput)) {
      return setError('다음 접종 예정일을 YYYY-MM-DD 형식으로 입력해 주세요');
    }
    if (nextInput && nextInput < today) {
      return setError('다음 접종 예정일은 오늘 이후 날짜로 입력해 주세요');
    }

    const payload = {
      name: name.trim(),
      kind,
      species: species.trim(),
      // 서버는 소수 둘째 자리까지 — 반올림해 보낸다
      weight: weight.trim() ? Math.round(w * 100) / 100 : 0,
      breedSize: sizeMatters ? breedSize : 'SMALL',
      vaccinated,
      vaccinationDate: vaccinated && dateInput ? dateInput : null,
      nextVaccinationDate: nextInput || null,
      photoUri,
    };
    if (editingId !== null) updatePet(editingId, payload);
    else addPet(payload);
    resetForm();
    setFormOpen(false);
  };

  // 편집 폼 — 편집 시엔 해당 카드 자리에서, 신규 등록 시엔 목록 아래에서 같은 폼을 쓴다
  const renderForm = (key: string | number) => (
    <View key={key} style={[styles.form, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[styles.formTitle, { color: p.ink }]}>
        {editingId !== null ? '반려동물 수정' : '새 반려동물 등록'}
      </Text>

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
        maxLength={50}
        style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
      />

      <Text style={[styles.label, { color: p.muted }]}>동물 종류</Text>
      {/* 6종을 3×2 균등 그리드로 — 한 칸만 다음 줄로 넘어가 생기던 어정쩡한 여백을 없앤다 */}
      <View style={styles.kindGrid}>
        {PET_KINDS.map((k) => {
          const on = kind === k;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[
                styles.kindChip,
                { backgroundColor: on ? p.ink : p.surface, borderColor: on ? p.ink : p.line },
              ]}>
              <Text style={[styles.kindChipText, { color: on ? p.bg : p.muted }]}>
                {PET_KIND_LABEL[k]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!AI_JUDGEABLE_KINDS.includes(kind) && (
        <Text style={[styles.kindHint, { color: p.muted }]}>
          {PET_KIND_LABEL[kind]}는 관광공사·AI 기준 정보가 없어, 판별 대신 시설에 직접 확인하도록
          안내해요.
        </Text>
      )}

      <TextInput
        value={species}
        onChangeText={setSpecies}
        placeholder="품종 (예: 말티즈, 앵무새)"
        placeholderTextColor={p.muted}
        maxLength={100}
        style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
      />
      <TextInput
        value={weight}
        onChangeText={setWeight}
        placeholder={sizeMatters ? '체중 (kg)' : '체중 (kg · 선택)'}
        placeholderTextColor={p.muted}
        keyboardType="decimal-pad"
        style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
      />

      {sizeMatters && (
        <>
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
        </>
      )}

      <View style={[styles.switchRow, { borderTopColor: p.line }]}>
        <Text style={[styles.label, { color: p.ink }]}>종합 예방접종 완료</Text>
        <Switch
          value={vaccinated}
          onValueChange={(v) => {
            setVaccinated(v);
            if (!v) setVaccinationDate('');
          }}
          trackColor={{ true: p.accent }}
          thumbColor="#FFFFFF"
        />
      </View>

      {vaccinated && (
        <TextInput
          value={vaccinationDate}
          onChangeText={setVaccinationDate}
          placeholder="접종일 (예: 2026-03-15)"
          placeholderTextColor={p.muted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
        />
      )}

      {(kind === 'DOG' || kind === 'CAT') && (
        <TextInput
          value={nextVaccinationDate}
          onChangeText={setNextVaccinationDate}
          placeholder="다음 접종 예정일 (선택 · 비우면 접종일+1년 자동)"
          placeholderTextColor={p.muted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
        />
      )}

      {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

      <View style={styles.formActions}>
        <Pressable
          onPress={() => {
            setFormOpen(false);
            resetForm();
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
          <Text style={[styles.buttonLabel, { color: p.onAccent }]}>
            {editingId !== null ? '수정 완료' : '등록'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen
      eyebrow="내 반려동물"
      title="함께 가는 아이들"
      subtitle="등록한 정보를 기준으로 출입 조건을 판별해요.">
      <View style={styles.list}>
        {pets.map((pet) =>
          formOpen && editingId === pet.petId ? (
            renderForm(pet.petId)
          ) : (
          <Pressable
            key={pet.petId}
            onPress={() => openEdit(pet)}
            style={({ pressed }) => [
              styles.card,
              CardShadow,
              { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.94 : 1 },
            ]}>
            <PetAvatar pet={pet} size={50} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: p.ink }]}>{pet.name}</Text>
              <Text style={[styles.detail, { color: p.muted }]}>
                {PET_KIND_LABEL[pet.kind]} · {pet.species}
                {(pet.kind === 'DOG' || pet.kind === 'CAT') && pet.weight > 0
                  ? ` · ${pet.weight}kg`
                  : ''}
              </Text>
              <View style={styles.badges}>
                <Badge
                  label={pet.kind === 'DOG' ? `${BREED_SIZE_LABEL[pet.breedSize]}견` : PET_KIND_LABEL[pet.kind]}
                  color={p.unknown}
                  background={p.unknownSoft}
                />
                {pet.vaccinated ? (
                  <Badge label="접종 완료" color={p.success} background={p.successSoft} />
                ) : (
                  <Badge label="접종 필요" color={p.warn} background={p.warnSoft} />
                )}
              </View>

              {/* 다음 접종 예정 + 캘린더 알림 추가 */}
              {(() => {
                const next = nextVaccinationOf(pet);
                if (!next) return null;
                const dday = vaccinationDday(pet) ?? 0;
                const overdue = dday < 0;
                const added = addedVax.has(pet.petId);
                return (
                  <View style={styles.vaxRow}>
                    <Ionicons name="medkit" size={13} color={overdue ? p.danger : p.accent} />
                    <Text style={[styles.vaxText, { color: overdue ? p.danger : p.muted }]}>
                      다음 접종 {next} · {overdue ? `${-dday}일 지남` : `D-${dday}`}
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!added) addVaxToCalendar(pet.petId, pet.species, next);
                      }}
                      hitSlop={6}
                      style={[styles.vaxBtn, { backgroundColor: added ? p.successSoft : p.accentSoft }]}>
                      <Ionicons
                        name={added ? 'checkmark' : 'calendar'}
                        size={12}
                        color={added ? p.success : p.accent}
                      />
                      <Text style={[styles.vaxBtnText, { color: added ? p.success : p.accent }]}>
                        {added ? '추가됨' : '캘린더'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })()}
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                removePet(pet.petId);
              }}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Ionicons name="trash-outline" size={18} color={p.muted} />
            </Pressable>
          </Pressable>
          ),
        )}
      </View>

      {/* 신규 등록 폼만 목록 아래에 — 편집은 위 map에서 해당 카드 자리에 펼쳐진다 */}
      {formOpen && editingId === null ? (
        renderForm('new')
      ) : !formOpen ? (
        <Pressable
          onPress={() => {
            resetForm();
            setFormOpen(true);
          }}
          style={({ pressed }) => [
            styles.addButton,
            { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
          ]}>
          <Ionicons name="add-circle" size={19} color={p.accent} />
          <Text style={[styles.addLabel, { color: p.accent }]}>반려동물 등록</Text>
        </Pressable>
      ) : null}
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
  vaxRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  vaxText: { fontSize: 11.5, fontWeight: '600', flexShrink: 1, fontVariant: ['tabular-nums'] },
  vaxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vaxBtnText: { fontSize: 11, fontWeight: '800' },
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
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kindChip: {
    // flexBasis 30% + gap → 한 줄에 3칸, 6종이 3×2로 균등하게 채워진다
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 9,
  },
  kindChipText: { fontSize: 13, fontWeight: '700' },
  kindHint: { fontSize: 12, lineHeight: 17, marginTop: -4 },
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
