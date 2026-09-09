export const mainCode = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ScreenTranslate — Экраный переводчик в реальном времени.

Программа захватывает выбранную область экрана, распознаёт текст через OCR,
переводит его через LLM (OpenAI-совместимый API) и выводит результат
в виде оверлея поверх других окон.

Горячие клавиши:
  - F9: Включить/выключить захват экрана
  - F10: Показать/скрыть окно выбора области
  - Ctrl+Q: Выход из программы
"""

import asyncio
import hashlib
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import yaml
from PyQt6.QtCore import Qt, QTimer, QRect, QPoint, pyqtSignal
from PyQt6.QtGui import QPainter, QColor, QFont, QKeySequence
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QLabel,
    QVBoxLayout, QSystemTrayIcon, QMenu, QShortcut
)

import mss
import mss.tools
from openai import AsyncOpenAI

# ============================================================
# Настройка логирования
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('ScreenTranslate')


# ============================================================
# Конфигурация
# ============================================================
@dataclass
class Config:
    """Класс для хранения конфигурации приложения."""
    source_lang: str = "en"
    target_lang: str = "ru"
    api_key: str = "sk-placeholder"
    base_url: str = "http://localhost:11434/v1"  # Ollama по умолчанию
    model: str = "llama3"
    capture_interval: float = 2.0  # секунды
    ocr_languages: list = field(default_factory=lambda: ["en", "ru"])
    capture_region: Optional[dict] = None  # {"top": 100, "left": 200, "width": 800, "height": 200}

    @classmethod
    def from_yaml(cls, path: str = "config.yaml") -> 'Config':
        """Загрузка конфигурации из YAML-файла."""
        config_path = Path(path)
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        logger.warning(f"Конфиг-файл {path} не найден, используются настройки по умолчанию")
        return cls()

    def save_yaml(self, path: str = "config.yaml") -> None:
        """Сохранение конфигурации в YAML-файл."""
        data = {
            'source_lang': self.source_lang,
            'target_lang': self.target_lang,
            'api_key': self.api_key,
            'base_url': self.base_url,
            'model': self.model,
            'capture_interval': self.capture_interval,
            'ocr_languages': self.ocr_languages,
            'capture_region': self.capture_region,
        }
        with open(path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
        logger.info(f"Конфигурация сохранена в {path}")


# ============================================================
# Захват экрана
# ============================================================
class ScreenCapture:
    """
    Класс для захвата выбранной области экрана.
    Использует библиотеку mss для быстрого скриншотинга.
    """

    def __init__(self, region: Optional[dict] = None):
        """
        Инициализация захвата экрана.

        Args:
            region: Словарь с координатами области {"top", "left", "width", "height"}
                   Если None — захватывается весь экран.
        """
        self.sct = mss.mss()
        self.region = region or self._get_full_screen()
        self._last_capture: Optional[np.ndarray] = None

    def _get_full_screen(self) -> dict:
        """Получить параметры всего экрана."""
        monitor = self.sct.monitors[0]  # Все мониторы
        return {
            "top": monitor["top"],
            "left": monitor["left"],
            "width": monitor["width"],
            "height": monitor["height"],
        }

    def capture(self) -> np.ndarray:
        """
        Захватить область экрана.

        Returns:
            numpy.ndarray: Изображение в формате BGR (для OpenCV-совместимости)
        """
        try:
            screenshot = self.sct.grab(self.region)
            # Преобразуем в numpy array (BGRA -> BGR)
            img = np.array(screenshot)
            self._last_capture = img
            return img
        except Exception as e:
            logger.error(f"Ошибка захвата экрана: {e}")
            raise

    def get_image_hash(self, image: np.ndarray) -> str:
        """
        Вычислить хэш изображения для кэширования.
        Используется для определения, изменился ли контент на экране.
        """
        # Упрощаем изображение для быстрого сравнения
        # Берём каждый 4-й пиксель для уменьшения размера
        simplified = image[::4, ::4, :3]  # Убираем альфа-канал
        return hashlib.md5(simplified.tobytes()).hexdigest()

    def set_region(self, region: dict) -> None:
        """Установить новую область захвата."""
        self.region = region
        logger.info(f"Область захвата обновлена: {region}")


# ============================================================
# OCR-движок
# ============================================================
class OCREngine:
    """
    Класс для распознавания текста на изображении.
    Поддерживает EasyOCR и Tesseract.
    """

    def __init__(self, languages: list = None, backend: str = "easyocr"):
        """
        Инициализация OCR-движка.

        Args:
            languages: Список языков для распознавания (например, ["en", "ru"])
            backend: "easyocr" или "tesseract"
        """
        self.languages = languages or ["en", "ru"]
        self.backend = backend
        self._reader = None

        if backend == "easyocr":
            self._init_easyocr()
        elif backend == "tesseract":
            self._init_tesseract()
        else:
            raise ValueError(f"Неизвестный OCR-бэкенд: {backend}")

    def _init_easyocr(self) -> None:
        """Инициализация EasyOCR."""
        try:
            import easyocr
            logger.info(f"Инициализация EasyOCR для языков: {self.languages}")
            self._reader = easyocr.Reader(self.languages, gpu=False)
            logger.info("EasyOCR инициализирован успешно")
        except ImportError:
            logger.error("EasyOCR не установлен. Установите: pip install easyocr")
            raise
        except Exception as e:
            logger.error(f"Ошибка инициализации EasyOCR: {e}")
            raise

    def _init_tesseract(self) -> None:
        """Инициализация Tesseract."""
        try:
            import pytesseract
            # Проверяем доступность tesseract
            pytesseract.get_tesseract_version()
            logger.info("Tesseract инициализирован успешно")
        except ImportError:
            logger.error("pytesseract не установлен. Установите: pip install pytesseract")
            raise
        except Exception as e:
            logger.error(f"Ошибка инициализации Tesseract: {e}")
            raise

    def recognize(self, image: np.ndarray) -> str:
        """
        Распознать текст на изображении.

        Args:
            image: Изображение в формате numpy array (BGRA от mss)

        Returns:
            str: Распознанный текст
        """
        start_time = time.time()

        try:
            if self.backend == "easyocr":
                text = self._recognize_easyocr(image)
            else:
                text = self._recognize_tesseract(image)

            elapsed = time.time() - start_time
            logger.info(f"OCR завершён за {elapsed:.2f}с, распознано {len(text)} символов")

            if not text.strip():
                logger.warning("OCR не распознал текст на изображении")
                return ""

            return text.strip()

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Ошибка OCR (время: {elapsed:.2f}с): {e}")
            return ""

    def _recognize_easyocr(self, image: np.ndarray) -> str:
        """Распознавание через EasyOCR."""
        # EasyOCR ожидает BGR формат
        if image.shape[2] == 4:
            image = image[:, :, :3]  # Убираем альфа-канал

        results = self._reader.readtext(image)
        # Сортируем результаты по позиции (сверху вниз, слева направо)
        results.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
        texts = [result[1] for result in results]
        return "\\n".join(texts)

    def _recognize_tesseract(self, image: np.ndarray) -> str:
        """Распознавание через Tesseract."""
        import pytesseract
        from PIL import Image

        # Конвертируем BGR -> RGB для PIL
        if image.shape[2] == 4:
            rgb_image = image[:, :, [2, 1, 0, 3]]
        else:
            rgb_image = image[:, :, ::-1]

        pil_image = Image.fromarray(rgb_image)
        lang_code = "+".join(self.languages)
        text = pytesseract.image_to_string(pil_image, lang=lang_code)
        return text


# ============================================================
# LLM-переводчик
# ============================================================
class LLMTranslator:
    """
    Класс для перевода текста через LLM (OpenAI-совместимый API).
    Поддерживает OpenAI, Ollama, LM Studio и другие совместимые сервисы.
    """

    TRANSLATION_PROMPT = """Ты — переводчик интерфейса. Переведи следующий текст, \
