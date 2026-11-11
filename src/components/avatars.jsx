// 24 original flat avatars: 8 animals × hats and costumes. Drawn in a 64×64 box.

const EYES = (y = 37, dx = 5.5) => (
  <g>
    <circle cx={32 - dx} cy={y} r="2.1" fill="#1B1B22" />
    <circle cx={32 + dx} cy={y} r="2.1" fill="#1B1B22" />
    <circle cx={32 - dx + 0.7} cy={y - 0.7} r="0.7" fill="#fff" />
    <circle cx={32 + dx + 0.7} cy={y - 0.7} r="0.7" fill="#fff" />
  </g>
)

function spikes() {
  const pts = []
  const n = 15
  for (let i = 0; i <= n * 2; i++) {
    const t = Math.PI + (i / (n * 2)) * Math.PI * 1.0
    const r = i % 2 ? 15 : 21
    pts.push(`${(32 + r * Math.cos(t) * 1.05).toFixed(1)},${(40 + r * Math.sin(t)).toFixed(1)}`)
  }
  return pts.join(' ') + ' 52,46 12,46'
}
const SPIKES = spikes()

const ANIMALS = {
  bull: {
    name: 'Бык',
    draw: () => (
      <g>
        <path d="M21 31 C13 29 10 22 11 15 C15 21 20 24 25 26 Z" fill="#F3E3C3" />
        <path d="M43 31 C51 29 54 22 53 15 C49 21 44 24 39 26 Z" fill="#F3E3C3" />
        <ellipse cx="17" cy="35" rx="5" ry="3" fill="#7E4A2E" transform="rotate(-20 17 35)" />
        <ellipse cx="47" cy="35" rx="5" ry="3" fill="#7E4A2E" transform="rotate(20 47 35)" />
        <ellipse cx="32" cy="38" rx="14" ry="15" fill="#9A5B3A" />
        <ellipse cx="32" cy="47" rx="9.5" ry="6.5" fill="#E8B4A0" />
        <circle cx="28.5" cy="47" r="1.6" fill="#7E4A2E" />
        <circle cx="35.5" cy="47" r="1.6" fill="#7E4A2E" />
        {EYES(36)}
      </g>
    ),
  },
  bear: {
    name: 'Медведь',
    draw: () => (
      <g>
        <circle cx="20" cy="26" r="6.5" fill="#7A4E2D" />
        <circle cx="44" cy="26" r="6.5" fill="#7A4E2D" />
        <circle cx="20" cy="26" r="3.2" fill="#C8946A" />
        <circle cx="44" cy="26" r="3.2" fill="#C8946A" />
        <circle cx="32" cy="39" r="15.5" fill="#7A4E2D" />
        <ellipse cx="32" cy="45" rx="7.5" ry="6" fill="#C8946A" />
        <ellipse cx="32" cy="42.5" rx="3.2" ry="2.2" fill="#2B1B12" />
        {EYES(36)}
      </g>
    ),
  },
  wolf: {
    name: 'Волк',
    draw: () => (
      <g>
        <polygon points="18,32 20,14 30,25" fill="#6E7887" />
        <polygon points="46,32 44,14 34,25" fill="#6E7887" />
        <polygon points="20.5,28 21,19 26,25" fill="#D8DCE3" />
        <polygon points="43.5,28 43,19 38,25" fill="#D8DCE3" />
        <path d="M17 36 Q17 23 32 23 Q47 23 47 36 Q47 47 32 54 Q17 47 17 36 Z" fill="#8C96A3" />
        <path d="M24 40 Q32 56 40 40 Q32 45 24 40 Z" fill="#E9ECF1" />
        <ellipse cx="32" cy="44" rx="3" ry="2.1" fill="#1B1B22" />
        {EYES(35.5)}
      </g>
    ),
  },
  fox: {
    name: 'Лиса',
    draw: () => (
      <g>
        <polygon points="18,33 19,13 30,25" fill="#E07B39" />
        <polygon points="46,33 45,13 34,25" fill="#E07B39" />
        <polygon points="19,19 19,13 23.5,17" fill="#3A2A20" />
        <polygon points="45,19 45,13 40.5,17" fill="#3A2A20" />
        <path d="M16 36 Q16 23 32 23 Q48 23 48 36 Q48 47 32 54 Q16 47 16 36 Z" fill="#E07B39" />
        <path d="M17 39 Q23 52 32 53 Q41 52 47 39 Q40 45 32 45 Q24 45 17 39 Z" fill="#FFF7EE" />
        <ellipse cx="32" cy="47" rx="2.8" ry="2" fill="#1B1B22" />
        {EYES(36)}
      </g>
    ),
  },
  owl: {
    name: 'Сова',
    draw: () => (
      <g>
        <polygon points="18,27 20,15 26,23" fill="#7E5A35" />
        <polygon points="46,27 44,15 38,23" fill="#7E5A35" />
        <ellipse cx="32" cy="39" rx="16" ry="16.5" fill="#9C7246" />
        <circle cx="26" cy="37" r="7" fill="#F4E6CC" />
        <circle cx="38" cy="37" r="7" fill="#F4E6CC" />
        <circle cx="26" cy="37" r="3.4" fill="#1B1B22" />
        <circle cx="38" cy="37" r="3.4" fill="#1B1B22" />
        <circle cx="27" cy="36" r="1" fill="#fff" />
        <circle cx="39" cy="36" r="1" fill="#fff" />
        <polygon points="29.5,43 34.5,43 32,48" fill="#E8A23A" />
        <path d="M24 50 Q32 54 40 50" stroke="#7E5A35" strokeWidth="1.5" fill="none" />
      </g>
    ),
  },
  hedgehog: {
    name: 'Ёж',
    draw: () => (
      <g>
        <polygon points={SPIKES} fill="#5A4632" />
        <ellipse cx="32" cy="42" rx="13.5" ry="12" fill="#E8C9A0" />
        <ellipse cx="32" cy="47.5" rx="5.5" ry="4" fill="#F4DFC0" />
        <circle cx="32" cy="45.5" r="2.4" fill="#1B1B22" />
        <circle cx="23.5" cy="45" r="2" fill="#F2A7A0" opacity="0.7" />
        <circle cx="40.5" cy="45" r="2" fill="#F2A7A0" opacity="0.7" />
        {EYES(39.5, 5)}
      </g>
    ),
  },
  lion: {
    name: 'Лев',
    draw: () => (
      <g>
        {Array.from({ length: 14 }, (_, i) => {
          const t = (i / 14) * Math.PI * 2
          return <circle key={i} cx={32 + 17 * Math.cos(t)} cy={38 + 17 * Math.sin(t)} r="6" fill="#C97D1F" />
        })}
        <circle cx="32" cy="38" r="17" fill="#C97D1F" />
        <circle cx="32" cy="39" r="13" fill="#F2C46D" />
        <ellipse cx="32" cy="45" rx="6.5" ry="4.5" fill="#FBE3B0" />
        <polygon points="29.5,41.5 34.5,41.5 32,44.5" fill="#5A3A1E" />
        {EYES(36.5, 5)}
      </g>
    ),
  },
  rabbit: {
    name: 'Кролик',
    draw: () => (
      <g>
        <ellipse cx="25" cy="18" rx="4.5" ry="12" fill="#D9D6E0" transform="rotate(-8 25 18)" />
        <ellipse cx="39" cy="18" rx="4.5" ry="12" fill="#D9D6E0" transform="rotate(8 39 18)" />
        <ellipse cx="25" cy="18" rx="2" ry="8.5" fill="#F2B8C6" transform="rotate(-8 25 18)" />
        <ellipse cx="39" cy="18" rx="2" ry="8.5" fill="#F2B8C6" transform="rotate(8 39 18)" />
        <circle cx="32" cy="40" r="13.5" fill="#EDEBF2" />
        <ellipse cx="32" cy="43.5" rx="2.4" ry="1.7" fill="#E57B98" />
        <rect x="30.4" y="46" width="3.2" height="3.4" rx="0.8" fill="#fff" stroke="#C9C5D4" strokeWidth="0.6" />
        <circle cx="24" cy="45" r="2" fill="#F2B8C6" opacity="0.8" />
        <circle cx="40" cy="45" r="2" fill="#F2B8C6" opacity="0.8" />
        {EYES(38.5, 5)}
      </g>
    ),
  },
}

