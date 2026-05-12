import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudRain, CloudLightning, Snowflake, Sun, Moon, CloudSun, Wind, Droplets, Calendar, Clock } from 'lucide-react';

interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
}

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  shanghai: { lat: 31.23, lon: 121.47 },
  beijing: { lat: 39.90, lon: 116.41 },
  guangzhou: { lat: 23.13, lon: 113.26 },
  shenzhen: { lat: 22.54, lon: 114.06 },
  chengdu: { lat: 30.66, lon: 104.06 },
  hangzhou: { lat: 30.27, lon: 120.15 },
  nanjing: { lat: 32.06, lon: 118.78 },
  wuhan: { lat: 30.59, lon: 114.31 },
  xi_an: { lat: 34.34, lon: 108.94 },
  chongqing: { lat: 29.56, lon: 106.55 },
  tianjin: { lat: 39.08, lon: 117.20 },
  suzhou: { lat: 31.30, lon: 120.58 },
  dalian: { lat: 38.91, lon: 121.61 },
  qingdao: { lat: 36.07, lon: 120.38 },
  xiamen: { lat: 24.48, lon: 118.09 },
  kunming: { lat: 25.04, lon: 102.71 },
  changsha: { lat: 28.23, lon: 112.98 },
  zhengzhou: { lat: 34.75, lon: 113.65 },
  fuzhou: { lat: 26.08, lon: 119.30 },
  harbin: { lat: 45.80, lon: 126.53 },
  hong_kong: { lat: 22.32, lon: 114.17 },
};

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear Sky', icon: 'sun' },
  1: { label: 'Mainly Clear', icon: 'cloud-sun' },
  2: { label: 'Partly Cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Foggy', icon: 'cloud' },
  48: { label: 'Foggy', icon: 'cloud' },
  51: { label: 'Light Drizzle', icon: 'rain' },
  53: { label: 'Drizzle', icon: 'rain' },
  55: { label: 'Heavy Drizzle', icon: 'rain' },
  61: { label: 'Light Rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy Rain', icon: 'rain' },
  71: { label: 'Light Snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy Snow', icon: 'snow' },
  80: { label: 'Light Showers', icon: 'rain' },
  81: { label: 'Showers', icon: 'rain' },
  82: { label: 'Heavy Showers', icon: 'rain' },
  95: { label: 'Thunderstorm', icon: 'thunder' },
  96: { label: 'Thunderstorm', icon: 'thunder' },
  99: { label: 'Thunderstorm', icon: 'thunder' },
};

function getCoords(cityName: string): { lat: number; lon: number } | null {
  const key = cityName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
  return CITY_COORDS[key] || CITY_COORDS['shanghai'];
}

/* ─── Animated Weather Icons ─── */

const AnimatedSun = () => (
  <div className="relative w-20 h-20">
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      animate={{ rotate: 360 }}
      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
    >
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-4 bg-yellow-400 rounded-full"
          style={{ transform: `rotate(${i * 45}deg) translateY(-18px)` }}
        />
      ))}
    </motion.div>
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      animate={{ scale: [1, 1.12, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Sun className="w-12 h-12 text-yellow-400" />
    </motion.div>
  </div>
);

const AnimatedMoon = () => (
  <div className="relative w-20 h-20">
    <motion.div
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="flex items-center justify-center h-full"
    >
      <Moon className="w-12 h-12 text-blue-200" />
    </motion.div>
    {[...Array(4)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-white rounded-full"
        style={{ top: `${15 + i * 18}%`, left: `${55 + i * 12}%` }}
        animate={{ opacity: [0.2, 0.9, 0.2] }}
        transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
      />
    ))}
  </div>
);

const AnimatedCloud = () => (
  <motion.div
    animate={{ x: [-5, 5, -5] }}
    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    className="flex items-center justify-center w-20 h-20"
  >
    <Cloud className="w-14 h-14 text-gray-300" />
  </motion.div>
);

const AnimatedCloudSun = () => (
  <div className="relative w-20 h-20">
    <motion.div
      className="absolute top-1 right-1"
      animate={{ rotate: 360 }}
      transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-2.5 bg-yellow-400/70 rounded-full"
          style={{ transform: `rotate(${i * 60}deg) translateY(-12px)` }}
        />
      ))}
    </motion.div>
    <Sun className="absolute top-1 right-1 w-8 h-8 text-yellow-400" />
    <motion.div
      className="absolute bottom-0 left-0"
      animate={{ x: [-4, 4, -4] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Cloud className="w-12 h-12 text-gray-300" />
    </motion.div>
  </div>
);

const AnimatedRain = () => (
  <div className="relative w-20 h-20 flex items-center justify-center">
    <CloudRain className="w-14 h-14 text-blue-300" />
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-0.5 h-2.5 bg-blue-400/70 rounded-full"
        style={{ left: `${18 + i * 14}%`, top: '52%' }}
        animate={{ y: [0, 14, 0], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear', delay: i * 0.18 }}
      />
    ))}
  </div>
);

