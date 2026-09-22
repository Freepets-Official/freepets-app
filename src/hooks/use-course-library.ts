import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';

import { courseShareUrl } from '@/constants/links';
import { ApiError, coursesApi } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { confirmDialog, promptText } from '@/lib/notify';
import { useAppStore } from '@/store/app-store';
import type { CourseStop, PublicCourse, SavedCourse } from '@/data/types';

/**
 * 코스 보관함 — 내 코스 · 둘러보기 · 공유.
 *
 * `course.tsx`에서 떼어낸 조각이다. 셋을 한 훅에 둔 이유는 **떼어놓을 수 없기 때문**이다:
 * 남의 코스를 담으면 내 코스 목록이 바뀌고, 둘러보기는 내 코스를 걸러내야 하며, 세 동작의
 * 결과가 같은 안내 줄(`saveMessage`) 하나를 쓴다. 억지로 나누면 서로의 setState를 주고받는
 * 훅 두 개가 되어 지금보다 읽기 어려워진다.
 *
 * 반대로 **추천·빌더·판별과는 깨끗하게 갈린다** — 그쪽은 `saveCourse()` 하나만 부른다.
 * 그 선을 따라 잘랐다.
 */
/**
 * 두 코스가 같은 동선인가.
 *
 * 순서까지 같아야 같은 코스로 본다 — A→B→C와 C→B→A는 하루가 완전히 다르다.
 * 이름은 보지 않는다. 담을 때 `(닉네임)`이 붙어 원본과 달라지기 때문이다.
 */
