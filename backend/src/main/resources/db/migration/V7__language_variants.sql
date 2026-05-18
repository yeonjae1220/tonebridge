-- Language variants: dialects, regional accents, script variants

CREATE TABLE language_variants (
    code          VARCHAR(30)  PRIMARY KEY,
    parent_code   VARCHAR(10)  NOT NULL,
    label         VARCHAR(100) NOT NULL,
    label_native  VARCHAR(100),
    variant_type  VARCHAR(10)  NOT NULL CHECK (variant_type IN ('DIALECT', 'ACCENT', 'SCRIPT')),
    region        VARCHAR(100),
    is_active     BOOLEAN      NOT NULL DEFAULT true
);

CREATE INDEX idx_language_variants_parent ON language_variants (parent_code);

-- ── 한국어 (ko) ───────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('ko-KR',               'ko', '표준어',           '한국어',   'DIALECT', 'Seoul, South Korea'),
  ('ko-KR-x-gyeong',      'ko', '경상도 방언',       '경상도',   'DIALECT', 'Gyeongsang, South Korea'),
  ('ko-KR-x-jeolla',      'ko', '전라도 방언',       '전라도',   'DIALECT', 'Jeolla, South Korea'),
  ('ko-KR-x-chungcheong', 'ko', '충청도 방언',       '충청도',   'DIALECT', 'Chungcheong, South Korea'),
  ('ko-KR-x-gangwon',     'ko', '강원도 방언',       '강원도',   'DIALECT', 'Gangwon, South Korea'),
  ('ko-KR-x-jeju',        'ko', '제주어',            '제줏말',   'DIALECT', 'Jeju Island, South Korea'),
  ('ko-KP',               'ko', '북한 문화어',       '문화어',   'DIALECT', 'Pyongyang, North Korea');

-- ── 일본어 (ja) ───────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('ja-JP',               'ja', '도쿄 표준어',       '標準語',   'DIALECT', 'Tokyo, Japan'),
  ('ja-JP-x-kansai',      'ja', '간사이 방언',       '関西弁',   'DIALECT', 'Osaka/Kyoto, Japan'),
  ('ja-JP-x-kyushu',      'ja', '규슈 방언',         '九州弁',   'DIALECT', 'Kyushu, Japan'),
  ('ja-JP-x-tohoku',      'ja', '도호쿠 방언',       '東北弁',   'DIALECT', 'Tohoku, Japan'),
  ('ja-JP-x-nagoya',      'ja', '나고야 방언',       '名古屋弁', 'DIALECT', 'Nagoya, Japan'),
  ('ryu',                 'ja', '오키나와어',        '琉球語',   'DIALECT', 'Okinawa, Japan');

-- ── 중국어 (zh) ───────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('zh-Hans',             'zh', '보통화 (간체)',     '普通话',   'SCRIPT',  'Mainland China'),
  ('zh-Hant-TW',          'zh', '대만 표준어',      '國語',     'DIALECT', 'Taiwan'),
  ('zh-Hant-HK',          'zh', '홍콩 광둥어',      '廣東話',   'DIALECT', 'Hong Kong'),
  ('zh-CN-x-beijing',     'zh', '베이징 방언',      '北京話',   'DIALECT', 'Beijing, China'),
  ('zh-CN-x-northeast',   'zh', '동북 방언',        '東北話',   'DIALECT', 'Northeast China'),
  ('zh-CN-x-sichuan',     'zh', '쓰촨 방언',        '四川話',   'DIALECT', 'Sichuan, China'),
  ('wuu',                 'zh', '상하이어 (오어)',   '吳語',     'DIALECT', 'Shanghai/Jiangsu/Zhejiang'),
  ('yue',                 'zh', '광둥어',            '粵語',     'DIALECT', 'Guangdong/HK/Macau'),
  ('nan',                 'zh', '민남어 (호키엔)',   '閩南語',   'DIALECT', 'Fujian/Taiwan/SE Asia'),
  ('hak',                 'zh', '하카어',            '客家話',   'DIALECT', 'Multiple regions');

