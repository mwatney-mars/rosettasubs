import zlib from 'zlib';
import iconv from 'iconv-lite';
import { SrtCue } from './types';

export function isValidUtf8(buf: Buffer): boolean {
  let i = 0;
  const len = buf.length;
  while (i < len) {
    const byte1 = buf[i];
    if (byte1 <= 0x7f) {
      i++;
      continue;
    }
    if (byte1 >= 0xc2 && byte1 <= 0xdf) {
      if (i + 1 >= len || (buf[i + 1] & 0xc0) !== 0x80) return false;
      i += 2;
      continue;
    }
    if (byte1 >= 0xe0 && byte1 <= 0xef) {
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (byte1 === 0xe0 && buf[i + 1] < 0xa0) ||
        (byte1 === 0xed && buf[i + 1] >= 0xa0)
      ) {
        return false;
      }
      i += 3;
      continue;
    }
    if (byte1 >= 0xf0 && byte1 <= 0xf4) {
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (byte1 === 0xf0 && buf[i + 1] < 0x90) ||
        (byte1 === 0xf4 && buf[i + 1] > 0x8f)
      ) {
        return false;
      }
      i += 4;
      continue;
    }
    return false;
  }
  return true;
}

export function decodeSubtitleBuffer(buf: Buffer, encodingHint?: string): string {
  if (buf.length === 0) return '';

  // Check BOMs first
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8').replace(/\r\n?/g, '\n');
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return iconv.decode(buf.subarray(2), 'utf16-le').replace(/\r\n?/g, '\n');
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return iconv.decode(buf.subarray(2), 'utf16-be').replace(/\r\n?/g, '\n');
  }

  if (encodingHint) {
    const cleanHint = encodingHint.trim().toLowerCase();
    if (cleanHint !== 'utf-8' && cleanHint !== 'utf8' && iconv.encodingExists(cleanHint)) {
      return iconv.decode(buf, cleanHint).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    }
  }

  if (isValidUtf8(buf)) {
    return buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  }

  return iconv.decode(buf, 'win1252').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function isZipBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05) &&
    (buf[3] === 0x04 || buf[3] === 0x06)
  );
}

export function extractSubtitleFromZip(
  zipBuf: Buffer,
  season?: number,
  episode?: number
): { buffer: Buffer; filename: string } | null {
  const candidates: { filename: string; buffer: Buffer }[] = [];

  // Locate End of Central Directory (EOCD: 0x06054b50) for reliable sizes even with data descriptors
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65557); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
    let cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);

    for (let e = 0; e < totalEntries && cdOffset + 46 <= zipBuf.length; e++) {
      if (zipBuf.readUInt32LE(cdOffset) !== 0x02014b50) break;
      const compressionMethod = zipBuf.readUInt16LE(cdOffset + 10);
      const compressedSize = zipBuf.readUInt32LE(cdOffset + 20);
      const fileNameLen = zipBuf.readUInt16LE(cdOffset + 28);
      const extraLen = zipBuf.readUInt16LE(cdOffset + 30);
      const commentLen = zipBuf.readUInt16LE(cdOffset + 32);
      const localHeaderOffset = zipBuf.readUInt32LE(cdOffset + 42);
      const filename = zipBuf.subarray(cdOffset + 46, cdOffset + 46 + fileNameLen).toString('utf8');

      cdOffset += 46 + fileNameLen + extraLen + commentLen;

      if (!/\.(srt|vtt|ass|ssa|sub)$/i.test(filename) || filename.startsWith('__MACOSX')) {
        continue;
      }

      if (localHeaderOffset + 30 > zipBuf.length) continue;
      if (zipBuf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;
      const localNameLen = zipBuf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zipBuf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > zipBuf.length) continue;

      const rawData = zipBuf.subarray(dataStart, dataEnd);
      try {
        const uncompressed =
          compressionMethod === 0
            ? rawData
            : compressionMethod === 8
              ? zlib.inflateRawSync(rawData)
              : null;
        if (uncompressed) {
          candidates.push({ filename, buffer: uncompressed });
        }
      } catch {
        // Ignore corrupt entry
      }
    }
  } else {
    // Fallback to scanning local file headers directly
    let offset = 0;
    while (offset + 30 <= zipBuf.length) {
      if (zipBuf.readUInt32LE(offset) !== 0x04034b50) break;
      const compressionMethod = zipBuf.readUInt16LE(offset + 8);
      const compressedSize = zipBuf.readUInt32LE(offset + 18);
      const fileNameLen = zipBuf.readUInt16LE(offset + 26);
      const extraLen = zipBuf.readUInt16LE(offset + 28);
      const filename = zipBuf.subarray(offset + 30, offset + 30 + fileNameLen).toString('utf8');
      const dataStart = offset + 30 + fileNameLen + extraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > zipBuf.length) break;

      if (/\.(srt|vtt|ass|ssa|sub)$/i.test(filename) && !filename.startsWith('__MACOSX')) {
        const rawData = zipBuf.subarray(dataStart, dataEnd);
        try {
          const uncompressed =
            compressionMethod === 0
              ? rawData
              : compressionMethod === 8
                ? zlib.inflateRawSync(rawData)
                : null;
          if (uncompressed) {
            candidates.push({ filename, buffer: uncompressed });
          }
        } catch {
          // Ignore corrupt entry
        }
      }
      offset = dataEnd;
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  if (season !== undefined && episode !== undefined) {
    const sPad = String(season).padStart(2, '0');
    const ePad = String(episode).padStart(2, '0');
    const patterns = [
      new RegExp(`s${sPad}[._\\-\\s]*e${ePad}\\b`, 'i'),
      new RegExp(`\\b${season}x${ePad}\\b`, 'i'),
      new RegExp(`\\be${ePad}\\b`, 'i')
    ];
    for (const pattern of patterns) {
      const match = candidates.find((c) => pattern.test(c.filename));
      if (match) return match;
    }
  }

  // Prefer .srt over other formats
  const srtCandidate = candidates.find((c) => c.filename.toLowerCase().endsWith('.srt'));
  return srtCandidate ?? candidates[0];
}

