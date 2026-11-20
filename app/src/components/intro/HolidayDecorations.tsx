import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export type HolidayType = 'halloween' | 'christmas' | 'newyear' | 'cny' | 'valentines' | 'none';

/**
 * Determine the active holiday based on current date (or manual override).
 */
export function getActiveHoliday(override?: string | null): HolidayType {
  if (override && ['halloween', 'christmas', 'newyear', 'cny', 'valentines', 'none'].includes(override)) {
    return override as HolidayType;
  }

  // Check URL query param ?holiday=... for instant previewing/testing
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const hParam = params.get('holiday');
    if (hParam && ['halloween', 'christmas', 'newyear', 'cny', 'valentines', 'none'].includes(hParam)) {
      return hParam as HolidayType;
    }
  }

  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 9=Oct, 10=Nov, 11=Dec
  const day = now.getDate();

  // 1. Halloween: Oct 12 - Nov 3
  if ((month === 9 && day >= 12) || (month === 10 && day <= 3)) {
    return 'halloween';
  }

  // 2. Christmas: Dec 1 - Dec 27
  if (month === 11 && day >= 1 && day <= 27) {
    return 'christmas';
  }

  // 3. New Year Celebration: Dec 28 - Jan 5
  if ((month === 11 && day >= 28) || (month === 0 && day <= 5)) {
    return 'newyear';
  }

  // 4. Valentine's Day: Feb 10 - Feb 16
  if (month === 1 && day >= 10 && day <= 16) {
    return 'valentines';
  }

  // 5. Chinese New Year / Spring Festival: Jan 15 - Feb 25 (Approx lunar window)
  if ((month === 0 && day >= 15) || (month === 1 && day <= 25)) {
    return 'cny';
  }

  return 'none';
}

/**
 * Calculates Chinese Zodiac Animal for a given year.
 */
export function getChineseZodiac(year: number) {
  // 12 animals cycle: 2024 = Dragon, 2025 = Snake, 2026 = Horse, etc.
  const animals = [
    { name: 'Monkey', zh: '猴', title: 'Year of the Monkey', blessing: '金猴献瑞' },
    { name: 'Rooster', zh: '鸡', title: 'Year of the Rooster', blessing: '金鸡报晓' },
    { name: 'Dog', zh: '狗', title: 'Year of the Dog', blessing: '金犬迎春' },
    { name: 'Pig', zh: '猪', title: 'Year of the Pig', blessing: '金猪纳福' },
    { name: 'Rat', zh: '鼠', title: 'Year of the Rat', blessing: '金鼠呈祥' },
    { name: 'Ox', zh: '牛', title: 'Year of the Ox', blessing: '金牛奋蹄' },
    { name: 'Tiger', zh: '虎', title: 'Year of the Tiger', blessing: '虎虎生威' },
    { name: 'Rabbit', zh: '兔', title: 'Year of the Rabbit', blessing: '玉兔迎春' },
    { name: 'Dragon', zh: '龙', title: 'Year of the Dragon', blessing: '龙腾万里' },
    { name: 'Snake', zh: '蛇', title: 'Year of the Snake', blessing: '金蛇狂舞' },
    { name: 'Horse', zh: '马', title: 'Year of the Horse', blessing: '马到成功' },
    { name: 'Goat', zh: '羊', title: 'Year of the Goat', blessing: '三阳开泰' },
  ];
  return animals[year % 12];
}

/**
 * Animated Flying Bat with flapping wings.
 */
