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
    const response = await axios.get(`https://bj.sooplive.co.kr/${bj_id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);

    // 방송국 정보 파싱
    const broadcasterName = $('.bj_name').text().trim() || '빡쏘 방송국';
    
    // 임시 공지 데이터 (추후 상세 파싱 확장 가능)
    const notices = [
      { title: 'SOOP 버츄얼 스트리머 빡쏘 방송국에 오신 것을 환영합니다! 🎉', date: '2026-03-01' }
    ];

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