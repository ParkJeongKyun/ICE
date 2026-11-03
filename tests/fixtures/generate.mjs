/**
 * E2E 테스트용 샘플 파일 생성 (결과 파일은 커밋되어 있으므로 바꿀 때만 실행)
 *   node tests/fixtures/generate.mjs
 *
 * - sample.jpg: EXIF(Make/Model/DateTime)가 들어간 JPEG
 * - sample.png: tEXt 청크(Comment)가 들어간 PNG
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { chromium } from '@playwright/test';

// 테스트(tests/e2e/helpers.ts)도 같은 값을 읽어 화면에 표시되는지 확인
import values from './values.json' with { type: 'json' };

const DIR = dirname(fileURLToPath(import.meta.url));

/** 브라우저 canvas로 실제 디코딩 가능한 작은 이미지를 만든다 */
async function renderImages() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 8, 16, 16);
    return {
      jpeg: canvas.toDataURL('image/jpeg', 0.9),
      png: canvas.toDataURL('image/png'),
    };
  });
  await browser.close();
  const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
  return { jpeg: decode(result.jpeg), png: decode(result.png) };
}

/** IFD0에 ASCII 태그만 담은 리틀엔디언 TIFF/EXIF 블록 */
function buildExif(tags) {
  const entries = tags.map(([tag, value]) => ({
    tag,
    data: Buffer.from(`${value}\0`, 'ascii'),
  }));
  const ifdSize = 2 + entries.length * 12 + 4;
  let dataOffset = 8 + ifdSize;

  const ifd = Buffer.alloc(ifdSize);
  ifd.writeUInt16LE(entries.length, 0);
  const extraData = [];
  entries.forEach(({ tag, data }, i) => {
    const pos = 2 + i * 12;
    ifd.writeUInt16LE(tag, pos);
    ifd.writeUInt16LE(2, pos + 2); // ASCII
    ifd.writeUInt32LE(data.length, pos + 4);
    if (data.length <= 4) {
      data.copy(ifd, pos + 8);
    } else {
      ifd.writeUInt32LE(dataOffset, pos + 8);
      extraData.push(data);
      dataOffset += data.length;
    }
  });

  const tiffHeader = Buffer.from([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from('Exif\0\0', 'ascii'),
    tiffHeader,
    ifd,
    ...extraData,
  ]);
}

function insertExif(jpeg, exif) {
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(exif.length + 2, 2);
  // SOI(FFD8) 바로 뒤에 APP1 삽입
  return Buffer.concat([jpeg.subarray(0, 2), app1, exif, jpeg.subarray(2)]);
}

function insertTextChunk(png, keyword, text) {
  const body = Buffer.concat([
    Buffer.from('tEXt', 'ascii'),
    Buffer.from(`${keyword}\0${text}`, 'latin1'),
  ]);
  const chunk = Buffer.alloc(4 + body.length + 4);
  chunk.writeUInt32BE(body.length - 4, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), 4 + body.length);
  // IEND 청크(마지막 12바이트) 앞에 삽입
  const iend = png.length - 12;
  return Buffer.concat([png.subarray(0, iend), chunk, png.subarray(iend)]);
}

const { jpeg, png } = await renderImages();

writeFileSync(
  join(DIR, 'sample.jpg'),
  insertExif(
    jpeg,
    buildExif([
      [0x010f, values.exifMake],
      [0x0110, values.exifModel],
      [0x0132, values.exifDateTime],
    ])
  )
);
writeFileSync(
  join(DIR, 'sample.png'),
  insertTextChunk(png, values.pngTextKeyword, values.pngText)
);
console.log('fixtures written to', DIR);
