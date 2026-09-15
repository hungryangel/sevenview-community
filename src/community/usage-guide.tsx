import { SectionIntro } from "./landing-primitives"

const steps = [
  [
    "사진을 선택하세요",
    "앱의 ‘사진 파일 선택’에서 같은 촬영 세트의 사진을 불러온 뒤 ‘AI 자동 정렬’을 누르세요. 7장을 모두 채울 필요는 없습니다. 빠진 구도는 직접 확인하세요.",
  ],
  [
    "자동 제안을 검토하세요",
    "정면·좌우 45도·좌우 측면·턱 밑·정수리의 분류와 크롭을 살펴보세요. 사진을 선택하면 위치·배율·수평을 조정할 수 있습니다. 인식이 어려운 사진은 수동으로 맞추세요.",
  ],
  [
    "필요하면 전후를 비교하세요",
    "‘치료 전후 비교’에서 전·후 사진을 한 장씩 선택하고 ‘두 사진 정렬’을 누르세요. 같은 부위가 맞는지 확인한 뒤 나란히·슬라이더·전후 전환으로 비교하세요.",
  ],
  [
    "결과물을 저장하세요",
    "7뷰 결과는 PNG·PDF·PPTX와 개별 사진 ZIP으로 저장할 수 있습니다. 전후 비교의 ‘비교 이미지 저장’에서는 PNG 또는 설명용 HTML을 선택하세요. 다운로드 파일을 확인한 뒤 다음 세트를 시작하세요.",
  ],
] as const

export function UsageGuide({ repositoryUrl }: { readonly repositoryUrl: string | null }) {
  return (
    <section className="sv-band" id="workflow">
      <div className="sv-container sv-two-column">
        <SectionIntro
          number="02 / HOW TO USE"
          title="처음이라면, 이 순서로 해보세요."
          description="예시 사진으로 먼저 익힌 뒤, 기관의 동의·보관 정책에 맞는 사진을 사용하세요."
        />
        <div>
          <ol className="sv-steps">
            {steps.map(([title, body], index) => (
              <li key={title}>
                <span className="sv-step-number">0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <a className="sv-text-link" href="/examples/01-front.png" download>
            합성 예시 사진 다운로드
          </a>
          {repositoryUrl === null ? null : (
            <p>
              <a className="sv-text-link" href={`${repositoryUrl}/tree/main/public/examples`}>
                7방향 예시 사진 전체 보기
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
