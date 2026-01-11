import type { APIRoute } from 'astro';
import os from 'os';
import fs from 'fs';

// Helper to format bytes to human readable
function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// Helper to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}

// Try to read CPU temperature (Android/Termux specific)
function getCpuTemperature(): number | null {
  const thermalPaths = [
    '/sys/class/thermal/thermal_zone0/temp',
    '/sys/devices/virtual/thermal/thermal_zone0/temp',
  ];
  
  for (const path of thermalPaths) {
    try {
      const temp = parseInt(fs.readFileSync(path, 'utf8').trim());
      // Temperature is usually in millidegrees
      return temp > 1000 ? temp / 1000 : temp;
    } catch {
      continue;
    }
  }
  return null;
}

// Get battery info (Android/Termux specific)
function getBatteryInfo(): { level: number | null; charging: boolean | null } {
  try {
    // Try to read battery level
    const levelPath = '/sys/class/power_supply/battery/capacity';
    const statusPath = '/sys/class/power_supply/battery/status';
    
    let level: number | null = null;
    let charging: boolean | null = null;
    
    try {
      level = parseInt(fs.readFileSync(levelPath, 'utf8').trim());
    } catch {}
    
    try {
      const status = fs.readFileSync(statusPath, 'utf8').trim().toLowerCase();
      charging = status === 'charging' || status === 'full';
    } catch {}
    
    return { level, charging };
  } catch {
    return { level: null, charging: null };
  }
}

export const GET: APIRoute = async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);
  
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const uptime = os.uptime();
  
  // Calculate CPU usage percentage (rough estimate based on load average)
  const cpuCount = cpus.length;
  const cpuUsagePercent = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100));
  
  const cpuTemp = getCpuTemperature();
  const battery = getBatteryInfo();
  
  const stats = {
    device: {
      name: 'Pixel 7',
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    memory: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      usagePercent: memUsagePercent,
    },
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpuCount,
      usagePercent: cpuUsagePercent,
      loadAvg: loadAvg.map(l => l.toFixed(2)),
      temperature: cpuTemp,
    },
    system: {
      uptime: formatUptime(uptime),
      uptimeSeconds: Math.floor(uptime),
    },
    battery: battery,
    timestamp: new Date().toISOString(),
  };
  
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
