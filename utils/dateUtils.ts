/**
 * Get browser's timezone offset in milliseconds
 */
const getTimezoneOffsetMs = (): number => {
  return new Date().getTimezoneOffset() * 60 * 1000;
};

export const parseExcelDate = (v: any, fmt: string, fixTz?: boolean): Date | null => {
  if (v === undefined || v === null || v === '') return null;
  
  let dt: Date | null = null;
  
  try {
    if (typeof v === 'number') {
      // Excel serial date: days since 1899-12-30
      // When fixTz=true, interpret as LOCAL time (Vietnam UTC+7)
      // When fixTz=false, interpret as UTC
      
      // Convert Excel serial to Date components
      // First convert to UTC date, then extract components
      const ms = (v - 25569) * 86400 * 1000;
      const tempDate = new Date(ms);
      
      // Extract UTC components (what Excel date represents in UTC)
      const year = tempDate.getUTCFullYear();
      const month = tempDate.getUTCMonth();
      const day = tempDate.getUTCDate();
      const hour = tempDate.getUTCHours();
      const minute = tempDate.getUTCMinutes();
      const second = tempDate.getUTCSeconds();
      
      if (fixTz) {
        // Excel serial represents LOCAL time, so create Date in local timezone
        // Components from UTC calculation now become LOCAL time components
        dt = new Date(year, month, day, hour, minute, second);
        
        // Debug
        if ((day === 12 || day === 13) && month === 1) {
          console.log(`[parseExcelDate] Excel serial ${v} -> UTC calc: ${year}-${month+1}-${day} ${hour}:${minute} -> as LOCAL time: ${dt.toLocaleString()}`);
        }
      } else {
        // Treat as UTC (original behavior)
        dt = new Date(ms);
      }
    } else {
      const s = String(v).trim();
      
      // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
      const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;
      const isoMatch = s.match(isoRegex);
      
      if (isoMatch) {
        const year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]) - 1;
        const day = parseInt(isoMatch[3]);
        const hour = isoMatch[4] ? parseInt(isoMatch[4]) : 0;
        const min = isoMatch[5] ? parseInt(isoMatch[5]) : 0;
        const sec = isoMatch[6] ? parseInt(isoMatch[6]) : 0;
        
        if (fixTz) {
          dt = new Date(year, month, day, hour, min, sec);
          // Debug: log dates on 02/12-02/13
          if ((day === 12 || day === 13) && month === 1) {
            console.log(`[parseExcelDate] ISO input "${s}" -> ${year}-${month+1}-${day} ${hour}:${min} (local) -> ${dt.toLocaleString()}`);
          }
        } else {
          dt = new Date(Date.UTC(year, month, day, hour, min, sec));
        }
      } else {
        // Try D/M/YYYY or DD/MM/YYYY format (e.g., 01/01/2025 9:05)
        const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
        const match = s.match(dateRegex);
        
        if (match) {
          let day = parseInt(match[1], 10);
          let month = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          const hour = match[4] ? parseInt(match[4], 10) : 0;
          const min = match[5] ? parseInt(match[5], 10) : 0;
          const sec = match[6] ? parseInt(match[6], 10) : 0;
          
          // Auto-detect: if first part > 12, it's DD/MM, otherwise assume MM/DD
          if (day > 12) {
            month = month - 1;
          } else if (month > 12) {
            [day, month] = [match[2], match[1]];
            month = parseInt(month, 10) - 1;
          } else {
            [day, month] = [match[2], match[1]];
            month = parseInt(month, 10) - 1;
          }
          
          if (fixTz) {
            dt = new Date(year, month, day, hour, min, sec);
            // Debug: log dates on 02/12-02/13
            if ((day === 12 || day === 13) && month === 1) {
              console.log(`[parseExcelDate] D/M format "${s}" -> ${day}/${month+1}/${year} ${hour}:${min} (local) -> ${dt.toLocaleString()}`);
            }
          } else {
            dt = new Date(Date.UTC(year, month, day, hour, min, sec));
          }
        } else {
          // Try parsing as string or check for timezone
          const hasTimezone = s.includes('Z') || s.match(/[+-]\d{2}:\d{2}$/);
          
          if (hasTimezone) {
            dt = new Date(s);
          } else if (fixTz) {
            // Try ISO format manually for naive timestamps
            const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
            if (iso) {
              dt = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]), 
                           iso[4] ? parseInt(iso[4]) : 0, iso[5] ? parseInt(iso[5]) : 0, 
                           iso[6] ? parseInt(iso[6]) : 0);
            } else {
              dt = new Date(s);
            }
          } else {
            dt = new Date(s + 'Z');
          }
        }
      }
    }
  } catch (e) {
    console.warn("Date parse error for value:", v);
    return null;
  }

  return (dt && !isNaN(dt.getTime())) ? dt : null;
};

/**
 * Parse database date string - treats naive timestamps as UTC
 * Ensures consistent UTC interpretation regardless of browser timezone
 */
export const parseDbDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;
  
  try {
    const str = String(dateString).trim();
    
    // If it ends with Z, it's already UTC-marked - return as-is
    if (str.endsWith('Z')) {
      const dt = new Date(str);
      return !isNaN(dt.getTime()) ? dt : null;
    }
    
    // If ISO format without Z or timezone offset, add Z to force UTC interpretation
    if (str.includes('T') && !str.includes('+') && !str.includes('-', 10)) {
      const dt = new Date(str + 'Z');
      return !isNaN(dt.getTime()) ? dt : null;
    }
    
    // Otherwise standard parse
    const dt = new Date(str);
    return !isNaN(dt.getTime()) ? dt : null;
  } catch (e) {
    console.warn('DB date parse error:', dateString);
    return null;
  }
};

export const toISOLocal = (d: Date): string => {
  if(!d || isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use UTC getters so the input shows the stored DB clock value
  // (DB timestamps are parsed into UTC-based Date instances).
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const fmtTime = (d: Date): string => {
  if(!d || isNaN(d.getTime())) return '--:--';
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const fmtTimeUTC = (d: Date): string => {
  if(!d || isNaN(d.getTime())) return '--:--';
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

export const fmtDateUTC = (d: Date): string => {
  if(!d || isNaN(d.getTime())) return '';
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

export const getFlightColor = (str: string): string => {
  if(!str) return '#cbd5e1';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate pastel colors but slightly more saturated for better visibility against white
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 85%, 88%)`;
};