import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import zlib from 'zlib';
import iconv from 'iconv-lite';
import { createApp } from '../src/app';
import {
  decodeConfig,
  encodeConfig,
  encodeDualToken,
  encodeProxyToken,
  encodeTranslateToken
} from '../src/config';
import { toIso639_1, toIso639_2, toSubdlCode, getLanguageName } from '../src/languages';
import { TTLCache, searchCache, subtitleContentCache } from '../src/cache';
import {
  assToSrt,
  decodeSubtitleBuffer,
  extractSubtitleFromZip,
  mergeDualSrt,
  normalizeToSrt,
  parseSrt,
  subToSrt,
  vttToSrt
} from '../src/subtitleConverter';
import { parseStremioSubtitleRequest } from '../src/providers';
import { scoreReleaseMatch } from '../src/providers/releaseScorer';

function createMockZip(filename: string, content: string): Buffer {
  const fileData = Buffer.from(content, 'utf8');
  const compressed = zlib.deflateRawSync(fileData);
  const nameBuf = Buffer.from(filename, 'utf8');

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8); // Deflate
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(fileData.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  return Buffer.concat([localHeader, nameBuf, compressed]);
}

describe('Language Utilities', () => {
  it('scores release similarity by source family, release group, and penalizes screeners', () => {
    const webFile = 'Breathe 2017 1080p AMZN WEB-DL DDP5 1 H 264 DUAL-BiOMA.mkv';
    expect(scoreReleaseMatch(webFile, 'Breathe.2017.1080p.WEB-DL.x264-BiOMA', 'WEB-DL')).toBeGreaterThan(40);
    expect(scoreReleaseMatch(webFile, 'Breathe.2017.1080p.BluRay.x264-DRONES', 'BluRay')).toBeLessThan(0);
    expect(scoreReleaseMatch('Lone Survivor (2013).mkv', 'Lone.Survivor.2013.DVDSCR.XVID-Snake1')).toBeLessThan(-20);
  });

  it('maps between ISO 639-1, ISO 639-2, and SubDL codes', () => {
    expect(toIso639_2('en')).toBe('eng');
    expect(toIso639_2('es')).toBe('spa');
    expect(toIso639_2('pt-BR')).toBe('pob');
    expect(toIso639_2('Brazillian Portuguese')).toBe('pob');
    expect(toIso639_2('BR_PT')).toBe('pob');
    expect(toIso639_1('pob')).toBe('pt-br');
    expect(toIso639_2('French')).toBe('fre');
    expect(toIso639_1('spa')).toBe('es');
    expect(toSubdlCode('pob')).toBe('BR_PT');
    expect(getLanguageName('jpn')).toBe('Japanese');
  });
});

describe('Config & Token Encoding', () => {
  it('round-trips AddonConfig via base64url', () => {
    const encoded = encodeConfig({
      languages: ['eng', 'jpn'],
      providers: ['wyzie', 'opensubtitles'],
      openSubtitlesApiKey: 'os-secret',
      aiProvider: 'gemini',
      aiApiKey: 'gem-secret',
      aiMode: 'always',
      proxySubtitles: true,
      includeHearingImpaired: false
    });

    const decoded = decodeConfig(encoded);
    expect(decoded.languages).toEqual(['eng', 'jpn']);
    expect(decoded.providers).toEqual(['wyzie', 'opensubtitles']);
    expect(decoded.openSubtitlesApiKey).toBe('os-secret');
    expect(decoded.aiApiKey).toBe('gem-secret');
    expect(decoded.aiMode).toBe('always');
    expect(decoded.includeHearingImpaired).toBe(false);
  });
});

