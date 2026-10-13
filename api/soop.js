import axios from 'axios';
import * as cheerio from 'cheerio';

let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { bj_id } = req.query;

  if (!bj_id) {
    return res.status(400).json({ error: 'bj_id가 필요합니다.' });
  }

  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
    return res.status(200).json({ source: 'cache', data: cachedData });
  }

  try {
    // SOOP 방송국 메인 페이지 및 게시판 데이터 요청
    const response = await axios.get(`https://bj.sooplive.co.kr/${bj_id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);

    // 방송국 이름
    const broadcasterName = $('.bj_name').text().trim() || '빡쏘';

    // 최신 공지글 긁어오기 (SOOP 방송국 메인 공지 요소 파싱)
    const notices = [];
    $('.post_list li, .notice_list li, #notice_list li').each((i, el) => {
      if (i >= 5) return; // 최신 5개만
      const title = $(el).find('a').text().trim();
      const link = $(el).find('a').attr('href');
      const date = $(el).find('.date, .time').text().trim();

      if (title) {
        notices.push({
          title,
          url: link ? (link.startsWith('http') ? link : `https://bj.sooplive.co.kr${link}`) : `https://bj.sooplive.co.kr/${bj_id}`,
          date: date || '최신'
        });
      }
    });

    // 만약 파싱된 공지가 없을 경우 방송국 메인 공지 링크 제공
    if (notices.length === 0) {
      notices.push({
        title: '📢 빡쏘 방송국 최신 공지사항 바로가기',
        url: `https://www.sooplive.com/station/${bj_id}/board`,
        date: 'SOOP 이동'
      });
    }

    const result = {
      bj_id,
      broadcasterName,
      notices,
      updatedAt: new Date().toISOString()
    };

    cachedData = result;
    lastFetchTime = now;

    return res.status(200).json({ source: 'live', data: result });
  } catch (error) {
    if (cachedData) {
      return res.status(200).json({ source: 'fallback_cache', data: cachedData });
    }
    return res.status(500).json({ error: '데이터를 가져오지 못했습니다.' });
  }
}