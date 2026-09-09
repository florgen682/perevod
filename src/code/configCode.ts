export const requirementsTxt = `# ScreenTranslate — зависимости
# ================================

# Захват экрана
mss>=9.0.0

# OCR — EasyOCR (основной вариант)
easyocr>=1.7.0

# OCR — Tesseract (альтернативный вариант)
# pytesseract>=0.3.10
# Pillow>=10.0.0

# LLM API (OpenAI-совместимый)
openai>=1.0.0

# GUI — PyQt6
PyQt6>=6.6.0

# Конфигурация
PyYAML>=6.0.0

# Математические операции для обработки изображений
numpy>=1.24.0

# Опционально: для системного трея
# pystray>=0.19.0
`;

export const configYaml = `# ============================================================
# ScreenTranslate — конфигурация
# ============================================================

# Язык исходного текста на экране
source_lang: "en"

# Язык перевода
target_lang: "ru"

# API-ключ (для OpenAI или совместимых сервисов)
# Для Ollama можно оставить любой (например, "ollama")
api_key: "sk-placeholder"

# URL API-сервиса
# Ollama (локально): http://localhost:11434/v1
# LM Studio (локально): http://localhost:1234/v1
# OpenAI: https://api.openai.com/v1
base_url: "http://localhost:11434/v1"

# Модель LLM
# Ollama: "llama3", "mistral", "qwen2.5"
# OpenAI: "gpt-4o-mini", "gpt-4o"
# LM Studio: имя загруженной модели
model: "llama3"

# Интервал захвата экрана (в секундах)
capture_interval: 2.0

# Языки для OCR
ocr_languages:
  - "en"
  - "ru"

# Область захвата экрана (опционально)
# Если не указано — захватывается весь экран
# capture_region:
#   top: 100
#   left: 200
#   width: 800
#   height: 200
`;