-- ── 영어 (en) — 방언 + 악센트 ───────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('en-US',               'en', '미국 영어',         'American English',     'DIALECT', 'United States'),
  ('en-GB',               'en', '영국 영어',         'British English',      'DIALECT', 'United Kingdom'),
  ('en-AU',               'en', '호주 영어',         'Australian English',   'DIALECT', 'Australia'),
  ('en-CA',               'en', '캐나다 영어',       'Canadian English',     'DIALECT', 'Canada'),
  ('en-IN',               'en', '인도 영어',         'Indian English',       'DIALECT', 'India'),
  ('en-ZA',               'en', '남아공 영어',       'South African English','DIALECT', 'South Africa'),
  ('en-NZ',               'en', '뉴질랜드 영어',    'New Zealand English',  'DIALECT', 'New Zealand'),
  ('en-x-ru-accent',      'en', '러시아 악센트',     null,                   'ACCENT',  'Russian speakers'),
  ('en-x-ko-accent',      'en', '한국식 영어',       null,                   'ACCENT',  'Korean speakers'),
  ('en-x-ja-accent',      'en', '일본식 영어',       null,                   'ACCENT',  'Japanese speakers'),
  ('en-x-zh-accent',      'en', '중국식 영어',       null,                   'ACCENT',  'Chinese speakers'),
  ('en-x-es-accent',      'en', '스페인어권 영어',   null,                   'ACCENT',  'Spanish speakers'),
  ('en-x-fr-accent',      'en', '프랑스식 영어',     null,                   'ACCENT',  'French speakers'),
  ('en-x-ar-accent',      'en', '아랍 악센트',       null,                   'ACCENT',  'Arabic speakers'),
  ('en-x-hi-accent',      'en', '힌디 악센트',       null,                   'ACCENT',  'Hindi speakers'),
  ('en-x-de-accent',      'en', '독일식 영어',       null,                   'ACCENT',  'German speakers'),
  ('en-x-pt-accent',      'en', '포르투갈어권 영어', null,                   'ACCENT',  'Portuguese speakers');

-- ── 스페인어 (es) ─────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('es-ES',               'es', '스페인 스페인어',   'Castellano',           'DIALECT', 'Spain'),
  ('es-MX',               'es', '멕시코 스페인어',   'Español mexicano',     'DIALECT', 'Mexico'),
  ('es-AR',               'es', '아르헨티나 스페인어','Rioplatense',         'DIALECT', 'Argentina'),
  ('es-CO',               'es', '콜롬비아 스페인어', 'Español colombiano',   'DIALECT', 'Colombia'),
  ('es-CL',               'es', '칠레 스페인어',     'Español chileno',      'DIALECT', 'Chile'),
  ('es-419',              'es', '라틴아메리카 (일반)','Latinoamérica',       'DIALECT', 'Latin America');

-- ── 포르투갈어 (pt) ───────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('pt-BR',               'pt', '브라질 포르투갈어', 'Português brasileiro', 'DIALECT', 'Brazil'),
  ('pt-PT',               'pt', '유럽 포르투갈어',   'Português europeu',    'DIALECT', 'Portugal'),
  ('pt-AO',               'pt', '앙골라 포르투갈어', 'Português angolano',   'DIALECT', 'Angola');

-- ── 프랑스어 (fr) ─────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('fr-FR',               'fr', '프랑스 표준어',     'Français standard',    'DIALECT', 'France'),
  ('fr-CA',               'fr', '퀘벡 프랑스어',     'Français québécois',   'DIALECT', 'Quebec, Canada'),
  ('fr-BE',               'fr', '벨기에 프랑스어',   'Français belge',       'DIALECT', 'Belgium'),
  ('fr-CH',               'fr', '스위스 프랑스어',   'Français suisse',      'DIALECT', 'Switzerland'),
  ('fr-MA',               'fr', '마그레브 프랑스어', 'Darija/Français',      'DIALECT', 'Morocco/Algeria');

-- ── 독일어 (de) ───────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('de-DE',               'de', '독일 표준어',       'Hochdeutsch',          'DIALECT', 'Germany'),
  ('de-AT',               'de', '오스트리아 독일어', 'Österreichisch',       'DIALECT', 'Austria'),
  ('de-CH',               'de', '스위스 독일어',     'Schweizerdeutsch',     'DIALECT', 'Switzerland'),
  ('de-x-bavarian',       'de', '바이에른 방언',     'Bairisch',             'DIALECT', 'Bavaria, Germany');

-- ── 러시아어 (ru) ─────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('ru-RU',               'ru', '표준 러시아어',     'Русский стандарт',     'DIALECT', 'Russia');

-- ── 아랍어 (ar) ───────────────────────────────────────────────────────────────
INSERT INTO language_variants (code, parent_code, label, label_native, variant_type, region) VALUES
  ('ar-SA',               'ar', '걸프/사우디 아랍어','الخليجية',            'DIALECT', 'Saudi Arabia/Gulf'),
  ('ar-EG',               'ar', '이집트 아랍어',     'المصرية',             'DIALECT', 'Egypt'),
  ('ar-MA',               'ar', '마그레브 아랍어',   'الدارجة',             'DIALECT', 'Morocco/Algeria'),
  ('ar-LB',               'ar', '레반트 아랍어',     'الشامية',             'DIALECT', 'Lebanon/Syria'),
  ('arb',                 'ar', '현대 표준 아랍어 (MSA)','الفصحى',          'DIALECT', 'Formal/written Arabic');
