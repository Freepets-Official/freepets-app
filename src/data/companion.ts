import type { Href } from 'expo-router';

import type { WalkWeather } from '@/lib/weather';
import { ymd, type CalendarEvent, type Pet } from '@/data/types';

/**
 * 홈 「꼬리 친구」 말풍선 — 무엇을 어떤 순서로 말할지 정하는 규칙.
 *
 * 화면과 떼어 순수 함수로 둔다. 순서 규칙이 이 앱 홈의 핵심이라, 화면을 띄우지 않고도
 * 같은 입력에 같은 순서가 나오는지 확인할 수 있어야 한다.
 *
 * 순서 원칙
 * 1. **아이마다 가장 급한 소식을 하나씩 먼저** 돈다(급한 순). 한 아이의 소식 셋이 줄줄이 나와
 *    다른 아이의 급한 소식이 뒤로 밀리면 안 된다 — 여러 마리를 키우는 집의 실제 불만이다.
 * 2. **날씨는 첫 소식 바로 다음**에 끼운다. 홈을 열면 급한 것부터 듣고, 몇 초 뒤 오늘 산책
 *    날씨를 듣는다. 급한 소식이 없으면 날씨가 먼저다.
 * 3. 그다음 나머지 소식을 급한 순으로.
 *
 * 영양제 같은 돌봄 이야기는 내용이 정해지면 `kind: 'care'`로 3번 자리에 들어간다.
 */
export type Speaker = 'dog' | 'cat';
export type Mood = 'idle' | 'happy' | 'alert' | 'worried';
export type WeatherProp = 'sparkles' | 'rain' | 'umbrella' | 'mask' | 'scarf' | 'heat';
export type NewsKind =
  | 'denial'
  | 'vaccine'
  | 'med'
  | 'checkup'
  | 'trip'
  | 'care'
  | 'weather'
  | 'weather-off'
  | 'welcome'
  | 'calm';

export type CompanionAction =
  | { kind: 'route'; label: string; href: Href }
  | { kind: 'med-taken'; label: string; eventId: number; date: string }
  | { kind: 'enable-location'; label: string };

export type ChipTone = 'good' | 'mid' | 'bad' | 'plain';
export interface WeatherChip {
  icon: string;
  label: string;
  tone: ChipTone;
}

export interface CompanionMessage {
  /** 소식이 같으면 id도 같다 — 목록을 다시 짜도 지금 보던 말을 이어서 보여주려고 */
  id: string;
  kind: NewsKind;
  /** 작을수록 급하다. 0 실시간 거부 · 1 기한 지난 접종 · 2 오늘 할 일 · 3 날씨 · 4 여행 · 6 여유 */
  priority: number;
  /** 누구 소식인지. 비어 있으면 모두에게 해당 */
  petIds: number[];
  speaker: Speaker;
  mood: Mood;
  /** 말풍선 오른쪽 위 꼬리표 */
  tag: string;
  text: string;
  actions: CompanionAction[];
  props?: WeatherProp[];
  chips?: WeatherChip[];
}

export interface DenialNews {
  facilityId: number;
  facilityName: string;
  /** 거부 사유 한글 라벨(체중 초과 등). 모르면 null */
  reasonLabel: string | null;
  createdAt: string;
  /** 이 시설을 판별했던 아이들 */
  petIds: number[];
}

export type WeatherState =
  | { status: 'ready'; data: WalkWeather }
  | { status: 'no-permission' }
  | { status: 'loading' }
  | { status: 'error' };

export interface CompanionInput {
  now: Date;
  pets: Pet[];
  denials: DenialNews[];
  vaccinations: { pet: Pet; dday: number; date: string }[];
  /** 그날 일정(반복 반영) — 스토어의 `eventsOn` */
  eventsOn: (date: string) => CalendarEvent[];
  isMedTaken: (eventId: number, date: string) => boolean;
  weather: WeatherState;
}

/* ───────── 한국어 조사 ───────── */