const AnimatedBat = ({
  startX,
  startY,
  endX,
  endY,
  delay,
  duration,
  scale = 1,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  scale?: number;
}) => {
  return (
    <motion.div
      initial={{ x: startX, y: startY, opacity: 0, scale: scale * 0.7 }}
      animate={{
        x: [startX, (startX + endX) / 2 + (Math.random() * 40 - 20), endX],
        y: [
          startY,
          startY - 35,
          startY + 25,
          startY - 15,
          endY,
        ],
        opacity: [0, 0.9, 0.95, 0.9, 0],
        scale: [scale * 0.7, scale * 1.1, scale * 0.9, scale],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 0.6 + 0.2,
        ease: 'easeInOut',
      }}
      className="absolute pointer-events-none z-20"
      style={{ left: 0, top: 0 }}
    >
      {/* Bat SVG with wing flapping animation */}
      <svg
        viewBox="0 0 100 60"
        className="w-12 h-7 drop-shadow-[0_0_8px_rgba(211,218,12,0.35)]"
        fill="currentColor"
      >
        <motion.path
          d="M 50 35 
             C 42 20, 30 10, 5 18 
             C 14 30, 22 42, 35 38 
             C 40 44, 45 45, 50 48 
             C 55 45, 60 44, 65 38 
             C 78 42, 86 30, 95 18 
             C 70 10, 58 20, 50 35 Z"
          fill="#111111"
          stroke="#d3da0c"
          strokeWidth="1.2"
          animate={{
            d: [
              "M 50 35 C 42 20, 30 10, 5 18 C 14 30, 22 42, 35 38 C 40 44, 45 45, 50 48 C 55 45, 60 44, 65 38 C 78 42, 86 30, 95 18 C 70 10, 58 20, 50 35 Z",
              "M 50 35 C 40 28, 25 35, 8 48 C 18 42, 28 38, 38 35 C 42 42, 47 45, 50 48 C 53 45, 58 42, 62 35 C 72 38, 82 42, 92 48 C 75 35, 60 28, 50 35 Z",
              "M 50 35 C 42 12, 26 2, 2 8 C 12 24, 22 36, 35 36 C 40 44, 45 46, 50 48 C 55 46, 60 44, 65 36 C 78 36, 88 24, 98 8 C 74 2, 58 12, 50 35 Z",
              "M 50 35 C 42 20, 30 10, 5 18 C 14 30, 22 42, 35 38 C 40 44, 45 45, 50 48 C 55 45, 60 44, 65 38 C 78 42, 86 30, 95 18 C 70 10, 58 20, 50 35 Z"
            ]
          }}
          transition={{
            duration: 0.22,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        {/* Glowing bat eyes */}
        <circle cx="47" cy="36" r="1.5" fill="#d3da0c" />
        <circle cx="53" cy="36" r="1.5" fill="#d3da0c" />
      </svg>
    </motion.div>
  );
};

interface HolidayDecorationsProps {
  overrideHoliday?: string | null;
}

export const HolidayDecorations: React.FC<HolidayDecorationsProps> = ({ overrideHoliday }) => {
  const holiday = useMemo(() => getActiveHoliday(overrideHoliday), [overrideHoliday]);
  const currentYear = new Date().getFullYear();
  const cnyZodiac = useMemo(() => getChineseZodiac(currentYear), [currentYear]);

  if (holiday === 'none') return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-15">
      {/* ─────────────────── 1. HALLOWEEN: FLYING BATS ─────────────────── */}
      {holiday === 'halloween' && (
        <>
          {/* Subtle Halloween Spooky Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-radial from-purple-950/20 via-transparent to-transparent pointer-events-none" />

          {/* Glowing Holiday Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-orange-950/40 border border-orange-500/30 text-orange-400 text-[0.6875rem] font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(249,115,22,0.25)]"
          >
            <span>🎃</span>
            <span>HALLOWEEN SPECIAL</span>
            <span>🦇</span>
          </motion.div>

          {/* Staggered flying bats across the screen */}
          <AnimatedBat startX={-60} startY={160} endX={window.innerWidth + 80} endY={120} delay={0.1} duration={2.2} scale={1.15} />
          <AnimatedBat startX={-40} startY={280} endX={window.innerWidth + 60} endY={220} delay={0.4} duration={2.4} scale={0.9} />
          <AnimatedBat startX={window.innerWidth + 60} startY={190} endX={-80} endY={260} delay={0.25} duration={2.5} scale={1.05} />
          <AnimatedBat startX={window.innerWidth + 80} startY={340} endX={-60} endY={290} delay={0.65} duration={2.1} scale={0.8} />
          <AnimatedBat startX={-50} startY={380} endX={window.innerWidth + 70} endY={330} delay={0.9} duration={2.3} scale={0.95} />
          <AnimatedBat startX={-70} startY={110} endX={window.innerWidth + 90} endY={90} delay={1.2} duration={2.6} scale={1.2} />
        </>
      )}

      {/* ─────────────────── 2. CHRISTMAS: SNOWFLAKES & FESTIVE GLOW ─────────────────── */}
      {holiday === 'christmas' && (
        <>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/30 text-red-300 text-[0.6875rem] font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(239,68,68,0.25)]"
          >
            <span>🎄</span>
            <span>MERRY CHRISTMAS</span>
          </motion.div>

          {/* Falling Snowflakes */}
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
                y: -30,
                opacity: 0,
              }}
              animate={{
                y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 40,
                x: `+=${Math.sin(i) * 60}`,
                opacity: [0, 0.85, 0.9, 0],
              }}
              transition={{
                duration: Math.random() * 2 + 2,
                repeat: Infinity,
                delay: Math.random() * 1.5,
                ease: 'linear',
              }}
              className="absolute text-white/80 pointer-events-none select-none"
              style={{ fontSize: `${Math.random() * 10 + 10}px` }}
            >
              ❄
            </motion.div>
          ))}
        </>
      )}

      {/* ─────────────────── 3. NEW YEAR: FIREWORKS & CELEBRATION ─────────────────── */}
      {holiday === 'newyear' && (
        <>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-950/40 border border-[#d3da0c]/40 text-[#d3da0c] text-[0.6875rem] font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(211,218,12,0.3)]"
          >
            <span>🎉</span>
            <span>HAPPY NEW YEAR {currentYear}</span>
            <span>🎆</span>
          </motion.div>

          {/* Confetti Bursts */}
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                scale: 0,
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500),
                opacity: 0,
              }}
              animate={{
                scale: [0, 1.4, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: Math.random() * 1.8,
                ease: 'easeOut',
              }}
              className="absolute text-2xl pointer-events-none"
            >
              {['💥', '🎇'][i % 2]}
            </motion.div>
          ))}
        </>
      )}

      {/* ─────────────────── 4. CHINESE NEW YEAR: RED LANTERNS & ZODIAC ANIMAL ─────────────────── */}
      {holiday === 'cny' && (
        <>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-amber-300 text-[0.6875rem] font-bold tracking-widest uppercase shadow-[0_0_25px_rgba(239,68,68,0.35)]"
          >
            <div className="flex items-center gap-2">
              <span>🏮</span>
              <span>CHINESE NEW YEAR • {cnyZodiac.title.toUpperCase()}</span>
              <span>🏮</span>
            </div>
            <div className="text-[0.625rem] text-amber-400 font-normal tracking-wider">
              {cnyZodiac.blessing} • {cnyZodiac.zh}年吉祥
            </div>
          </motion.div>

          {/* Floating Chinese Red Lanterns */}
          <motion.div
            animate={{
              y: [0, -12, 0],
              rotate: [-3, 3, -3],
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-8 left-8 text-3xl select-none filter drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]"
          >
            🏮
          </motion.div>

          <motion.div
            animate={{
              y: [0, -14, 0],
              rotate: [3, -3, 3],
            }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            className="absolute top-12 right-8 text-3xl select-none filter drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]"
          >
            🏮
          </motion.div>
        </>
      )}

      {/* ─────────────────── 5. VALENTINE'S DAY: HEARTS & ROMANCE ─────────────────── */}
      {holiday === 'valentines' && (
        <>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-pink-950/40 border border-pink-500/30 text-pink-300 text-[0.6875rem] font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(236,72,153,0.3)]"
          >
            <span>💖</span>
            <span>HAPPY VALENTINE'S</span>
          </motion.div>

          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
                y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 20,
                scale: 0.6,
                opacity: 0,
              }}
              animate={{
                y: -30,
                scale: [0.6, 1.2, 0.8],
                opacity: [0, 0.85, 0],
              }}
              transition={{
                duration: Math.random() * 2 + 2,
                repeat: Infinity,
                delay: Math.random() * 1.5,
                ease: 'easeOut',
              }}
              className="absolute text-pink-500 text-lg pointer-events-none"
            >
              {['❤️', '💖', '💕'][i % 3]}
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
};
