import { PhotoPicker } from '@/components/photo-picker';

/**
 * 사업자등록증 사진 — 매장 등록 신청의 필수 첨부.
 *
 * 진위확인(번호·대표자명·개업일)은 "이 사람이 그 사업자와 관계있다"까지만 증명하고
 * "그 사업자 = 이 매장"은 증명하지 못한다. 운영자가 등록증을 보고 승인해야 남의 매장을
 * 먼저 등록해 진짜 사장을 막는 일이 없어진다(백엔드 이슈 #83). 서버가 저장하고, 앱은 올린 뒤
 * 경로를 남기지 않는다.
 */
export function CertificatePicker({ uri, onChange }: { uri: string | null; onChange: (uri: string | null) => void }) {
  return <PhotoPicker uri={uri} onChange={onChange} />;
}