распознанный с экрана, с {source_lang} на {target_lang}. \
Сохрани форматирование.
Учитывай, что это UI-элемент, поэтому используй короткие и точные формулировки.
Текст: {recognized_text}"""

    def __init__(self, config: Config):
        """
        Инициализация LLM-переводчика.

        Args:
            config: Конфигурация приложения
        """
        self.config = config
        self.client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
        )
        self._cache: dict[str, str] = {}  # Кэш переводов
        self._text_cache: dict[str, str] = {}  # Кэш: хэш текста -> перевод

    def _get_text_hash(self, text: str) -> str:
        """Вычислить хэш текста для кэширования."""
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    async def translate(self, text: str) -> str:
        """
        Перевести текст через LLM.

        Args:
            text: Текст для перевода

        Returns:
            str: Переведённый текст
        """
        if not text.strip():
            return ""

        start_time = time.time()

        # Проверяем кэш
        text_hash = self._get_text_hash(text)
        if text_hash in self._text_cache:
            logger.info("Используем кэшированный перевод")
            return self._text_cache[text_hash]

        # Формируем промпт
        prompt = self.TRANSLATION_PROMPT.format(
            source_lang=self.config.source_lang,
            target_lang=self.config.target_lang,
            recognized_text=text
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "Ты — профессиональный переводчик UI-элементов. Отвечай только переводом, без пояснений."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Низкая температура для точности
                max_tokens=1000,
            )

            translation = response.choices[0].message.content.strip()
            elapsed = time.time() - start_time

            logger.info(f"LLM ответ получен за {elapsed:.2f}с")

            # Сохраняем в кэш
            self._text_cache[text_hash] = translation

            return translation

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Ошибка LLM API (время: {elapsed:.2f}с): {e}")
            return f"[Ошибка перевода: {str(e)[:50]}]"

    def clear_cache(self) -> None:
        """Очистить кэш переводов."""
        self._text_cache.clear()
        logger.info("Кэш переводов очищен")


# ============================================================
# Окно-оверлей
# ============================================================
class OverlayWindow(QWidget):
    """
    Полупрозрачное окно-оверлей для отображения перевода.
    Поверх всех окон, с возможностью перетаскивания.
    """

    def __init__(self):
        super().__init__()
        self._init_ui()
        self._is_dragging = False
        self._drag_position = QPoint()

    def _init_ui(self) -> None:
        """Инициализация интерфейса оверлея."""
        # Настройки окна
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)

        # Позиция и размер
        self.setGeometry(100, 100, 600, 150)
        self.setMinimumSize(300, 80)

        # Layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)

        # Метка с переводом
        self.label = QLabel("Ожидание текста...")
        self.label.setFont(QFont("Segoe UI", 14))
        self.label.setStyleSheet("""
            QLabel {
                color: #ffffff;
                background-color: rgba(30, 30, 30, 220);
                border-radius: 12px;
                padding: 15px;
                border: 1px solid rgba(100, 100, 255, 100);
            }
        """)
        self.label.setWordWrap(True)
        self.label.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)

        layout.addWidget(self.label)

        # Статус-бар
        self.status_label = QLabel("⏸ Пауза | F9 — запустить")
        self.status_label.setFont(QFont("Segoe UI", 9))
        self.status_label.setStyleSheet("""
            QLabel {
                color: rgba(200, 200, 200, 180);
                background-color: rgba(20, 20, 20, 180);
                border-radius: 6px;
                padding: 4px 8px;
            }
        """)
        layout.addWidget(self.status_label)

    def update_text(self, text: str) -> None:
        """Обновить текст в оверлее."""
        self.label.setText(text)
        # Автоматически подстраиваем высоту
        self.label.adjustSize()

    def update_status(self, status: str) -> None:
        """Обновить статус-бар."""
        self.status_label.setText(status)

    def paintEvent(self, event) -> None:
        """Перерисовка окна (для закруглённых углов)."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Полупрозрачный фон
        painter.setBrush(QColor(30, 30, 30, 200))
        painter.setPen(QColor(80, 80, 200, 100))
        painter.drawRoundedRect(self.rect(), 12, 12)

    def mousePressEvent(self, event) -> None:
        """Обработка нажатия мыши для перетаскивания."""
        if event.button() == Qt.MouseButton.LeftButton:
            self._is_dragging = True
            self._drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()

    def mouseMoveEvent(self, event) -> None:
        """Обработка перемещения мыши."""
        if self._is_dragging:
            self.move(event.globalPosition().toPoint() - self._drag_position)

    def mouseReleaseEvent(self, event) -> None:
        """Обработка отпускания мыши."""
        self._is_dragging = False


