import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { parseName } from '../parse.ts';

const values = (name: string) => parseName(name).tags.map((t) => t.value);

describe('parseName (mock)', () => {
  it('reads a movie title and the last year before the tags', () => {
    const p = parseName('Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv');
    expect(p.title).toBe('Blade Runner 2049');
    expect(p.year).toBe(2017);
    expect(values('Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv')).toEqual([
      '2160p',
      'UHD',
      'BluRay',
      'HDR',
      'DTS-HD MA',
      'x265',
    ]);
    expect(p.groups).toEqual(['FraMeSToR']);
  });

  it('keeps dotted tags whole, longest first', () => {
    expect(values('Dune.Part.Two.2024.1080p.WEB-DL.DDP5.1.Atmos.H.264-FLUX.mkv')).toEqual([
      '1080p',
      'WEB-DL',
      'DDP5.1 Atmos',
      'H.264',
    ]);
  });

  it('reads an episode, skips the episode name in the source, and keeps unknown tags', () => {
    const p = parseName('Severance.S01E08.Whats.for.Dinner.1080p.ATVP.WEB-DL.DDP5.1.H.264.MiXED-NTb.mkv');
    expect([p.title, p.season, p.episode]).toEqual(['Severance', 1, 8]);
    expect(p.tags.map((t) => [t.source, t.known])).toEqual([
      ['1080p', true],
      ['ATVP', true],
      ['WEB-DL', true],
      ['DDP5.1', true],
      ['H.264', true],
      ['MiXED', false],
    ]);
    expect(p.groups).toEqual(['NTb']);
  });

  it('reads several groups, in their original order', () => {
    expect(parseName('Severance.S02E03.1080p.WEB.h264-ETHEL[rartv].mkv').groups).toEqual(['ETHEL', 'rartv']);
    expect(parseName('Ted.Lasso.S01E01.720p.WEB.x264-GGEZ-RARBG.mkv').groups).toEqual(['GGEZ', 'RARBG']);
  });

  it('drops the tags the known-tags file maps to null', () => {
    const p = parseName('Ted.Lasso.S04E03.1080p.web-dl.appleVT.265-ELiTE.mkv');
    expect(p.tags).toEqual([
      { source: '1080p', value: '1080p', known: true },
      { source: 'web-dl', value: 'WEB-DL', known: true },
      { source: 'appleVT', value: null, known: true },
      { source: '265', value: 'x265', known: true },
    ]);
  });

  it('marks samples, split parts and multi-episode files as skipped', () => {
    expect(parseName('blade.runner.2049.sample.mkv').skip).toBe('sample');
    expect(parseName('Arrival.2016.1080p.BluRay.x264-SPARKS.cd1.avi').skip).toBe('split-part');
    expect(parseName('The.Office.US.S02E01E02.720p.WEB-DL.mkv').skip).toBe('multi-episode');
    expect(parseName('Severance.S01E01.1080p.WEB-DL.mkv').skip).toBe(null);
  });
});