const ACCESSORIES = {
  tophat: {
    name: 'в цилиндре',
    draw: () => (
      <g>
        <rect x="22" y="5" width="20" height="17" rx="1.5" fill="#1F2430" />
        <rect x="22" y="17" width="20" height="3.5" fill="#C0264F" />
        <rect x="15" y="21" width="34" height="3.5" rx="1.75" fill="#1F2430" />
      </g>
    ),
  },
  crown: {
    name: 'в короне',
    draw: () => (
      <g>
        <polygon points="20,24 20,12 26,18 32,8 38,18 44,12 44,24" fill="#F5C542" stroke="#A97A00" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="32" cy="19" r="2" fill="#C0264F" />
      </g>
    ),
  },
  cap: {
    name: 'в кепке',
    draw: () => (
      <g>
        <path d="M17 26 Q18 10 32 10 Q46 10 47 26 Z" fill="#2E5BFF" />
        <path d="M30 24 L53 24 Q51 29 45 29 L30 28 Z" fill="#1E3FC4" />
        <circle cx="32" cy="10.5" r="1.8" fill="#1E3FC4" />
      </g>
    ),
  },
  bowler: {
    name: 'в котелке',
    draw: () => (
      <g>
        <path d="M21 23 Q21 8 32 8 Q43 8 43 23 Z" fill="#2B2B2B" />
        <rect x="21" y="19" width="22" height="2.6" fill="#7A3FB0" />
        <ellipse cx="32" cy="23" rx="15" ry="2.8" fill="#2B2B2B" />
      </g>
    ),
  },
  beret: {
    name: 'в берете',
    draw: () => (
      <g>
        <ellipse cx="29" cy="21" rx="15" ry="6.5" fill="#C0264F" transform="rotate(-8 29 21)" />
        <rect x="30" y="12" width="2" height="4" rx="1" fill="#C0264F" />
      </g>
    ),
  },
  party: {
    name: 'в праздничном колпаке',
    draw: () => (
      <g>
        <polygon points="23,23 41,23 34,2" fill="#7A3FB0" />
        <polygon points="27.6,13 38.2,13 37,9.6 29.4,9.6" fill="#F5C542" />
        <polygon points="25.4,19 40,19 39,16 26.4,16" fill="#3FD39A" />
        <circle cx="34" cy="3" r="2.6" fill="#F5C542" />
      </g>
    ),
  },
  cowboy: {
    name: 'в ковбойской шляпе',
    draw: () => (
      <g>
        <path d="M22 22 Q22 9 27 10 Q32 13 37 10 Q42 9 42 22 Z" fill="#8A5A2B" />
        <rect x="22" y="18" width="20" height="2.6" fill="#5A3A1E" />
        <path d="M10 21 Q32 30 54 21 Q52 26 32 27 Q12 26 10 21 Z" fill="#8A5A2B" />
      </g>
    ),
  },
  glasses: {
    name: 'в очках',
    draw: (y) => (
      <g fill="rgba(255,255,255,0.25)" stroke="#13213A" strokeWidth="2">
        <circle cx="26" cy={y} r="5" />
        <circle cx="38" cy={y} r="5" />
        <line x1="31" y1={y} x2="33" y2={y} />
      </g>
    ),
  },
  sunglasses: {
    name: 'в тёмных очках',
    draw: (y) => (
      <g>
        <rect x="19.5" y={y - 4} width="11" height="7.5" rx="3" fill="#13213A" />
        <rect x="33.5" y={y - 4} width="11" height="7.5" rx="3" fill="#13213A" />
        <rect x="30" y={y - 2.5} width="4" height="1.6" fill="#13213A" />
        <rect x="21.5" y={y - 3} width="3" height="1.5" rx="0.7" fill="#fff" opacity="0.5" />
      </g>
    ),
  },
  monocle: {
    name: 'с моноклем',
    draw: (y) => (
      <g>
        <circle cx="37.5" cy={y} r="5.5" fill="rgba(255,255,255,0.25)" stroke="#B8860B" strokeWidth="1.8" />
        <path d={`M42 ${y + 3} Q46 ${y + 10} 41 ${y + 17}`} stroke="#B8860B" strokeWidth="1" fill="none" />
      </g>
    ),
  },
  headphones: {
    name: 'в наушниках',
    draw: () => (
      <g>
        <path d="M14 38 Q14 13 32 13 Q50 13 50 38" stroke="#13213A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <rect x="10" y="32" width="8" height="13" rx="3.5" fill="#2E5BFF" />
        <rect x="46" y="32" width="8" height="13" rx="3.5" fill="#2E5BFF" />
      </g>
    ),
  },
  bowtie: {
    name: 'с бабочкой',
    draw: () => (
      <g>
        <polygon points="22,53 32,57 22,62" fill="#C0264F" />
        <polygon points="42,53 32,57 42,62" fill="#C0264F" />
        <circle cx="32" cy="57" r="2.4" fill="#8E1B3A" />
      </g>
    ),
  },
  tie: {
    name: 'в галстуке',
    draw: () => (
      <g>
        <polygon points="29,53 35,53 34,56 30,56" fill="#13213A" />
        <polygon points="30,56 34,56 36,64 28,64" fill="#2E5BFF" />
      </g>
    ),
  },
}