function normalizeVttTime(timeStr: string): string {
  const clean = timeStr.trim().replace('.', ',');
  const parts = clean.split(':');
  if (parts.length === 2) {
    // MM:SS,mmm -> 00:MM:SS,mmm
    return `00:${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  if (parts.length === 3) {
    const [hh, mm, ssmmm] = parts;
    const [ss, mmm = '000'] = ssmmm.split(',');
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')},${mmm.padEnd(3, '0').slice(0, 3)}`;
  }
  return clean;
}

export function vttToSrt(vttContent: string): string {
  const lines = vttContent.replace(/\r\n?/g, '\n').split('\n');
  const cues: SrtCue[] = [];
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  const timeRegex =
    /^((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/;

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = line.match(timeRegex);
    if (match) {
      const startTime = normalizeVttTime(match[1]);
      const endTime = normalizeVttTime(match[2]);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        // Strip VTT inline timestamp or speaker tags like <c.color> or <00:01.000>
        const cleanedLine = lines[i]
          .replace(/<\d{2}:\d{2}[.,]\d{3}>/g, '')
          .replace(/<\/?c(?:\.[^>]*)?>/g, '')
          .replace(/<v\s+([^>]+)>/g, '[$1] ')
          .replace(/<\/v>/g, '');
        textLines.push(cleanedLine);
        i++;
      }
      if (textLines.length > 0) {
        cues.push({
          index: cues.length + 1,
          startTime,
          endTime,
          text: textLines.join('\n').trim()
        });
      }
    } else {
      i++;
    }
  }

  return serializeSrt(cues);
}

function normalizeAssTime(assTime: string): string {
  // Format: H:MM:SS.cc -> HH:MM:SS,ccc
  const match = assTime.trim().match(/^(\d+):(\d{2}):(\d{2})[.:](\d{1,3})$/);
  if (!match) return '00:00:00,000';
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  const ss = match[3];
  const ms = match[4].padEnd(3, '0').slice(0, 3);
  return `${hh}:${mm}:${ss},${ms}`;
}