# ============================================================
# Главное приложение
# ============================================================
class ScreenTranslateApp(QMainWindow):
    """
    Главное окно приложения.
    Управляет всеми компонентами: захватом, OCR, переводом и отображением.
    """

    # Сигнал для обновления текста в оверлее (для потокобезопасности)
    translation_ready = pyqtSignal(str)
    status_changed = pyqtSignal(str)

    def __init__(self, config: Config):
        super().__init__()
        self.config = config
        self.is_capturing = False
        self._last_image_hash: Optional[str] = None

        # Инициализация компонентов
        self.capture = ScreenCapture(config.capture_region)
        self.ocr = OCREngine(languages=config.ocr_languages)
        self.translator = LLMTranslator(config)

        # Оверлей
        self.overlay = OverlayWindow()
        self.overlay.show()

        # Таймер для периодического захвата
        self.capture_timer = QTimer()
        self.capture_timer.timeout.connect(self._on_capture_tick)

        # Настройка горячих клавиш
        self._setup_shortcuts()

        # Подключение сигналов
        self.translation_ready.connect(self.overlay.update_text)
        self.status_changed.connect(self.overlay.update_status)

        # Настройка трея
        self._setup_tray()

        logger.info("Приложение инициализировано")

    def _setup_shortcuts(self) -> None:
        """Настройка горячих клавиш."""
        # F9 — вкл/выкл захват
        shortcut_capture = QShortcut(QKeySequence("F9"), self)
        shortcut_capture.activated.connect(self.toggle_capture)

        # F10 — показать/скрыть оверлей
        shortcut_overlay = QShortcut(QKeySequence("F10"), self)
        shortcut_overlay.activated.connect(self.toggle_overlay)

        # Ctrl+Q — выход
        shortcut_quit = QShortcut(QKeySequence("Ctrl+Q"), self)
        shortcut_quit.activated.connect(self.quit_app)

    def _setup_tray(self) -> None:
        """Настройка иконки в системном трее."""
        self.tray_icon = QSystemTrayIcon(self)
        # Используем стандартную иконку
        self.tray_icon.setIcon(self.style().standardIcon(
            self.style().StandardPixmap.SP_ComputerIcon
        ))
        self.tray_icon.setToolTip("ScreenTranslate — Экраный переводчик")

        # Меню трея
        tray_menu = QMenu()
        toggle_action = tray_menu.addAction("Вкл/Выкл захват (F9)")
        toggle_action.triggered.connect(self.toggle_capture)

        overlay_action = tray_menu.addAction("Показать/Скрыть оверлей (F10)")
        overlay_action.triggered.connect(self.toggle_overlay)

        tray_menu.addSeparator()

        quit_action = tray_menu.addAction("Выход (Ctrl+Q)")
        quit_action.triggered.connect(self.quit_app)

        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.show()

    def toggle_capture(self) -> None:
        """Включить/выключить захват экрана."""
        self.is_capturing = not self.is_capturing

        if self.is_capturing:
            interval_ms = int(self.config.capture_interval * 1000)
            self.capture_timer.start(interval_ms)
            self.status_changed.emit("▶ Активен | F9 — пауза")
            logger.info(f"Захват включён (интервал: {self.config.capture_interval}с)")
        else:
            self.capture_timer.stop()
            self.status_changed.emit("⏸ Пауза | F9 — запустить")
            logger.info("Захват выключен")

    def toggle_overlay(self) -> None:
        """Показать/скрыть окно оверлея."""
        if self.overlay.isVisible():
            self.overlay.hide()
        else:
            self.overlay.show()

    def quit_app(self) -> None:
        """Выход из приложения."""
        logger.info("Завершение работы...")
        self.capture_timer.stop()
        self.overlay.close()
        QApplication.quit()

    def _on_capture_tick(self) -> None:
        """Обработчик тика таймера захвата."""
        if not self.is_capturing:
            return

        # Запускаем асинхронную задачу
        asyncio.ensure_future(self._process_capture())

    async def _process_capture(self) -> None:
        """
        Основной цикл обработки: захват -> OCR -> перевод -> отображение.
        """
        total_start = time.time()

        try:
            # 1. Захват экрана
            image = self.capture.capture()

            # 2. Проверяем, изменилось ли изображение
            image_hash = self.capture.get_image_hash(image)
            if image_hash == self._last_image_hash:
                logger.debug("Изображение не изменилось, пропускаем")
                return
            self._last_image_hash = image_hash

            # 3. OCR
            text = self.ocr.recognize(image)
            if not text:
                self.status_changed.emit("⚠ Текст не распознан")
                return

            # 4. Перевод через LLM
            translation = await self.translator.translate(text)

            # 5. Отображение результата
            total_elapsed = time.time() - total_start
            self.translation_ready.emit(translation)
            self.status_changed.emit(
                f"✅ Обновлено | Латентность: {total_elapsed:.2f}с | F9 — пауза"
            )
            logger.info(f"Полная латентность: {total_elapsed:.2f}с")

        except Exception as e:
            logger.error(f"Ошибка в цикле обработки: {e}")
            self.status_changed.emit(f"❌ Ошибка: {str(e)[:30]}")


