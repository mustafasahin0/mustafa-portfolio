import type { APIRoute } from 'astro';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

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

// Get CPU core count from /proc/cpuinfo (works on Android/Termux)
function getCpuCoreCount(): number {
  try {
    const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const processors = cpuinfo.match(/^processor\s*:/gm);
    if (processors && processors.length > 0) {
      return processors.length;
    }
  } catch {}
  
  // Fallback to os.cpus() 
  const cpus = os.cpus();
  if (cpus.length > 0) return cpus.length;
  
  // Default for Pixel 7 (Tensor G2 has 8 cores)
  return 8;
}

// Get CPU model name
function getCpuModel(): string {
  try {
    const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    // Look for "Hardware" line on Android
    const hardwareMatch = cpuinfo.match(/^Hardware\s*:\s*(.+)$/m);
    if (hardwareMatch) return hardwareMatch[1].trim();
    
    // Fallback to model name
    const modelMatch = cpuinfo.match(/^model name\s*:\s*(.+)$/m);
    if (modelMatch) return modelMatch[1].trim();
  } catch {}
  
  const cpus = os.cpus();
  if (cpus[0]?.model) return cpus[0].model;
  
  return 'Google Tensor G2';
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
  let level: number | null = null;
  let charging: boolean | null = null;
  
  // Method 1: Try termux-battery-status command (requires Termux:API)
  try {
    const output = execSync('termux-battery-status', { 
      timeout: 3000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const batteryData = JSON.parse(output);
    level = batteryData.percentage ?? batteryData.level;
    charging = batteryData.status === 'CHARGING' || batteryData.status === 'FULL';
    return { level, charging };
  } catch {
    // termux-battery-status not available, try fallback
  }
  
  // Method 2: Try reading from /sys filesystem
  const batteryPaths = [
    '/sys/class/power_supply/battery/capacity',
    '/sys/class/power_supply/BAT0/capacity',
  ];
  
  const statusPaths = [
    '/sys/class/power_supply/battery/status',
    '/sys/class/power_supply/BAT0/status',
  ];
  
  for (const path of batteryPaths) {
    try {
      level = parseInt(fs.readFileSync(path, 'utf8').trim());
      break;
    } catch {}
  }
  
  for (const path of statusPaths) {
    try {
      const status = fs.readFileSync(path, 'utf8').trim().toLowerCase();
      charging = status === 'charging' || status === 'full';
      break;
    } catch {}
  }
  
  return { level, charging };
}

export const GET: APIRoute = async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);
  
  const loadAvg = os.loadavg();
  
  // Use process.uptime() for Node.js server uptime (not phone uptime)
  const uptime = process.uptime();
  
  // Get CPU info (works on Android/Termux)
  const cpuCount = getCpuCoreCount();
  const cpuModel = getCpuModel();
  
  // Calculate CPU usage percentage (rough estimate based on load average)
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
      model: cpuModel,
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