export function assToSrt(assContent: string): string {
  const lines = assContent.replace(/\r\n?/g, '\n').split('\n');
  const cues: SrtCue[] = [];
  let startIdx = 1;
  let endIdx = 2;
  let textIdx = 9;
  let inEvents = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^\[Events\]/i.test(line)) {
      inEvents = true;
      continue;
    }
    if (inEvents && /^\[.*\]$/.test(line)) {
      break;
    }
    if (inEvents && /^Format:/i.test(line)) {
      const fields = line
        .replace(/^Format:\s*/i, '')
        .split(',')
        .map((f) => f.trim().toLowerCase());
      const s = fields.indexOf('start');
      const e = fields.indexOf('end');
      const t = fields.indexOf('text');
      if (s !== -1) startIdx = s;
      if (e !== -1) endIdx = e;
      if (t !== -1) textIdx = t;
      continue;
    }
    if (/^Dialogue:/i.test(line)) {
      const payload = line.replace(/^Dialogue:\s*/i, '');
      const parts = payload.split(',');
      if (parts.length > textIdx) {
        const startTime = normalizeAssTime(parts[startIdx]);
        const endTime = normalizeAssTime(parts[endIdx]);
        const rawText = parts.slice(textIdx).join(',');
        const cleanText = rawText
          .replace(/\{[^}]*\}/g, '') // Strip ASS override tags
          .replace(/\\[Nn]/g, '\n')
          .replace(/\\h/g, ' ')
          .trim();

        if (cleanText) {
          cues.push({
            index: cues.length + 1,
            startTime,
            endTime,
            text: cleanText
          });
        }
      }
    }
  }

  return serializeSrt(cues);
}

function framesToSrtTime(frames: number, fps = 23.976): string {
  const totalMs = Math.max(0, Math.round((frames / fps) * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function subToSrt(subContent: string, fps = 23.976): string {
  const lines = subContent.replace(/\r\n?/g, '\n').split('\n');
  const cues: SrtCue[] = [];
  const lineRegex = /^\{(\d+)\}\{(\d+)\}(.+)$/;

  for (const line of lines) {
    const match = line.trim().match(lineRegex);
    if (!match) continue;
    const startFrame = parseInt(match[1], 10);
    const endFrame = parseInt(match[2], 10);
    const text = match[3]
      .replace(/\{[^}]*\}/g, '')
      .split('|')
      .join('\n')
      .trim();
    if (text) {
      cues.push({
        index: cues.length + 1,
        startTime: framesToSrtTime(startFrame, fps),
        endTime: framesToSrtTime(endFrame, fps),
        text
      });
    }
  }

  return serializeSrt(cues);
}

export function parseSrt(srtContent: string): SrtCue[] {
  const normalized = srtContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const cues: SrtCue[] = [];
  const timeRegex =
    /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/;

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    let timeLineIdx = -1;
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const match = lines[timeLineIdx].match(timeRegex);
    if (!match) continue;

    const startTime = normalizeVttTime(match[1]);
    const endTime = normalizeVttTime(match[2]);
    const text = lines
      .slice(timeLineIdx + 1)
      .join('\n')
      .trim();

    if (text) {
      cues.push({
        index: cues.length + 1,
        startTime,
        endTime,
        text
      });
    }
  }

  return cues;
}

export function serializeSrt(cues: SrtCue[]): string {
  return cues
    .map(
      (cue, idx) =>
        `${idx + 1}\n${cue.startTime} --> ${cue.endTime}\n${cue.text.trim()}`
    )
    .join('\n\n')
    .concat(cues.length > 0 ? '\n' : '');
}

export function normalizeToSrt(content: string, formatHint?: string): string {
  const trimmed = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!trimmed) return '';

  const hint = formatHint?.toLowerCase();

  if (hint === 'vtt' || /^WEBVTT/i.test(trimmed)) {
    return vttToSrt(trimmed);
  }

  if (
    hint === 'ass' ||
    hint === 'ssa' ||
    /^\[Script Info\]/i.test(trimmed) ||
    /\nDialogue:\s*\d+,/i.test(trimmed)
  ) {
    return assToSrt(trimmed);
  }

  if (hint === 'sub' || /^\{\d+\}\{\d+\}/.test(trimmed)) {
    return subToSrt(trimmed);
  }

  const parsed = parseSrt(trimmed);
  if (parsed.length > 0) {
    return serializeSrt(parsed);
  }

  return trimmed + '\n';
}
