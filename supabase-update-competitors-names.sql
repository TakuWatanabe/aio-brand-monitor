-- 競合他社の names（別名リスト）を追加・更新
-- ChatGPT/Gemini が日本語クエリで使う表記ゆれに対応

UPDATE clients
SET competitors = '[
  {
    "name": "Anymind",
    "names": ["Anymind", "AnyMind", "AnyMind Group", "エニーマインド", "エニーマインドグループ", "AnyMind Group株式会社"],
    "score": 0,
    "trend": "+0pt",
    "dir": "up",
    "color": "#FF6B6B"
  },
  {
    "name": "サイバーバズ",
    "names": ["サイバーバズ", "CyberBuzz", "Cyber Buzz", "サイバー・バズ", "株式会社サイバーバズ"],
    "score": 0,
    "trend": "+0pt",
    "dir": "up",
    "color": "#4ECDC4"
  },
  {
    "name": "BitStar",
    "names": ["BitStar", "ビットスター", "株式会社BitStar", "ビットスター株式会社"],
    "score": 0,
    "trend": "+0pt",
    "dir": "up",
    "color": "#2E75B6",
    "self": true
  },
  {
    "name": "トレンダーズ",
    "names": ["トレンダーズ", "Trenders", "株式会社トレンダーズ", "トレンダーズ株式会社"],
    "score": 0,
    "trend": "+0pt",
    "dir": "up",
    "color": "#F7DC6F"
  },
  {
    "name": "Natee",
    "names": ["Natee", "ネイティー", "株式会社Natee", "ナティー"],
    "score": 0,
    "trend": "+0pt",
    "dir": "up",
    "color": "#A29BFE"
  },
  {
    "name": "Grove",
    "names": ["Grove", "グローブ", "株式会社Grove", "グローブ株式会社"],
    "score": 0,
    "trend": "+0pt",
    "dir": "up",
    "color": "#55EFC4"
  }
]'::jsonb
WHERE email = 't.watanabe@bitstar.tokyo';

-- 確認
SELECT
  name,
  competitors->0->>'name' AS first_comp,
  competitors->0->'names' AS first_comp_names
FROM clients
WHERE email = 't.watanabe@bitstar.tokyo';
