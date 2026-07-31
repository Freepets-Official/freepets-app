import { RankingView } from '@/components/ranking-view';
import { Screen } from '@/components/screen';

/**
 * 발자국 랭킹 화면.
 * 현재는 탐색 탭에 토글로 흡수되어 탭바에서 숨겨져 있다(_layout의 href:null).
 * 탭을 다시 분리하고 싶으면 _layout에서 href:null 한 줄만 지우면 이 화면이 그대로 돌아온다.
 */
export default function RankingScreen() {
  return (
    <Screen
      eyebrow="발자국 랭킹"
      title="발자국 많은 곳"
      subtitle="반려동물과 얼마나 편했는지, 실제 방문자 리뷰로만 매긴 등급이에요.">
      <RankingView />
    </Screen>
  );
}
