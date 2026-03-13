-- 競合他社の names（別名リスト）を追加
-- ChatGPTが回答で使う表記ゆれに対応するため、複数の名前バリエーションを設定

UPDATE clients
SET competitors = '[
  {
    "name": "Anymind",
    "names": ["Anymind", "AnyMind", "AnyMind Group", "エニーマインド"],
    "score": 68,
    "trend": "+5pt",
    "dir": "up",
    "color": "#FF6B6B"
  },
  {
    "name": "サイバーバズ",
    "names": ["サイバーバズ", "CyberBuzz", "Cyber Buzz", "サイバー・バズ"],
    "score": 55,
    "trend": "+2pt",
    "dir": "up",
    "color": "#4ECDC4"
  },
  {
    "name": "BitStar",
    "names": ["BitStar", "ビットスター", "株式会社BitStar"],
    "score": 42,
    "trend": "+8pt",
    "dir": "up",
    "color": "#2E75B6",
    "self": true
  },
  {
    "name": "トレンダーズ",
    "names": ["トレンダーズ", "Trenders", "株式会社トレンダーズ"],
    "score": 38,
    "trend": "-1pt",
    "dir": "down",
    "color": "#F7DC6F"
  },
  {
    "name": "Natee",
    "names": ["Natee", "ネイティー", "株式会社Natee"],
    "score": 35,
    "trend": "+3pt",
    "dir": "up",
    "color": "#A29BFE"
  },
  {
    "name": "Grove",
    "names": ["Grove", "グローブ", "株式会社Grove"],
    "score": 30,
    "trend": "+1pt",
    "dir": "up",
    "color": "#55EFC4"
  }
]'::jsonb
WHERE email = 't.watanabe@bitstar.tokyo';

-- 確認
SELECT
  name,
  jsonb_array_length(competitors) AS competitor_count,
  competitors->0->'names' AS first_comp_names
FROM clients
WHERE email = 't.watanabe@bitstar.tokyo';