describe('TTLCache', () => {
  it('stores, expires, and evicts LRU entries', async () => {
    const cache = new TTLCache<string>(50, 2);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.get('a')).toBe('1'); // refreshes 'a', so 'b' is oldest
    cache.set('c', '3'); // evicts 'b'
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');

    await new Promise((r) => setTimeout(r, 70));
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('Subtitle Encoding & Format Normalization', () => {
  it('decodes Windows-1252 and UTF-16LE buffers to UTF-8', () => {
    const win1252Buf = iconv.encode('1\r\n00:00:01,000 --> 00:00:02,000\r\n¡Hola señor!\r\n', 'win1252');
    const decoded1252 = decodeSubtitleBuffer(win1252Buf);
    expect(decoded1252).toContain('¡Hola señor!');
    expect(decoded1252).not.toContain('\r');

    const utf16Payload = iconv.encode('1\n00:00:01,000 --> 00:00:02,000\nBonjour\n', 'utf16-le');
    const bomUtf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), utf16Payload]);
    expect(decodeSubtitleBuffer(bomUtf16)).toContain('Bonjour');
  });

  it('converts WebVTT to SRT', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:01.500 --> 00:03.250 align:start',
      '<v Speaker>Hello <c.yellow>world</c>!</v>',
      '',
      '00:01:05.000 --> 00:01:07.800',
      'Second cue'
    ].join('\n');

    const srt = vttToSrt(vtt);
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0].startTime).toBe('00:00:01,500');
    expect(cues[0].endTime).toBe('00:00:03,250');
    expect(cues[0].text).toBe('[Speaker] Hello world!');
    expect(cues[1].startTime).toBe('00:01:05,000');
  });

  it('converts ASS/SSA to SRT', () => {
    const ass = [
      '[Script Info]',
      'Title: Sample',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:02.15,0:00:04.90,Default,,0,0,0,,{\\an8\\i1}Hello there!\\NGeneral Kenobi!'
    ].join('\n');

    const srt = assToSrt(ass);
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe('00:00:02,150');
    expect(cues[0].endTime).toBe('00:00:04,900');
    expect(cues[0].text).toBe('Hello there!\nGeneral Kenobi!');
  });

  it('converts MicroDVD .sub to SRT', () => {
    const sub = '{24}{72}First line|Second line';
    const srt = subToSrt(sub, 24);
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe('00:00:01,000');
    expect(cues[0].endTime).toBe('00:00:03,000');
    expect(cues[0].text).toBe('First line\nSecond line');
  });

  it('extracts episode-matching SRT from a ZIP buffer', () => {
    const zipBuf = createMockZip(
      'Show.S01E02.srt',
      '1\n00:00:01,000 --> 00:00:02,000\nFrom ZIP\n'
    );
    const extracted = extractSubtitleFromZip(zipBuf, 1, 2);
    expect(extracted).not.toBeNull();
    expect(normalizeToSrt(extracted!.buffer.toString('utf8'))).toContain('From ZIP');
  });

  it('timestamp-aligns and merges two SRT tracks into a dual-language SRT', () => {
    const primary = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      '目が覚めたか、ネオ。',
      '',
      '2',
      '00:00:05,000 --> 00:00:08,500',
      '白ウサギを追え。'
    ].join('\n');

    const secondary = [
      '1',
      '00:00:01,150 --> 00:00:02,900',
      'Wake up, Neo.',
      '',
      '2',
      '00:00:05,000 --> 00:00:06,600',
      'Follow the',
      '',
      '3',
      '00:00:06,700 --> 00:00:08,400',
      'white rabbit.'
    ].join('\n');

    const merged = mergeDualSrt(primary, secondary);
    const cues = parseSrt(merged);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('<b>目が覚めたか、ネオ。</b>\n<font color="#999999">Wake up, Neo.</font>');
    expect(cues[1].text).toBe('<b>白ウサギを追え。</b>\n<font color="#999999">Follow the white rabbit.</font>');
  });
});