/** 마지막 글자에 받침이 있는가. 한글이 아니면 받침 없음으로 본다(“Coco야”) */
export function hasBatchim(word: string): boolean {
  const c = word.charCodeAt(word.length - 1);
  if (Number.isNaN(c) || c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
/** 부르는 말 — 몽이야 · 콩아 */
export const callName = (name: string) => `${name}${hasBatchim(name) ? '아' : '야'}`;
const eunNeun = (w: string) => `${w}${hasBatchim(w) ? '은' : '는'}`;
const iGa = (w: string) => `${w}${hasBatchim(w) ? '이' : '가'}`;

const petName = (pets: Pet[], ids: number[]) =>
  ids
    .map((id) => pets.find((p) => p.petId === id)?.name)
    .filter((n): n is string => !!n)
    .join('·');

const speakerOf = (pets: Pet[], ids: number[]): Speaker => {
  const lead = pets.find((p) => p.petId === ids[0]);
  return lead?.kind === 'CAT' ? 'cat' : 'dog';
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const dayDiff = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
const monthDay = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
const whenWord = (dday: number) => (dday === 0 ? '오늘' : dday === 1 ? '내일' : dday === 2 ? '모레' : `${dday}일 뒤`);

/** "19:30" → "오후 7시 30분". 말풍선은 말투라 24시 표기가 어색하다 */
export function clockWord(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const half = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h === 12 ? '낮' : half} ${h12}시${m ? ` ${m}분` : ''}`;
}

function ago(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(min)) return '최근';
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

/* ───────── 소식 만들기 ───────── */

function denialNews(input: CompanionInput): CompanionMessage[] {
  return input.denials.map((d) => {
    const ids = d.petIds.filter((id) => input.pets.some((p) => p.petId === id));
    const names = petName(input.pets, ids);
    const reason = d.reasonLabel ? ` (${d.reasonLabel})` : '';
    return {
      id: `denial-${d.facilityId}`,
      kind: 'denial',
      priority: 0,
      petIds: ids,
      speaker: speakerOf(input.pets, ids),
      mood: 'alert',
      tag: '실시간 거부',
      text: `${names ? `${callName(names)}, ` : ''}${d.facilityName}에 ${ago(d.createdAt, input.now)} 출입 거부 제보가 들어왔어${reason}. 가기 전에 꼭 확인하자!`,
      actions: [
        { kind: 'route', label: '자세히 보기', href: { pathname: '/facility/[id]', params: { id: String(d.facilityId) } } },
        { kind: 'route', label: '다른 곳 찾기', href: '/(tabs)/explore' },
      ],
    };
  });
}

function vaccineNews(input: CompanionInput): CompanionMessage[] {
  return input.vaccinations.map(({ pet, dday, date }) => {
    const call = callName(pet.name);
    const base = {
      id: `vax-${pet.petId}`,
      kind: 'vaccine' as const,
      petIds: [pet.petId],
      speaker: (pet.kind === 'CAT' ? 'cat' : 'dog') as Speaker,
      actions: [
        { kind: 'route' as const, label: '캘린더 보기', href: '/(tabs)/calendar' as Href },
        { kind: 'route' as const, label: '접종일 고치기', href: '/(tabs)/pets' as Href },
      ],
    };
    if (dday < 0)
      return { ...base, priority: 1, mood: 'worried' as Mood, tag: '접종 지남', text: `${call}, 접종 날짜가 ${-dday}일 지났어. 병원 예약해 둘까?` };
    if (dday === 0)
      return { ...base, priority: 1, mood: 'alert' as Mood, tag: '오늘 접종', text: `${call}, 오늘이 접종 날이야! 잊지 말고 병원 다녀오자.` };
    if (dday <= 3)
      return { ...base, priority: 2, mood: 'idle' as Mood, tag: `접종 D-${dday}`, text: `${call}, ${dday}일 뒤에 접종이 있어. 미리 예약해 두면 편해!` };
    return { ...base, priority: 6, mood: 'idle' as Mood, tag: `접종 D-${dday}`, text: `${call}, 다음 접종은 ${monthDay(date)}이야. 아직 여유 있어!` };
  });
}

/** 오늘 먹어야 하는데 아직 체크 안 한 약 */
function medNews(input: CompanionInput, today: string): CompanionMessage[] {
  const hhmm = `${String(input.now.getHours()).padStart(2, '0')}:${String(input.now.getMinutes()).padStart(2, '0')}`;
  return input
    .eventsOn(today)
    .filter((e) => e.type === 'MED' && !input.isMedTaken(e.eventId, today))
    .map((e) => {
      const ids = e.petId !== null ? [e.petId] : input.pets.map((p) => p.petId);
      const names = petName(input.pets, ids);
      const late = !!e.time && e.time <= hhmm;
      const tail = !e.time ? '잊지 말고 챙겨 줘!' : late ? `벌써 ${iGa(clockWord(e.time))} 지났어!` : `${clockWord(e.time)}에 챙겨 줘!`;
      return {
        id: `med-${e.eventId}-${today}`,
        kind: 'med',
        priority: 2,
        petIds: ids,
        speaker: speakerOf(input.pets, ids),
        mood: late ? 'worried' : 'idle',
        tag: '오늘 약',
        text: `${names ? `${callName(names)}, ` : ''}오늘 ${eunNeun(e.title)} 아직이야. ${tail}`,
        actions: [
          { kind: 'med-taken', label: '먹였어요', eventId: e.eventId, date: today },
          { kind: 'route', label: '캘린더', href: '/(tabs)/calendar' },
        ],
      } satisfies CompanionMessage;
    });
}

/** 며칠 안의 검진·여행. 반복 일정이 매일 걸려도 같은 일정은 한 번만 */
function upcomingNews(input: CompanionInput, today: string): CompanionMessage[] {
  const out: CompanionMessage[] = [];
  const seen = new Set<number>();
  for (let i = 0; i <= 7; i++) {
    const date = ymd(addDays(input.now, i));
    for (const e of input.eventsOn(date)) {
      if (seen.has(e.eventId)) continue;
      if (e.type === 'CHECKUP' && i <= 3) {
        seen.add(e.eventId);
        const ids = e.petId !== null ? [e.petId] : [];
        const names = petName(input.pets, ids);
        out.push({
          id: `checkup-${e.eventId}-${date}`,
          kind: 'checkup',
          priority: i === 0 ? 2 : 3,
          petIds: ids,
          speaker: speakerOf(input.pets, ids),
          mood: 'idle',
          tag: i === 0 ? '오늘 검진' : `검진 D-${i}`,
          text: `${names ? `${callName(names)}, ` : ''}${whenWord(i)}${e.time ? ` ${clockWord(e.time)}` : ''}에 ${e.title} 일정이 있어. 수첩 챙겨 가자!`,
          actions: [{ kind: 'route', label: '캘린더', href: '/(tabs)/calendar' }],
        });
      }
      if (e.type === 'TRAVEL') {
        seen.add(e.eventId);
        // 여행은 기간 일정이라 중간 날에도 걸린다. 시작일이 지났으면 "여행 중"이다
        const ongoing = e.date <= today;
        const dday = dayDiff(today, e.date);
        out.push({
          id: `trip-${e.eventId}`,
          kind: 'trip',
          priority: ongoing ? 2 : 4,
          petIds: e.petId !== null ? [e.petId] : [],
          speaker: 'dog',
          mood: 'happy',
          tag: ongoing ? '여행 중' : dday === 0 ? '오늘 출발' : `여행 D-${dday}`,
          text: ongoing
            ? `${e.title} 여행 중이구나! 들어가기 전에 출입 판별부터 해 줄게.`
            : `${whenWord(dday)} ${e.title}! 들를 곳을 미리 판별해 둘까?`,
          actions: [
            { kind: 'route', label: '판별하러 가기', href: '/(tabs)/explore' },
            { kind: 'route', label: '여행 코스', href: '/course' },
          ],
        });
      }
    }
  }
  return out;
}

/* ───────── 산책 날씨 ───────── */

/** 환경부 기준 미세먼지 등급 — PM10과 PM2.5 중 나쁜 쪽 */
export function airGrade(pm10: number | null, pm25: number | null): 0 | 1 | 2 | 3 | null {
  if (pm10 === null && pm25 === null) return null;
  const g10 = pm10 === null ? 0 : pm10 <= 30 ? 0 : pm10 <= 80 ? 1 : pm10 <= 150 ? 2 : 3;
  const g25 = pm25 === null ? 0 : pm25 <= 15 ? 0 : pm25 <= 35 ? 1 : pm25 <= 75 ? 2 : 3;
  return Math.max(g10, g25) as 0 | 1 | 2 | 3;
}
const AIR_LABEL = ['좋음', '보통', '나쁨', '매우 나쁨'] as const;

/** WMO 코드 → 하늘 */
export function sky(code: number, isDay: boolean): { icon: string; label: string } {
  if (code >= 95) return { icon: 'thunderstorm-outline', label: '뇌우' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'snow-outline', label: '눈' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: 'rainy-outline', label: '비' };
  if (code === 45 || code === 48) return { icon: 'cloud-outline', label: '안개' };
  if (code === 3) return { icon: 'cloud-outline', label: '흐림' };
  if (code === 2) return { icon: isDay ? 'partly-sunny-outline' : 'cloudy-night-outline', label: '구름 조금' };
  return { icon: isDay ? 'sunny-outline' : 'moon-outline', label: '맑음' };
}

export type WalkVerdict = 'good' | 'caution' | 'stay';

export interface WalkAdvice {
  verdict: WalkVerdict;
  mood: Mood;
  text: string;
  props: WeatherProp[];
  chips: WeatherChip[];
}

/**
 * 오늘 산책해도 되는지.
 *
 * 가장 나쁜 이유 **하나만** 말한다. "비도 오고 미세먼지도 나쁘고 바람도…"를 다 늘어놓으면
 * 말풍선이 길어져 읽지 않는다. 순서는 위험한 것부터 — 뇌우 > 지금 오는 비·눈 > 미세먼지 >
 * 폭염·한파 > 이따 올 비 > 바람·자외선.
 *
 * 개가 없는 집(고양이·새·토끼…)은 산책하지 않으니 같은 날씨를 **집 안 이야기**로 바꿔 말한다.
 */
export function walkAdvice(w: WalkWeather, walkers: boolean): WalkAdvice {
  const t = Math.round(w.temp);
  const feels = Math.round(w.feels);
  const s = sky(w.code, w.isDay);
  const air = airGrade(w.pm10, w.pm25);
  const rainingNow = w.precipNow > 0 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82);
  const heavyNow = w.precipNow >= 3 || w.code === 65 || w.code === 82 || w.code === 67;
  const snowing = (w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86;

  const chips: WeatherChip[] = [{ icon: s.icon, label: `${s.label} ${t}°`, tone: 'plain' }];
  if (air !== null)
    chips.push({ icon: 'leaf-outline', label: `미세먼지 ${AIR_LABEL[air]}`, tone: air === 0 ? 'good' : air === 1 ? 'mid' : 'bad' });
  if (w.rainChance > 0) chips.push({ icon: 'water-outline', label: `비 ${w.rainChance}%`, tone: 'plain' });

  let verdict: WalkVerdict = 'good';
  let dog = '';
  let indoor = '';
  const props: WeatherProp[] = [];

  if (w.code >= 95) {
    verdict = 'stay';
    dog = '천둥번개가 치고 있어. 오늘은 집에서 꼭 붙어 있자.';
    indoor = '천둥이 치는 날엔 숨을 곳이 필요해. 조용한 자리를 만들어 줘.';
    props.push('rain', 'umbrella');
  } else if (rainingNow || snowing) {
    verdict = heavyNow ? 'stay' : 'caution';
    dog = snowing
      ? '눈이 와! 짧게 놀고 들어와서 발 사이 눈 뭉치를 꼭 털어 주자.'
      : heavyNow
        ? '지금 비가 많이 와. 오늘은 집에서 공 던지기 하며 놀자!'
        : '지금 비가 조금 와. 우비 입고 짧게 다녀오자!';
    indoor = '비 오는 날엔 창밖 구경이 최고야. 빗소리 들으며 낮잠 어때?';
    props.push(snowing ? 'scarf' : 'umbrella', 'rain');
  } else if (air !== null && air >= 2) {
    verdict = 'stay';
    dog =
      air === 3
        ? '미세먼지가 매우 나빠. 창문도 닫고 오늘은 집에서 노즈워크 하자.'
        : '미세먼지가 나빠. 오늘은 집에서 노즈워크 하면서 놀자.';
    indoor = '공기가 탁한 날이야. 창문은 닫고 장난감으로 놀아 줘!';
    props.push('mask');
  } else if (feels >= 30) {
    verdict = feels >= 35 ? 'stay' : 'caution';
    dog =
      feels >= 35
        ? `체감 ${feels}도 폭염이야. 바닥이 뜨거우니 해 지고 나가자.`
        : `${t}도라 아스팔트가 뜨거워. 발바닥 데지 않게 저녁에 나가자.`;
    indoor = '더운 날이야. 시원한 물 자주 갈아 주고 그늘 자리 만들어 줘.';
    props.push('heat');
  } else if (feels <= 0) {
    verdict = feels <= -10 ? 'stay' : 'caution';
    // 칩에는 실제 기온이 찍히므로, 체감으로 말할 땐 "체감"을 붙여 숫자가 어긋나 보이지 않게 한다
    const label = `${Math.abs(feels - t) >= 2 ? '체감 ' : ''}${feels === 0 ? '0도' : `영하 ${-feels}도`}`;
    dog =
      feels <= -10
        ? `${label} 한파야. 오늘은 실내에서 놀자.`
        : `${label}야. 옷 입고 15분만 짧게 걷자. 다녀와서 발 닦아 주기!`;
    indoor = '추운 날엔 따뜻한 담요가 최고야. 포근한 자리 하나 깔아 줘.';
    props.push('scarf');
  } else if (w.rainChance >= 60) {
    verdict = 'caution';
    const when = w.rainHour !== null ? `${clockWord(`${w.rainHour}:00`)}쯤` : '이따가';
    dog = `${when} 비 소식(${w.rainChance}%)이 있어. 산책은 그 전에 다녀오자!`;
    indoor = `${when} 비가 온대. 창문 단속하고 포근하게 있자.`;
    props.push('umbrella');
  } else if (w.windKmh >= 35) {
    verdict = 'caution';
    dog = '바람이 세게 불어. 작은 친구는 짧게만 걷자.';
    indoor = '바람 부는 날이야. 창문 틈 바람 조심!';
  } else if (w.isDay && w.uvMax !== null && w.uvMax >= 8) {
    verdict = 'caution';
    dog = '자외선이 아주 강해. 한낮은 피하고 아침저녁으로 걷자.';
    indoor = '햇살이 아주 강해. 창가 자리는 커튼으로 살짝 가려 줘.';
    props.push('sparkles');
  } else {
    const airWord = air === 0 ? ' 공기도 깨끗해' : '';
    dog = w.isDay
      ? `오늘 ${t}도에 ${s.label === '맑음' ? '맑고' : `${s.label}이고`}${airWord}! 산책하기 딱 좋은 날이야.`
      : `선선한 밤이야${airWord ? ',' + airWord : ''}. 밝은 길로 가볍게 걷고 오자!`;
    indoor = w.isDay
      ? '햇살 좋은 날이야. 창가 자리 비워 두면 좋아할 거야.'
      : '조용한 밤이야. 오늘도 같이 놀아 줘서 고마워.';
    if (w.isDay) props.push('sparkles');
  }

  if (walkers)
    chips.push({
      icon: 'paw-outline',
      label: verdict === 'good' ? '산책 좋음' : verdict === 'caution' ? '짧게 산책' : '실내 놀이',
      tone: verdict === 'good' ? 'good' : verdict === 'caution' ? 'mid' : 'bad',
    });

  return {
    verdict,
    mood: verdict === 'good' ? 'happy' : verdict === 'stay' ? 'worried' : 'idle',
    text: walkers ? dog : indoor,
    props,
    chips,
  };
}

function weatherNews(input: CompanionInput, scoped: Pet[]): CompanionMessage | null {
  // 개가 하나라도 있으면 산책 이야기, 없으면 집 안 이야기를 고양이가 한다.
  // 아직 아이가 없으면 대부분 강아지 보호자라 산책 쪽으로 말한다
  const walkers = scoped.length === 0 || scoped.some((p) => p.kind === 'DOG');
  const speaker: Speaker = walkers || scoped.length === 0 || scoped.some((p) => p.kind !== 'CAT') ? 'dog' : 'cat';
  if (input.weather.status === 'no-permission')
    return {
      id: 'weather-off',
      kind: 'weather-off',
      priority: 7,
      petIds: [],
      speaker,
      mood: 'idle',
      tag: '오늘 날씨',
      text: walkers
        ? '위치를 허락해 주면 오늘 산책하기 좋은 날씨인지 알려 줄게!'
        : '위치를 허락해 주면 오늘 날씨에 맞춰 집에서 챙길 걸 알려 줄게!',
      actions: [{ kind: 'enable-location', label: '위치 켜기' }],
    };
  if (input.weather.status !== 'ready') return null;
  const a = walkAdvice(input.weather.data, walkers);
  return {
    id: 'weather',
    kind: 'weather',
    priority: 3,
    petIds: [],
    speaker,
    mood: a.mood,
    tag: walkers ? '산책 날씨' : '오늘 날씨',
    text: a.text,
    actions: [],
    props: a.props,
    chips: a.chips,
  };
}

/** 말풍선에 올릴 순서. `focusPetId`가 있으면 그 아이 소식(과 모두의 소식)만 */
export function buildCompanionQueue(input: CompanionInput, focusPetId: number | null): CompanionMessage[] {
  const today = ymd(input.now);
  const scoped = focusPetId === null ? input.pets : input.pets.filter((p) => p.petId === focusPetId);

  if (input.pets.length === 0) {
    const wx = weatherNews(input, []);
    return [
      {
        id: 'welcome',
        kind: 'welcome',
        priority: 0,
        petIds: [],
        speaker: 'dog',
        mood: 'happy',
        tag: '반가워요',
        text: '안녕! 같이 다닐 친구를 등록해 주면, 갈 곳마다 들어갈 수 있는지 먼저 알려 줄게.',
        actions: [{ kind: 'route', label: '아이 등록하기', href: '/(tabs)/pets' }],
      },
      ...(wx ? [wx] : []),
    ];
  }

  const all = [...denialNews(input), ...vaccineNews(input), ...medNews(input, today), ...upcomingNews(input, today)];
  const news = all.filter(
    (m) => focusPetId === null || m.petIds.length === 0 || m.petIds.includes(focusPetId),
  );

  // 아이별로 묶는다. 여럿의 소식은 맨 앞 아이 몫, 모두의 소식(여행 등)은 따로 한 묶음
  const groups = new Map<number, CompanionMessage[]>();
  for (const m of news) {
    const key = m.petIds[0] ?? 0;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const byUrgency = (a: CompanionMessage, b: CompanionMessage) => a.priority - b.priority;
  const heads: CompanionMessage[] = [];
  const rest: CompanionMessage[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort(byUrgency);
    heads.push(sorted[0]);
    rest.push(...sorted.slice(1));
  }
  heads.sort(byUrgency);
  rest.sort(byUrgency);

  const queue = [...heads];
  const wx = weatherNews(input, scoped);
  if (wx) queue.splice(Math.min(1, queue.length), 0, wx);
  queue.push(...rest);

  if (heads.length === 0)
    queue.push({
      id: 'calm',
      kind: 'calm',
      priority: 9,
      petIds: [],
      speaker: scoped.every((p) => p.kind === 'CAT') ? 'cat' : 'dog',
      mood: 'happy',
      tag: '오늘',
      text: '오늘은 급한 소식이 없어! 갈 곳이 생기면 들어갈 수 있는지 먼저 판별해 줄게.',
      actions: [{ kind: 'route', label: '판별하러 가기', href: '/(tabs)/explore' }],
    });

  // 말풍선을 끝없이 넘기게 하지 않는다. 일곱 개를 넘는 소식은 알림 페이지에 있다
  return queue.slice(0, 7);
}

/* ───────── 「다음 일정」 타일 ───────── */

export interface NextSchedule {
  event: CalendarEvent;
  /** 그 일정이 걸린 날(YYYY-MM-DD) */
  date: string;
  dday: number;
  isTrip: boolean;
  /** 여행 기간 안에 있다 */
  ongoing: boolean;
}

/**
 * 다음 여행, 없으면 가장 가까운 다음 일정.
 *
 * 매일 반복하는 일정(매일 약)은 뒤로 미룬다. 그대로 두면 이 타일이 영원히 "오늘 · 약"만
 * 보여줘 다음 일정 자리로서 쓸모가 없다 — 약은 말풍선과 건강 타일이 이미 챙긴다.
 * 다른 일정이 하나도 없을 때만 매일 일정을 보여준다.
 */
export function nextSchedule(
  eventsOn: (date: string) => CalendarEvent[],
  now: Date,
  horizonDays = 60,
): NextSchedule | null {
  const today = ymd(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let firstAny: NextSchedule | null = null;
  let firstDaily: NextSchedule | null = null;
  for (let i = 0; i <= horizonDays; i++) {
    const date = ymd(addDays(now, i));
    const events = [...eventsOn(date)].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    for (const e of events) {
      if (e.type === 'TRAVEL') {
        const ongoing = e.date <= today;
        return { event: e, date: ongoing ? today : e.date, dday: ongoing ? 0 : dayDiff(today, e.date), isTrip: true, ongoing };
      }
      // 오늘 이미 지난 시각의 일정은 "다음" 일정이 아니다
      if (i === 0 && e.time && e.time < hhmm) continue;
      const item: NextSchedule = { event: e, date, dday: i, isTrip: false, ongoing: false };
      if (e.repeat === 'DAILY') firstDaily ??= item;
      else firstAny ??= item;
    }
  }
  return firstAny ?? firstDaily;
}