# ============================================================
# Точка входа
# ============================================================
def main():
    """Главная функция запуска приложения."""
    # Загрузка конфигурации
    config = Config.from_yaml("config.yaml")

    # Если конфиг не существует — создаём шаблон
    if not Path("config.yaml").exists():
        config.save_yaml("config.yaml")
        logger.info("Создан файл config.yaml с настройками по умолчанию")

    # Запуск Qt-приложения
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)  # Не закрываем при скрытии окна

    # Создаём главное приложение
    main_app = ScreenTranslateApp(config)

    # Запускаем event loop в отдельном потоке для asyncio
    import threading

    def run_async_loop():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_forever()

    async_thread = threading.Thread(target=run_async_loop, daemon=True)
    async_thread.start()

    # Устанавливаем event loop для asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Интеграция asyncio с Qt event loop
    timer = QTimer()
    timer.timeout.connect(lambda: loop.run_until_complete(asyncio.sleep(0)))
    timer.start(50)  # 50мс

    logger.info("=" * 50)
    logger.info("ScreenTranslate запущен!")
    logger.info("  F9  — Вкл/Выкл захват")
    logger.info("  F10 — Показать/Скрыть оверлей")
    logger.info("  Ctrl+Q — Выход")
    logger.info("=" * 50)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
`;
