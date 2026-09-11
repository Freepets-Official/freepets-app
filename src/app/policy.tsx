import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { SUPPORT_EMAIL, SUPPORT_MAIL_SUBJECT } from '@/constants/contact';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 이용약관 · 개인정보처리방침. 설정에서 각각 진입한다.
 *
 * 한 화면에 둘 다 싣지 않는다 — 설정에 항목이 따로 있는데 같은 내용이 나오면
 * 무엇을 읽고 있는지 알 수 없고, 앱스토어에 낸 개인정보처리방침 URL
 * (`/policy?tab=privacy`)이 약관까지 담고 있으면 심사자가 방침을 찾아 스크롤해야 한다.
 *
 * 리뷰 작성 시 사용자가 선택하면 반려동물 품종·몸무게가 공개될 수 있다는 조항을 명시한다.
 */
export default function PolicyScreen() {
  const p = usePalette();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const isPrivacy = tab === 'privacy';
  const title = isPrivacy ? '개인정보처리방침' : '이용약관';

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title, headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Text style={[styles.updated, { color: p.muted }]}>최종 개정 2026-09-11 · 반갑꼬리</Text>

          {isPrivacy ? <Privacy p={p} /> : <Terms p={p} />}

          {/* 다른 문서로 건너가는 길. 둘을 분리했으니 서로를 가리켜야 한다 */}
          <Pressable
            onPress={() =>
              isPrivacy ? router.replace('/policy') : router.replace({ pathname: '/policy', params: { tab: 'privacy' } })
            }
            style={({ pressed }) => [styles.switchLink, { borderColor: p.line, opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.switchText, { color: p.accent }]}>
              {isPrivacy ? '이용약관 보기' : '개인정보처리방침 보기'}
            </Text>
          </Pressable>

          <Text style={[styles.footer, { color: p.muted }]}>
            서비스 준비 단계의 요약본입니다. 기능이 추가되면 이 문서도 함께 갱신하고 앱에서 알려드립니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────── 이용약관 ─────────────────────────── */

function Terms({ p }: { p: Palette }) {
  return (
    <Section p={p} title="이용약관">
      <Clause p={p} n="제1조 (목적)">
        본 약관은 반갑꼬리(이하 “서비스”)가 제공하는 반려동물 동반여행 정보·판별 서비스의 이용 조건과
        절차를 정합니다.
      </Clause>
      <Clause p={p} n="제2조 (계정)">
        이용자는 이메일 또는 소셜 계정으로 가입하며, 한 계정 아래 일반·사업자 프로필을 둘 수 있습니다.
        계정 정보는 정확하게 유지할 책임이 있습니다.
      </Clause>
      <Clause p={p} n="제3조 (이용자 콘텐츠)">
        이용자가 작성한 리뷰·제보·공개 코스 등은 다른 이용자에게 공개될 수 있습니다. 타인의 권리를
        침해하거나 허위인 콘텐츠는 게시할 수 없으며, 신고된 콘텐츠는 검토 전까지 발자국 등급 산정에서
        제외됩니다.
      </Clause>
      <Clause p={p} n="제4조 (출입 판별의 성격)">
        AI 출입 판별과 신뢰도 표시는 참고 정보이며 최종 입장 여부는 각 시설의 재량입니다. 시설 정보의
        원문은 한국관광공사 관광정보 서비스에서 제공받으며, 현장 안내문과 다를 수 있으므로 방문 전
        확인을 권장합니다.
      </Clause>
      <Clause p={p} n="제5조 (해지)">
        이용자는 언제든 설정 &gt; 회원 탈퇴에서 계정을 삭제할 수 있습니다. 탈퇴 즉시 계정과 등록한
        반려동물 정보가 삭제됩니다.
      </Clause>
      <Clause p={p} n="제6조 (문의)">
        약관에 관한 문의는 {SUPPORT_EMAIL}로 보내주세요.
      </Clause>
    </Section>
  );
}

/* ───────────────────── 개인정보처리방침 ───────────────────── */

function Privacy({ p }: { p: Palette }) {
  return (
    <Section p={p} title="개인정보처리방침">
      <Clause p={p} n="1. 수집 항목">
        (필수) 이메일·닉네임·비밀번호(또는 소셜 식별자), 알림 수신을 위한 기기 푸시 토큰.
        (선택) 반려동물 정보(이름·종류·품종·몸무게·접종 여부), 프로필 사진, 위치(허용 시),
        이용자가 작성한 리뷰·제보·코스.
      </Clause>
      <Clause p={p} n="2. 이용 목적">
        회원 관리, 출입 조건 판별, 리뷰·발자국 등급 산정, 주변 시설 안내, 현장 거부 제보 알림 등 서비스
        제공. 광고·마케팅이나 이용자 행동 분석에는 사용하지 않으며, 광고 식별자를 수집하지 않습니다.
      </Clause>
      <Clause p={p} n="3. 리뷰 작성 시 반려동물 정보 공개" highlight>
        이용자가 리뷰 작성 시 <Text style={{ fontWeight: '800' }}>“품종·몸무게 공개”</Text>를 켜면, 해당
        리뷰에 선택한 반려동물의 <Text style={{ fontWeight: '800' }}>종류·품종·몸무게</Text>가 다른
        이용자에게 공개됩니다. 이는 “우리 아이 기준” 판단을 돕기 위한 것으로,
        <Text style={{ fontWeight: '800' }}> 이용자의 선택(옵트인)에 따라만 </Text> 표시되며 언제든 끌 수
        있습니다. 반려동물 정보는 사람의 개인정보가 아니지만, 작성자 보호를 위해 공개 여부를 직접 고르게
        합니다.
      </Clause>
      <Clause p={p} n="4. 위치 정보">
        위치는 이용자가 권한을 허용한 경우에만 사용합니다. 주변 시설을 거리순으로 찾고 시설까지의 거리를
        계산하기 위해 <Text style={{ fontWeight: '800' }}>요청하는 시점에 좌표를 서버로 전송</Text>하며,
        이동 경로나 위치 이력을 만들지 않습니다. 여권 도장의 “현장 확인” 표시는 기기 안에서 시설과의
        거리를 계산해 참·거짓만 남기고 좌표 자체는 저장하지 않습니다.
      </Clause>
      <Clause p={p} n="5. 사진과 카메라">
        반려동물·프로필 사진은 이용자가 등록할 때만 서버로 전송됩니다. 여권 도장 인증샷은 기기 안에만
        저장되며 서버로 보내지 않습니다.
      </Clause>
      <Clause p={p} n="6. 보관·파기">
        반려동물을 삭제해도 이미 공개된 리뷰의 품종·몸무게는 리뷰 시점 값으로 남을 수 있습니다. 회원
        탈퇴 시 계정 정보는 관련 법령이 정한 기간을 제외하고 파기합니다.
      </Clause>
      <Clause p={p} n="7. 이용자의 권리">
        이용자는 언제든 앱에서 자신의 정보를 열람·수정하고, 설정 &gt; 회원 탈퇴로 계정을 삭제할 수
        있습니다. 알림 수신은 설정에서 끌 수 있으며, 끄면 저장된 푸시 토큰도 함께 삭제됩니다.
      </Clause>
      <Clause p={p} n="8. 제3자 제공">
        이용자의 개인정보를 제3자에게 판매하거나 광고 목적으로 제공하지 않습니다. 출입 조건 판별에는
        시설이 게시한 조건 문구를 AI 분석에 사용하며, 이 과정에 이용자를 식별할 수 있는 정보는 포함되지
        않습니다.
      </Clause>
      <Clause p={p} n="9. 개인정보 보호책임자 및 문의처" highlight>
        개인정보 처리에 관한 문의·열람·삭제 요청은 아래로 보내주시면 지체 없이 답변드립니다.
        {'\n'}
        <Text style={{ fontWeight: '800' }}>반갑꼬리 개인정보 보호 담당 · {SUPPORT_EMAIL}</Text>
      </Clause>
    </Section>
  );
}

/* ─────────────────────────── 조각 ─────────────────────────── */

type Palette = ReturnType<typeof usePalette>;

function Section({ p, title, children }: { p: Palette; title: string; children: React.ReactNode }) {
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
  p: Palette;
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
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: '900', letterSpacing: -0.6, marginBottom: 2 },
  clause: { borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: 4, gap: 3 },
  clauseTitle: { fontSize: 13.5, fontWeight: '800' },
  clauseBody: { fontSize: 13, lineHeight: 20 },
  switchLink: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  switchText: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  footer: { fontSize: 11.5, lineHeight: 17 },
});