const AnimatedThunder = () => (
  <div className="relative w-20 h-20 flex items-center justify-center">
    <CloudLightning className="w-14 h-14 text-gray-400" />
    <motion.div
      className="absolute bottom-2 left-1/2 -translate-x-1/2"
      animate={{ opacity: [0, 1, 0, 0, 1, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width="18" height="26" viewBox="0 0 16 24" fill="none">
        <path d="M8 0L2 10H7L5 24L14 10H9L11 0H8Z" fill="#FCD34D" />
      </svg>
    </motion.div>
  </div>
);

const AnimatedSnow = () => (
  <div className="relative w-20 h-20 flex items-center justify-center">
    <Snowflake className="w-14 h-14 text-blue-200" />
    {[...Array(4)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-white rounded-full"
        style={{ left: `${22 + i * 16}%`, top: '55%' }}
        animate={{ y: [0, 16, 0], opacity: [0.8, 0.2, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
      />
    ))}
  </div>
);

const WeatherIcon = ({ icon, isDay }: { icon: string; isDay: boolean }) => {
  switch (icon) {
    case 'sun': return isDay ? <AnimatedSun /> : <AnimatedMoon />;
    case 'cloud-sun': return isDay ? <AnimatedCloudSun /> : <AnimatedMoon />;
    case 'cloud': return <AnimatedCloud />;
    case 'rain': return <AnimatedRain />;
    case 'thunder': return <AnimatedThunder />;
    case 'snow': return <AnimatedSnow />;
    default: return isDay ? <AnimatedSun /> : <AnimatedMoon />;
  }
};

/* ─── Clock Hook ─── */

function useLiveTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/* ─── Main Widget ─── */

interface WeatherWidgetProps {
  city?: string;
}

export default function WeatherWidget({ city = 'Shanghai' }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useLiveTime();

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      const coords = getCoords(city);
      if (!coords) { setLoading(false); return; }
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=auto`
        );
        const data = await res.json();
        const current = data.current;
        const wmo = WMO_CODES[current.weather_code] || WMO_CODES[0];
        setWeather({
          temp: Math.round(current.temperature_2m),
          condition: wmo.label,
          icon: wmo.icon,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
          isDay: current.is_day === 1,
        });
      } catch {
        setWeather({ temp: 24, condition: 'Clear Sky', icon: 'sun', humidity: 60, windSpeed: 8, isDay: true });
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, [city]);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="hidden lg:flex w-80 h-[420px] rounded-3xl bg-black/50 backdrop-blur-xl border border-white/10 items-center justify-center">
        <motion.div
          className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (!weather) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex flex-col w-80 rounded-3xl bg-black/50 backdrop-blur-xl border border-white/10 p-6 relative overflow-hidden"
    >
      {/* Ambient glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#d3da0c]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header: City + Date */}
      <div className="relative z-10 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold text-lg tracking-wide">{city}</h3>
          <span className="text-[#d3da0c] text-xs font-medium px-2 py-0.5 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20">
            {weather.isDay ? 'Day' : 'Night'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-white/40 text-xs">
          <Calendar className="w-3 h-3" />
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-white/10 mb-4" />

      {/* Main: Icon + Temp */}
      <div className="flex items-center justify-between relative z-10 mb-4">
        <div className="scale-90 origin-left">
          <WeatherIcon icon={weather.icon} isDay={weather.isDay} />
        </div>
        <div className="text-right">
          <motion.p
            className="text-5xl font-bold text-white leading-none"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 200 }}
          >
            {weather.temp}°
          </motion.p>
          <p className="text-white/60 text-sm mt-1">{weather.condition}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-white/10 mb-4" />

      {/* Live Clock */}
      <div className="relative z-10 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-3.5 h-3.5 text-[#d3da0c]" />
          <span className="text-white/40 text-xs uppercase tracking-wider font-medium">Local Time</span>
        </div>
        <motion.p
          className="text-3xl font-mono text-white tracking-wider"
          key={now.getSeconds()}
          initial={{ opacity: 0.6, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {timeStr}
        </motion.p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 relative z-10 mt-auto">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/5">
          <Droplets className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Humidity</p>
            <p className="text-white text-sm font-semibold">{weather.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/5">
          <Wind className="w-4 h-4 text-teal-400" />
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Wind</p>
            <p className="text-white text-sm font-semibold">{weather.windSpeed} <span className="text-white/40 font-normal">km/h</span></p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