function sameStops(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function useCourseLibrary() {
  const router = useRouter();
  const { session, restoring, refreshGamification } = useAppStore();

  // ── 내 코스 저장 ────────────────────────────────────────────────────
  // 서버는 stopIds만 저장한다. 추천 당시의 이름·카테고리·점수는 안 남으므로 목록을 그릴 땐
  // 그 ID로 시설을 다시 조회해야 한다 — 지금은 개수만 보여주고 상세는 다음 작업으로 둔다.
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  /**
   * 내 코스 동작의 결과 안내. 실패는 성공과 다르게 보여야 한다.
   *
   * 공개 토글은 서버가 COURSE4045("공개하려면 코스에 담긴 모든 시설에 판별 기록과 리뷰가
   * 있어야 합니다")로 거절할 수 있는데, 예전에는 이 문장을 블록 맨 아래 회색 작은 글씨로
   * 그려서 누른 자리에서 멀었다. 사용자는 아무 일도 안 일어난 것으로 봤다.
   */
  const [saveMessage, setSaveMessage] = useState<{ text: string; failed: boolean } | null>(null);

  // ── 둘러보기 (다른 사람이 공개한 코스) ────────────────────────────
  // 로그인 없이도 보이는 목록이라 내 코스와 따로 싣는다. 실패를 빈 목록과 구분해서
  // 들고 있어야 "아직 없어요"와 "못 불러왔어요"를 다르게 안내할 수 있다.
  const [publicCourses, setPublicCourses] = useState<PublicCourse[] | null>(null);
  const [publicTotal, setPublicTotal] = useState(0);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState(false);
  const [publicPendingId, setPublicPendingId] = useState<number | null>(null);

  /**
   * 둘러보기에서 **내 코스를 걸러낸다.**
   *
   * `GET /courses/public`은 인증이 없어 서버가 호출자를 모른다. 그래서 내가 공개한 코스도
   * 그대로 내려온다 — 거르지 않으면 같은 코스가 "내 코스"와 "다른 집사의 코스"에 동시에 뜨고,
   * 내 닉네임이 남의 것처럼 붙는다(실서버에서 확인).
   *
   * 로그인 전에는 `savedCourses`가 비어 거를 대상이 없다. 그때는 전부 남의 코스가 맞다.
   */
  /** 이번 세션에 담은 원본 공개 코스 ID. 목록에서 빼 중복 저장을 막는다. */
  const [copiedIds, setCopiedIds] = useState<ReadonlySet<number>>(() => new Set());
  const otherCourses = useMemo(() => {
    if (publicCourses === null) return null;
    const mine = new Set(savedCourses.map((c) => c.courseId));
    /**
     * 담은 코스는 **새 courseId로** 저장되므로 `mine`(내 코스 ID)만으로는 걸러지지 않는다.
     * `copiedIds`는 이번 실행에 담은 것만 알아서, 앱을 껐다 켜면 같은 코스가 다시 나타나고
     * 또 담겼다 — 실기기에서 확인된 문제다. **스톱 구성이 같으면 이미 담은 것**으로 본다.
     */
    return publicCourses.filter(
      (c) =>
        !mine.has(c.courseId) &&
        !copiedIds.has(c.courseId) &&
        !savedCourses.some((s2) => sameStops(s2.stopIds, c.stopIds)),
    );
  }, [publicCourses, savedCourses, copiedIds]);


  /** 목록 새로고침. 실패하면 던진다 — 호출자가 "무엇이 실패했는지" 구분해 안내해야 한다. */
  const reloadSaved = useCallback(async () => {
    setSavedCourses(await coursesApi.list());
  }, []);

  /**
   * 둘러보기 새로고침. 화면에 재시도 버튼이 걸려 있다.
   *
   * 늦게 온 응답이 새 응답을 덮지 않게 요청마다 번호를 매긴다 — 실패 후 두 번 누르면
   * 먼저 보낸 요청이 나중에 도착할 수 있고, 그러면 옛 목록이 최종 화면이 된다.
   */
  const publicReqRef = useRef(0);
  const reloadPublic = useCallback(async () => {
    const seq = ++publicReqRef.current;
    setPublicLoading(true);
    try {
      const r = await coursesApi.publicList({ size: 10 });
      if (seq !== publicReqRef.current) return;
      setPublicCourses(r.items);
      setPublicTotal(r.total);
      setPublicError(false);
    } catch {
      if (seq !== publicReqRef.current) return;
      setPublicError(true);
    } finally {
      if (seq === publicReqRef.current) setPublicLoading(false);
    }
  }, []);

  // 초기 로드는 effect 안에서 직접 받는다. reloadSaved를 그대로 부르면 effect 본문에서
  // setState를 동기로 부르는 모양이 되어 연쇄 렌더 경고가 뜬다.
  useEffect(() => {
    let active = true;
    coursesApi
      .list()
      .then((list) => {
        if (active) setSavedCourses(list);
      })
      .catch(() => {
        // 저장된 코스를 못 받아도 추천·판별은 그대로 쓸 수 있어야 한다
      });
    return () => {
      active = false;
    };
  }, []);

  // 둘러보기는 인증이 없어 로그인 전에도 뜬다. 내 코스와 분리해 실패가 서로를 가리지 않게 한다.
  useEffect(() => {
    let active = true;
    coursesApi
      .publicList({ size: 10 })
      .then((r) => {
        if (active) {
          setPublicCourses(r.items);
          setPublicTotal(r.total);
          setPublicError(false);
        }
      })
      .catch(() => {
        // 못 불러온 것을 "공개된 코스가 없다"로 보여주면 서비스가 빈 것처럼 읽힌다.
        // 목록은 null로 남긴다 — []로 떨어뜨리면 length===0만 보는 코드가 장애를 빈 목록으로 읽는다.
        if (active) setPublicError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * 코스를 내 것으로 담는다. `stops`에서 쓰는 것은 `facilityId`뿐이다 — 서버가 그것만 받는다.
   *
   * 저장에 성공하면 새 `courseId`를 돌려준다. 빌더에서 짠 스톱별 시간을 그 코스로 옮기려면
   * 호출하는 쪽이 이 값을 알아야 한다(시간은 서버에 없어 기기에 코스별로 남는다).
   */
  const saveCourse = async (
    key: string,
    name: string,
    stops: Pick<CourseStop, 'facilityId'>[],
  ): Promise<number | null> => {
    if (stops.length === 0) return null;
    setSavingKey(key);
    setSaveMessage(null);
    try {
      // 서버는 1~10개만 받는다. 추천 stops의 facilityId를 순서 그대로 넣으면 내 코스가 된다.
      //
      // 담은 날짜를 이름에 남긴다. 서버 추천 제목은 그날그날 같은 문구가 오기 때문에
      // ("지금 인기 있는 곳" 등) 여러 번 담으면 목록에 같은 이름만 쌓여 구분이 안 된다.
      const stamp = new Date();
      const created = await coursesApi.create({
        name: `${name} · ${stamp.getMonth() + 1}/${stamp.getDate()}`,
        stopIds: stops.slice(0, 10).map((st) => st.facilityId),
      });
      // 저장 결과로 목록을 먼저 갱신한다. 목록 재조회가 실패해도 방금 담은 코스는 보여야 한다 —
      // 저장은 됐는데 목록에 없으면 사용자는 실패한 줄 안다.
      setSavedCourses((prev) => [created, ...prev.filter((c) => c.courseId !== created.courseId)]);
      setSaveMessage({ text: `'${name}'을(를) 내 코스에 담았어요`, failed: false });
      // 서버가 매긴 순서·필드로 맞춰두되, 실패는 저장 성공을 덮지 않는다
      reloadSaved().catch(() => {});
      return created.courseId;
    } catch (e) {
      setSaveMessage({ text: e instanceof Error ? e.message : '코스를 저장하지 못했어요', failed: true });
      return null;
    } finally {
      setSavingKey(null);
    }
  };

  const removeCourse = async (courseId: number) => {
    // 되돌릴 수 없다. 공개 코스면 담아간 사람들 것은 남지만 내 것은 사라진다 — 한 번 묻는다
    const name = savedCourses.find((c) => c.courseId === courseId)?.name ?? '이 코스';
    if (!(await confirmDialog('코스를 삭제할까요?', `'${name}'을(를) 지우면 되돌릴 수 없어요.`))) return;
    try {
      await coursesApi.remove(courseId);
      // 삭제 성공을 화면에 먼저 반영한다(같은 이유로 목록 재조회 실패에 기대지 않는다)
      setSavedCourses((prev) => prev.filter((c) => c.courseId !== courseId));
      setSaveMessage(null);
      reloadSaved().catch(() => {});
    } catch {
      setSaveMessage({ text: '코스를 삭제하지 못했어요', failed: true });
    }
  };

  /**
   * 남의 공개 코스를 내 코스로 담는다.
   *
   * 서버가 코스를 통째로 복제해주는 API는 없다. 대신 `stopIds`를 그대로 새 코스로 저장하면
   * 같은 동선이 내 것이 된다 — 명세도 이 엔드포인트의 쓸모를 그렇게 적어뒀다.
   * 이름에 누구 것인지 남겨, 나중에 목록에서 내가 만든 것과 구분되게 한다.
   */
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const copyPublicCourse = async (course: PublicCourse) => {
    /**
     * 이미 담은 코스면 또 담지 않는다.
     *
     * `copiedIds`는 이번 실행 중에 담은 것만 안다 — 앱을 껐다 켜면 같은 코스가 둘러보기에
     * 다시 나타나고, 누르면 같은 동선이 하나 더 저장됐다(실기기에서 확인된 문제).
     * 그래서 기억이 아니라 **실제 내 코스의 스톱 구성**으로 판단한다. 담은 코스는 새
     * courseId를 받으므로 ID로는 영영 못 찾는다.
     */
    const already = savedCourses.find((c) => sameStops(c.stopIds, course.stopIds));
    if (already) {
      setCopiedIds((prev) => new Set(prev).add(course.courseId));
      setSaveMessage({ text: `이미 담은 코스예요 — 내 코스의 '${already.name}'`, failed: false });
      return;
    }
    setCopyingId(course.courseId);
    setSaveMessage(null);
    try {
      const created = await coursesApi.create({
        name: course.ownerNickname ? `${course.name} (${course.ownerNickname})` : course.name,
        description: course.description ?? undefined,
        stopIds: course.stopIds.slice(0, 10),
      });
      setSavedCourses((prev) => [created, ...prev.filter((c) => c.courseId !== created.courseId)]);
      setCopiedIds((prev) => new Set(prev).add(course.courseId));
      setSaveMessage({ text: `'${course.name}'을(를) 내 코스에 담았어요`, failed: false });
    } catch (e) {
      setSaveMessage({ text: e instanceof Error ? e.message : '코스를 담지 못했어요', failed: true });
    } finally {
      setCopyingId((cur) => (cur === course.courseId ? null : cur));
    }
  };

  /**
   * 코스 공유 — 서버에서 코드를 받아 OS 공유 시트로 넘긴다.
   *
   * 링크는 웹 주소다(유니버설 링크가 아직 없다). 앱이 있는 사람은 아래 「공유 코드로 담기」에
   * 코드를 넣으면 되므로 코드도 글에 같이 적는다 — 링크만 주면 앱 사용자가 웹으로 튕긴다.
   */
  const [sharingId, setSharingId] = useState<number | null>(null);
  const shareCourse = async (course: SavedCourse) => {
    if (sharingId !== null) return;
    setSharingId(course.courseId);
    setSaveMessage(null);
    try {
      const code = await coursesApi.share(course.courseId);
      const message = `반갑꼬리 여행 코스 '${course.name}' (${course.stopIds.length}곳)\n${courseShareUrl(code)}\n\n앱에서 담기 → 여행 코스 → 공유 코드: ${code}`;
      try {
        await Share.share({ message });
      } catch {
        /**
         * 웹에서 `navigator.share`가 없거나(데스크톱 파이어폭스·비보안 컨텍스트) 사용자 제스처가
         * 만료되면(서버가 몇 초 걸린 뒤) 시트가 안 뜬다. 코드는 이미 발급됐으니 클립보드로
         * 넘기고 화면에 코드를 남긴다 — 아무 일도 안 일어나는 버튼이 되면 안 된다.
         */
        const copied = await copyText(message);
        setSaveMessage({
          text: copied ? `링크와 코드를 복사했어요 · 공유 코드 ${code}` : `공유 코드 ${code} — 여행 코스 화면에서 담을 수 있어요`,
          failed: false,
        });
      }
    } catch (e) {
      if (e instanceof ApiError) setSaveMessage({ text: e.message || '공유 코드를 받지 못했어요', failed: true });
    } finally {
      setSharingId(null);
    }
  };

  /**
   * 공유 코드로 담기. 링크(`?share=`)로 들어왔을 때도 같은 길을 탄다.
   * 이미 담은 코드를 또 넣으면 서버가 사본을 하나 더 만든다 — 그건 서버 정책이라 막지 않는다.
   */
  const [shareInput, setShareInput] = useState('');
  const [importing, setImporting] = useState(false);
  const importShared = async (raw: string): Promise<boolean> => {
    // 카톡 메시지를 통째로 붙여넣으면 링크에서 코드를 뽑는다
    const fromUrl = raw.match(/[?&]share=([^&\s]+)/);
    const code = decodeURIComponent((fromUrl ? fromUrl[1] : raw).trim());
    if (!code || importing) return false;
    setImporting(true);
    setSaveMessage(null);
    try {
      const created = await coursesApi.copyShared(code);
      setSavedCourses((prev) => [created, ...prev.filter((c) => c.courseId !== created.courseId)]);
      setShareInput('');
      setSaveMessage({ text: `'${created.name}'을(를) 내 코스에 담았어요`, failed: false });
      // 화면을 열며 나간 목록 조회가 늦게 도착하면 방금 담은 코스를 덮는다 — 다시 받아 맞춘다
      void reloadSaved().catch(() => {});
      return true;
    } catch (e) {
      const notFound = e instanceof ApiError && e.status === 404;
      setSaveMessage({
        text: notFound ? '그 코드의 코스를 찾지 못했어요. 코드를 다시 확인해 주세요.' : e instanceof Error ? e.message : '코스를 담지 못했어요',
        failed: true,
      });
      return false;
    } finally {
      setImporting(false);
    }
  };

  /**
   * 공유 링크(`?share=`)로 들어온 경우.
   *
   * 세션 복원이 끝나기 전에 담으면 토큰 없이 나가 401이 된다 — 이 화면의 이펙트가 스토어의
   * 복원보다 먼저 돌기 때문이다(개발 모드는 DEV_TOKEN이 가려 재현이 안 됐다). 복원이 끝나고
   * 로그인돼 있을 때만 담고, 시도한 뒤에는 **주소에서 파라미터를 지운다** — 남겨두면
   * 새로고침·재로그인마다 사본이 하나씩 더 생긴다.
   */
  const { share: shareParam } = useLocalSearchParams<{ share?: string | string[] }>();
  const shareCode = Array.isArray(shareParam) ? shareParam[0] : shareParam;
  const importedParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!shareCode || restoring || !session.authed || importedParamRef.current === shareCode) return;
    importedParamRef.current = shareCode;
    void importShared(shareCode).finally(() => router.setParams({ share: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, restoring, session.authed]);

  /** 이름만 바꾼다 — `PATCH /courses/{id}/name`. 스톱을 다시 보내는 PUT과 달리 가볍다 */
  const renameCourse = async (course: SavedCourse) => {
    const next = await promptText('코스 이름 바꾸기', '새 이름을 입력해 주세요 (30자 이내)', course.name);
    const name = next?.trim();
    if (!name || name === course.name) return;
    if (name.length > 30) {
      setSaveMessage({ text: '코스 이름은 30자 이내로 해 주세요', failed: true });
      return;
    }
    try {
      const updated = await coursesApi.rename(course.courseId, name);
      setSavedCourses((prev) => prev.map((c) => (c.courseId === updated.courseId ? updated : c)));
      setSaveMessage(null);
    } catch (e) {
      setSaveMessage({ text: e instanceof Error ? e.message : '이름을 바꾸지 못했어요', failed: true });
    }
  };

  /**
   * 내 코스를 공개/비공개로 바꾼다. 서버 `PUT /courses/{id}`는 부분 수정이 아니라 **전체 교체**라
   * 이름·설명·스톱을 그대로 다시 실어 보낸다 — 빠뜨리면 코스가 지워진 채로 저장된다.
   */
  const togglePublic = async (course: SavedCourse) => {
    const next = !course.isPublic;
    setPublicPendingId(course.courseId);
    setSaveMessage(null);
    try {
      // 토글 전용 엔드포인트. 이름·스톱을 다시 보내지 않으므로 스톱이 비어도 막히지 않는다.
      const updated = await coursesApi.setVisibility(course.courseId, next);
      setSavedCourses((prev) => prev.map((c) => (c.courseId === updated.courseId ? updated : c)));
      setSaveMessage({
        text: next ? `'${course.name}'을(를) 공개했어요` : `'${course.name}'을(를) 비공개로 바꿨어요`,
        failed: false,
      });
      // 공개로 바꾼 것만 XP가 붙는다(20 + 스톱 수 × 5, 코스당 평생 1회). 비공개로 되돌려도
      // 회수되지 않으니 그때는 다시 물을 이유가 없다.
      if (next) refreshGamification();
      // 둘러보기를 다시 부르지 않는다. 내 코스는 그 목록에서 걸러지므로 바뀔 게 없고,
      // 부르면 늦게 온 응답이 새 목록을 덮는 경합만 생긴다.
    } catch (e) {
      /**
       * COURSE4045 = 코스에 담긴 시설 전부에 판별 기록과 리뷰가 있어야 공개할 수 있다.
       * 서버 문구가 이미 그 뜻을 담고 있어 그대로 쓰되, 다음에 뭘 하면 되는지 덧붙인다.
       */
      const isNeedReview = e instanceof ApiError && e.code === 'COURSE4045';
      setSaveMessage({
        text: isNeedReview
          ? `${e.message}\n코스에 담긴 곳을 판별하고 리뷰를 남긴 뒤 다시 시도해 주세요.`
          : e instanceof Error
            ? e.message
            : '공개 설정을 바꾸지 못했어요',
        failed: true,
      });
    } finally {
      // 다른 코스의 토글이 이미 자리를 차지했으면 그쪽 스피너를 끄지 않는다
      setPublicPendingId((cur) => (cur === course.courseId ? null : cur));
    }
  };

  return {
    // 내 코스
    savedCourses,
    savingKey,
    saveMessage,
    /**
     * 안내 줄은 보관함 바깥에서도 쓴다 — 빌더가 "10곳까지 담을 수 있어요"를 같은 자리에
     * 띄운다. 코스 관련 안내가 화면 여기저기 흩어지지 않게 한 자리만 둔 것이라 setter를 연다.
     */
    setSaveMessage,
    saveCourse,
    removeCourse,
    renameCourse,
    // 둘러보기
    otherCourses,
    publicTotal,
    publicLoading,
    publicError,
    publicPendingId,
    copyingId,
    reloadPublic,
    copyPublicCourse,
    togglePublic,
    // 공유
    sharingId,
    shareCourse,
    shareInput,
    setShareInput,
    importing,
    importShared,
  };
}
