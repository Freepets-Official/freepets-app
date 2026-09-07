import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, authApi, type SocialProvider } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

import { getProviderToken, isProviderAvailable, readReturnedToken } from './social-provider';

/**
 * 소셜 로그인의 **공통 합류 지점**.
 *
 * 토큰을 얻는 방법은 플랫폼마다 다르다(웹은 OAuth 리다이렉트, 네이티브는 각 SDK).
 * 하지만 그 뒤 — 서버 교환·세션 저장·신규 가입 분기 — 는 전부 여기 하나로 모은다.
 * 경로가 갈리면 "웹에서는 가입 후 다른 화면으로 간다" 같은 어긋남이 조용히 생기는데,
 * 이 앱은 이미 전화 버튼 두 개가 서로 다른 규칙으로 동작하던 문제를 겪었다.
 *
 * ⚠️ **신규 가입자에게 비밀번호를 묻지 않는다.** 네이버 검수 기준상 소셜 가입 과정에서
 * 별도의 비밀번호를 요구하면 거부된다. 소셜 가입자는 서버에서 passwordHash가 null이고,
 * 여기서도 authenticate만 부르고 비밀번호 화면으로 보내지 않는다.
 */
export function useSocialLogin() {
  const { authenticate } = useAppStore();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 웹에서 로그인 창을 다녀온 직후를 이어받는다. 리다이렉트는 페이지를 새로 그리므로
   * signIn의 프로미스가 끊긴다 — 돌아왔을 때 SDK가 조각(#)에 실어 온 토큰을 주워 마저 진행한다.
   * 네이티브에는 리다이렉트가 없어 readReturnedToken이 항상 null이다.
   */
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    let alive = true;
    void (async () => {
      const got = await readReturnedToken();
      // 조각이 없으면 평범한 첫 방문이다 — 대기 상태조차 만들지 않는다
      if (!got || !alive) return;
      setPending('naver');
      try {
        const res = await authApi.social('naver', got.providerToken, got.name);
        if (alive) authenticate(got.email ?? '', res);
      } catch (e) {
        if (alive)
          setError(
            e instanceof ApiError
              ? e.message
              : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
          );
      } finally {
        if (alive) setPending(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authenticate]);

  const signIn = useCallback(
    async (provider: SocialProvider) => {
      setPending(provider);
      setError(null);
      try {
        // ① 토큰 얻기 — 여기만 플랫폼별로 갈린다
        const got = await getProviderToken(provider);
        if (!got) {
          // 사용자가 로그인 창을 닫은 경우. 실패가 아니므로 오류를 띄우지 않는다
          return;
        }
        // ② 서버 교환 — 여기서부터는 모든 제공자·플랫폼이 같은 길
        const res = await authApi.social(provider, got.providerToken, got.name);
        authenticate(got.email ?? '', res);
        // isNewUser여도 추가로 물을 것이 없다. 프로필 선택은 authenticate가 세운 세션 상태에
        // 따라 라우터(useAuthGate)가 알아서 안내한다 — 비밀번호는 어느 경로에도 없다.
      } catch (e) {
        setError(
          e instanceof ApiError
            ? e.code === 'OAUTH4003'
              ? '이미 다른 방법으로 가입한 이메일이에요. 원래 방식으로 로그인해 주세요.'
              : e.message
            : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
        );
      } finally {
        setPending(null);
      }
    },
    [authenticate],
  );

  return { signIn, pending, error, isProviderAvailable };
}
