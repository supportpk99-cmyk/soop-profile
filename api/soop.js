import axios from 'axios';
import * as cheerio from 'cheerio';

// 10분 메모리 캐시 설정 (SOOP 서버 차단 방지)
let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분

export default async function handler(req, res) {
  // CORS 허용 헤더 (내 홈페이지에서 안전하게 가져가도록 설정)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { bj_id } = req.query;

  if (!bj_id) {
    return res.status(400).json({ error: 'bj_id가 필요합니다. (예: ?bj_id=내아이디)' });
  }

  const now = Date.now();

  // 캐시가 남아있고 10분이 지나지 않았다면 캐시 데이터 반환
  if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
    return res.status(200).json({ source: 'cache', data: cachedData });
  }

  try {
    // SOOP 방송국 페이지 요청
    const response = await axios.get(`https://bj.sooplive.co.kr/${bj_id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);

    // 방송국 타이틀이나 기본 정보 추출 예시
    const broadcasterName = $('.bj_name').text().trim() || bj_id;

    const result = {
      bj_id,
      broadcasterName,
      notices: [], // 추후 공지사항 파싱 추가 예정
      updatedAt: new Date().toISOString()
    };

    // 캐시 저장
    cachedData = result;
    lastFetchTime = now;

    return res.status(200).json({ source: 'live', data: result });
  } catch (error) {
    // 에러 발생 시 기존 캐시 데이터가 있다면 대체 반환 (사이트 터짐 방지)
    if (cachedData) {
      return res.status(200).json({ source: 'fallback_cache', data: cachedData });
    }
    return res.status(500).json({ error: 'SOOP 데이터를 가져오는데 실패했습니다.' });
  }
}