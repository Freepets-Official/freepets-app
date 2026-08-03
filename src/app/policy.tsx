import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 이용약관 · 개인정보처리방침 (요약). 설정에서 진입한다.
 * 리뷰 작성 시 사용자가 선택하면 반려동물 품종·몸무게가 공개될 수 있다는 조항을 명시한다.
 */
export default function PolicyScreen() {
  const p = usePalette();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const title = tab === 'privacy' ? '개인정보처리방침' : '이용약관';

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title, headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Text style={[styles.updated, { color: p.muted }]}>최종 개정 2026-08-03 · 프리펫스</Text>

          {/* 이용약관 */}
          <Section p={p} title="이용약관">
            <Clause p={p} n="제1조 (목적)">
              본 약관은 프리펫스(이하 “서비스”)가 제공하는 반려동물 동반여행 정보·판별 서비스의
              이용 조건과 절차를 정합니다.
            </Clause>
            <Clause p={p} n="제2조 (계정)">
              이용자는 이메일 또는 소셜 계정으로 가입하며, 한 계정 아래 일반·사업자 프로필을 둘 수
              있습니다. 계정 정보는 정확하게 유지할 책임이 있습니다.
            </Clause>
            <Clause p={p} n="제3조 (이용자 콘텐츠)">
              이용자가 작성한 리뷰·제보·사진 등은 다른 이용자에게 공개될 수 있습니다. 타인의 권리를
              침해하거나 허위인 콘텐츠는 게시할 수 없습니다.
            </Clause>
            <Clause p={p} n="제4조 (출입 판별의 성격)">
              AI 출입 판별과 신뢰도 표시는 참고 정보이며 최종 입장 여부는 각 시설의 재량입니다. 방문
              전 시설 확인을 권장합니다.
            </Clause>
          </Section>

          {/* 개인정보처리방침 */}
          <Section p={p} title="개인정보처리방침">
            <Clause p={p} n="1. 수집 항목">
              (필수) 이메일·닉네임·비밀번호(또는 소셜 식별자). (선택) 반려동물 정보(이름·종류·품종·
              몸무게·접종 여부), 프로필 사진, 위치(허용 시).
            </Clause>
            <Clause p={p} n="2. 이용 목적">
              회원 관리, 출입 조건 판별, 리뷰·발자국 등급 산정, 일정 알림 등 서비스 제공.
            </Clause>
            <Clause p={p} n="3. 리뷰 작성 시 반려동물 정보 공개" highlight>
              이용자가 리뷰 작성 시 <Text style={{ fontWeight: '800' }}>“품종·몸무게 공개”</Text>를 켜면,
              해당 리뷰에 선택한 반려동물의 <Text style={{ fontWeight: '800' }}>종류·품종·몸무게</Text>가
              다른 이용자에게 공개됩니다. 이는 “우리 아이 기준” 판단을 돕기 위한 것으로,
              <Text style={{ fontWeight: '800' }}> 이용자의 선택(옵트인)에 따라만 </Text> 표시되며 언제든
              끌 수 있습니다. 반려동물 정보는 사람의 개인정보가 아니지만, 작성자 보호를 위해 공개 여부를
              직접 고르게 합니다.
            </Clause>
            <Clause p={p} n="4. 보관·파기">
              반려동물을 삭제해도 이미 공개된 리뷰의 품종·몸무게는 리뷰 시점 값으로 남을 수 있습니다.
              회원 탈퇴 시 계정 정보는 관련 법령이 정한 기간을 제외하고 파기합니다.
            </Clause>
            <Clause p={p} n="5. 위치 정보">
              위치는 이용자가 권한을 허용한 경우에만 주변 시설 정렬에 쓰이며, 별도로 저장·전송하지
              않습니다.
            </Clause>
          </Section>

          <Text style={[styles.footer, { color: p.muted }]}>
            본 문서는 공모전 데모용 요약본입니다. 실제 서비스 시 관련 법령에 따라 보강됩니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  p,
  title,
  children,
}: {
  p: ReturnType<typeof usePalette>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: p.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

function Clause({
  p,
  n,
  highlight,
  children,
}: {
  p: ReturnType<typeof usePalette>;
  n: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.clause,
        highlight && { backgroundColor: p.accentSoft, borderColor: p.accent, borderWidth: 1, padding: Spacing.md },
      ]}>
      <Text style={[styles.clauseTitle, { color: highlight ? p.accent : p.ink }]}>{n}</Text>
      <Text style={[styles.clauseBody, { color: p.ink }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl, paddingTop: Spacing.md },
  updated: { fontSize: 12, fontWeight: '600' },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.6, marginBottom: 2 },
  clause: { borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: 4, gap: 3 },
  clauseTitle: { fontSize: 13.5, fontWeight: '800' },
  clauseBody: { fontSize: 13, lineHeight: 20 },
  footer: { fontSize: 11.5, lineHeight: 17 },
});