describe('Express Stremio Add-on Routes & Multimodal AI Flow', () => {
  const app = createApp();

  beforeEach(() => {
    searchCache.clear();
    subtitleContentCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses Stremio series id and extra parameters', () => {
    const parsed = parseStremioSubtitleRequest(
      'series',
      'tt0944947:1:2',
      'videoHash=abcdef1234567890&videoSize=1048576&filename=GOT.S01E02.mkv',
      ['eng', 'spa']
    );
    expect(parsed.imdbId).toBe('tt0944947');
    expect(parsed.season).toBe(1);
    expect(parsed.episode).toBe(2);
    expect(parsed.videoHash).toBe('abcdef1234567890');
    expect(parsed.videoSize).toBe(1048576);
    expect(parsed.filename).toBe('GOT.S01E02.mkv');
  });

  it('serves /manifest.json, /:config/manifest.json, and /logo.svg', async () => {
    const res1 = await request(app).get('/manifest.json');
    expect(res1.status).toBe(200);
    expect(res1.body.id).toBe('org.stremio.rosettasubs');
    expect(res1.body.resources).toContain('subtitles');
    expect(res1.body.logo).toContain('/logo.svg');
    expect(res1.body.description).toContain('dual-language immersion tracks');

    const logoRes = await request(app).get('/logo.svg');
    expect(logoRes.status).toBe(200);
    expect(logoRes.headers['content-type']).toContain('image/svg+xml');
    expect(Buffer.from(logoRes.body).toString('utf8')).toContain('<svg');

    const cfg = encodeConfig({ languages: ['jpn'], providers: ['wyzie'], dualSubtitles: true });
    const res2 = await request(app).get(`/${cfg}/manifest.json`);
    expect(res2.status).toBe(200);
    expect(res2.body.description).toContain('Japanese');
    expect(res2.body.description).toContain('Dual-language immersion enabled');
  });

  it('serves /configure HTML UI', async () => {
    const res = await request(app).get('/configure');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('RosettaSubs');
  });

  it('aggregates provider subtitles and adds AI fallback track for missing target language', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('sub.wyzie.ru')) {
        return new Response(
          JSON.stringify([
            {
              id: 'w1',
              url: 'https://example.com/sub-en.srt',
              language: 'en',
              format: 'srt',
              encoding: 'UTF-8'
            }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('[]', { status: 200 });
    });

    const cfg = encodeConfig({
      languages: ['eng', 'jpn'],
      providers: ['wyzie'],
      aiProvider: 'gemini',
      aiApiKey: 'test-gemini-key',
      aiMode: 'fallback',
      proxySubtitles: true
    });

    const res = await request(app).get(`/${cfg}/subtitles/movie/tt0133093.json`);
    expect(res.status).toBe(200);
    expect(res.body.subtitles).toHaveLength(2);

    const engSub = res.body.subtitles.find((s: { lang: string }) => s.lang === 'eng');
    const jpnAiSub = res.body.subtitles.find((s: { lang: string }) => s.lang === 'jpn');

    expect(engSub).toBeDefined();
    expect(engSub.url).toContain('/sub/');
    expect(engSub.label).toBe('EN • Wyzie');
    expect(jpnAiSub).toBeDefined();
    expect(jpnAiSub.id).toContain('ai-gemini-jpn');
    expect(jpnAiSub.url).toContain('/translate/');
    expect(jpnAiSub.label).toBe('JA • AI • EN→JA');

    const tvRes = await request(app).get(
      `/${cfg}/subtitles/movie/tt0133093.json?descriptiveLang=1`
    );
    expect(tvRes.status).toBe(200);
    expect(tvRes.body.subtitles.some((s: { lang: string }) => s.lang === 'EN • Wyzie')).toBe(
      true
    );
    expect(
      tvRes.body.subtitles.some((s: { lang: string }) => s.lang === 'JA • AI • EN→JA')
    ).toBe(true);
  });

  it('proxies and normalizes upstream VTT subtitles to UTF-8 SRT via /sub/:token.srt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nProxied subtitle line\n', {
        status: 200
      })
    );

    const token = encodeProxyToken({
      u: 'https://example.com/test.vtt',
      f: 'vtt'
    });

    const res = await request(app).get(`/sub/${token}.srt`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-subrip');
    expect(res.text).toContain('00:00:01,000 --> 00:00:02,500');
    expect(res.text).toContain('Proxied subtitle line');
  });

  it('translates upstream subtitles on-the-fly via /translate/:token.srt', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'https://example.com/source.srt') {
        return new Response('1\n00:00:01,000 --> 00:00:03,000\nWake up, Neo.\n', {
          status: 200
        });
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify([{ i: 1, t: 'Despierta, Neo.' }]) }]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('', { status: 404 });
    });

    const token = encodeTranslateToken({
      src: { u: 'https://example.com/source.srt', f: 'srt' },
      fromLang: 'eng',
      toLang: 'spa',
      aiProvider: 'gemini',
      aiApiKey: 'test-key'
    });

    const res = await request(app).get(`/translate/${token}.srt`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('00:00:01,000 --> 00:00:03,000');
    expect(res.text).toContain('Despierta, Neo.');
  });

  it('transcribes media via POST /api/multimodal/transcribe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '1\n00:00:00,000 --> 00:00:02,000\nTranscribed from audio\n'
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await request(app)
      .post('/api/multimodal/transcribe')
      .send({
        mediaBase64: Buffer.from('fake-audio').toString('base64'),
        mimeType: 'audio/mp3',
        targetLang: 'eng',
        apiKey: 'test-gemini-key'
      });

    expect(res.status).toBe(200);
    expect(res.body.srt).toContain('Transcribed from audio');
  });

  it('emits dual-language subtitle tracks and merges + annotates via /dual/:token.srt', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('sub.wyzie.ru')) {
        return new Response(
          JSON.stringify([
            {
              id: 'w-es',
              url: 'https://example.com/sub-es.srt',
              language: 'es',
              format: 'srt',
              encoding: 'UTF-8'
            },
            {
              id: 'w-en',
              url: 'https://example.com/sub-en.srt',
              language: 'en',
              format: 'srt',
              encoding: 'UTF-8'
            }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === 'https://example.com/sub-es.srt') {
        return new Response('1\n00:00:01,000 --> 00:00:03,000\nNo manches, güey.\n', {
          status: 200
        });
      }
      if (url === 'https://example.com/sub-en.srt') {
        return new Response('1\n00:00:01,100 --> 00:00:02,900\nNo way, dude.\n', {
          status: 200
        });
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify([
                        { i: 1, t: 'No manches, güey. [no manches: no way / kidding me]' }
                      ])
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('[]', { status: 200 });
    });

    const cfg = encodeConfig({
      languages: ['spa', 'eng'],
      providers: ['wyzie'],
      aiProvider: 'gemini',
      aiApiKey: 'test-gemini-key',
      aiMode: 'fallback',
      proxySubtitles: true,
      dualSubtitles: true,
      dualSubtitlesNativeLang: 'eng',
      dualSubtitlesAnnotate: true
    });

    const listRes = await request(app).get(`/${cfg}/subtitles/movie/tt0133093.json`);
    expect(listRes.status).toBe(200);

    const dualTrack = listRes.body.subtitles.find((s: { id: string }) =>
      s.id.startsWith('dual-spa-eng-')
    );
    expect(dualTrack).toBeDefined();
    expect(dualTrack.url).toContain('/dual/');

    const dualToken = encodeDualToken({
      primary: { u: 'https://example.com/sub-es.srt', f: 'srt' },
      secondary: { u: 'https://example.com/sub-en.srt', f: 'srt' },
      primaryLang: 'spa',
      secondaryLang: 'eng',
      annotate: true,
      aiProvider: 'gemini',
      aiApiKey: 'test-gemini-key'
    });

    const dualRes = await request(app).get(`/dual/${dualToken}.srt`);
    expect(dualRes.status).toBe(200);
    expect(dualRes.text).toContain('<b>No manches, güey. [no manches: no way / kidding me]</b>');
    expect(dualRes.text).toContain('<font color="#999999">No way, dude.</font>');
  });
});