const EYE_Y = { bull: 36, bear: 36, wolf: 35.5, fox: 36, owl: 37, hedgehog: 39.5, lion: 36.5, rabbit: 38.5 }
const BG = ['#DCE4FF', '#FFE3D3', '#D9F2E6', '#FFF1C2', '#F3DFFF', '#D7EEF7', '#FFD9E2', '#E6E9EF']

export const AVATARS = [
  ['bull', 'tophat'], ['bear', 'crown'], ['wolf', 'sunglasses'], ['fox', 'beret'],
  ['owl', 'glasses'], ['hedgehog', 'cap'], ['lion', 'bowtie'], ['rabbit', 'party'],
  ['bull', 'headphones'], ['bear', 'bowler'], ['wolf', 'cap'], ['fox', 'tophat'],
  ['owl', 'bowtie'], ['hedgehog', 'party'], ['lion', 'sunglasses'], ['rabbit', 'glasses'],
  ['bull', 'cowboy'], ['bear', 'tie'], ['wolf', 'headphones'], ['fox', 'bowtie'],
  ['owl', 'crown'], ['hedgehog', 'bowler'], ['lion', 'monocle'], ['rabbit', 'bowtie'],
].map(([animal, acc], i) => ({ animal, acc, bg: BG[(i * 3) % BG.length], label: `${ANIMALS[animal].name} ${ACCESSORIES[acc].name}` }))

export function Avatar({ id = 0, size = 40, title }) {
  const a = AVATARS[((id % AVATARS.length) + AVATARS.length) % AVATARS.length]
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title || a.label}>
      <circle cx="32" cy="32" r="32" fill={a.bg} />
      <g clipPath="url(#avatar-clip)">
        {ANIMALS[a.animal].draw()}
        {ACCESSORIES[a.acc].draw(EYE_Y[a.animal])}
      </g>
      <defs>
        <clipPath id="avatar-clip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
    </svg>
  )
}
