import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import { mainCode } from './code/mainCode';
import { requirementsTxt, configYaml } from './code/configCode';

type TabId = 'main' | 'requirements' | 'config' | 'instructions';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'main', label: 'main.py', icon: '🐍' },
  { id: 'requirements', label: 'requirements.txt', icon: '📦' },
  { id: 'config', label: 'config.yaml', icon: '⚙️' },
  { id: 'instructions', label: 'Инструкция', icon: '📖' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-900/30"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Скопировано!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Копировать
        </>
      )}
    </button>
  );
}

function InstructionsTab() {
  return (
    <div className="prose prose-invert max-w-none p-6">
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-3xl">🚀</span> Быстрый старт
          </h2>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <div className="space-y-3">
              <Step number={1} text="Установите Python 3.9+ (если ещё не установлен)" />
              <Step number={2} text="Создайте виртуальное окружение:" />
              <CodeBlock code="python -m venv venv\nsource venv/bin/activate  # Linux/Mac\nvenv\\Scripts\\activate    # Windows" />
              <Step number={3} text="Установите зависимости:" />
              <CodeBlock code="pip install -r requirements.txt" />
              <Step number={4} text="Настройте config.yaml (укажите API-ключ, модель и т.д.)" />
              <Step number={5} text="Запустите программу:" />
              <CodeBlock code="python main.py" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-3xl">🤖</span> Настройка LLM
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LLMOption
              name="Ollama (локально)"
              steps={[
                "Установите Ollama: https://ollama.ai",
                "Загрузите модель: ollama pull llama3",
                "base_url: http://localhost:11434/v1",
                "api_key: любой (например, 'ollama')",
              ]}
            />
            <LLMOption
              name="OpenAI"
              steps={[
                "Получите API-ключ на platform.openai.com",
                "base_url: https://api.openai.com/v1",
                "api_key: sk-ваш-ключ",
                "model: gpt-4o-mini",
              ]}
            />
            <LLMOption
              name="LM Studio (локально)"
              steps={[
                "Установите LM Studio: https://lmstudio.ai",
                "Загрузите и запустите модель",
                "base_url: http://localhost:1234/v1",
                "api_key: любой (например, 'lm-studio')",
              ]}
            />
            <LLMOption
              name="Другой OpenAI-совместимый"
              steps={[
                "Укажите base_url вашего сервиса",
                "Укажите api_key (если требуется)",
                "Укажите model (имя модели)",
                "API должен поддерживать /v1/chat/completions",
              ]}
            />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-3xl">⌨️</span> Горячие клавиши
          </h2>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Hotkey keys="F9" description="Вкл/Выкл захват экрана" />
              <Hotkey keys="F10" description="Показать/Скрыть оверлей" />
              <Hotkey keys="Ctrl+Q" description="Выход из программы" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-3xl">📋</span> Системные требования
          </h2>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Python 3.9 или выше
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Windows 10/11, macOS 12+, или Linux (X11/Wayland)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> 4+ ГБ RAM (для EasyOCR)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">⚡</span> GPU опционально (ускоряет OCR)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Доступ к LLM API (локальный или облачный)
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-3xl">🏗️</span> Архитектура
          </h2>
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────┐
│                    ScreenTranslateApp                        │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ScreenCapture │──▶│  OCREngine   │──▶│LLMTranslator │    │
│  │   (mss)      │   │  (easyocr)   │   │  (openai)    │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│         │                                      │             │
│         │         ┌──────────────┐             │             │
│         └────────▶│OverlayWindow │◀────────────┘             │
│                   │   (PyQt6)    │                           │
│                   └──────────────┘                           │
│                                                              │
│  Кэширование: хэш изображения → пропуск OCR                │
│               хэш текста → пропуск LLM                      │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
        {number}
      </span>
      <span className="text-gray-200">{text}</span>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400 border border-gray-700 overflow-x-auto">
      <pre>{code}</pre>
    </div>
  );
}

function LLMOption({ name, steps }: { name: string; steps: string[] }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-blue-400 mb-2">{name}</h3>
      <ul className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
            <span className="text-gray-500 mt-0.5">•</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hotkey({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 border border-gray-700">
      <kbd className="px-3 py-1.5 bg-gray-700 rounded-md text-white font-mono text-sm border border-gray-600 shadow-md">
        {keys}
      </kbd>
      <span className="text-gray-300 text-sm">{description}</span>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('main');

  const getCodeForTab = (tab: TabId): string => {
    switch (tab) {
      case 'main': return mainCode;
      case 'requirements': return requirementsTxt;
      case 'config': return configYaml;
      default: return '';
    }
  };

  const getLanguageForTab = (tab: TabId): string => {
    switch (tab) {
      case 'main': return 'python';
      case 'requirements': return 'bash';
      case 'config': return 'yaml';
      default: return 'text';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-blue-900/30">
                🌐
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  ScreenTranslate
                </h1>
                <p className="text-xs text-gray-500">Экранный переводчик в реальном времени</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
              <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono text-xs">Python 3.9+</span>
              <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono text-xs">PyQt6</span>
              <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono text-xs">EasyOCR</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Description */}
        <div className="mb-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl p-6 border border-blue-800/30">
          <h2 className="text-lg font-semibold text-white mb-2">📝 Описание проекта</h2>
          <p className="text-gray-300 leading-relaxed">
            Прототип программы для экранного перевода в реальном времени. Захватывает выбранную область экрана,
            распознаёт текст через OCR (EasyOCR/Tesseract), переводит через LLM (OpenAI/Ollama/LM Studio)
            и выводит результат в виде оверлея поверх других окон. Поддерживает кэширование, горячие клавиши
            и сворачивание в системный трей.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-4 bg-gray-800/50 rounded-xl p-1.5 border border-gray-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Code Panel */}
        <div className="bg-gray-900 rounded-2xl border border-gray-700/50 overflow-hidden shadow-2xl">
          {/* Code Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-sm text-gray-400 font-mono">
                {tabs.find(t => t.id === activeTab)?.label}
              </span>
            </div>
            {activeTab !== 'instructions' && (
              <CopyButton text={getCodeForTab(activeTab)} />
            )}
          </div>

          {/* Code Content */}
          <div className="max-h-[75vh] overflow-auto">
            {activeTab === 'instructions' ? (
              <InstructionsTab />
            ) : (
              <SyntaxHighlighter
                language={getLanguageForTab(activeTab)}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  background: 'transparent',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                }}
                showLineNumbers
                lineNumberStyle={{
                  color: '#4a5568',
                  fontSize: '0.75rem',
                  paddingRight: '1rem',
                }}
              >
                {getCodeForTab(activeTab)}
              </SyntaxHighlighter>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon="🖥️"
            title="Захват экрана"
            description="Быстрый захват через mss с настраиваемой областью"
          />
          <FeatureCard
            icon="🔍"
            title="OCR"
            description="EasyOCR или Tesseract для распознавания текста"
          />
          <FeatureCard
            icon="🤖"
            title="LLM-перевод"
            description="OpenAI, Ollama, LM Studio — любой совместимый API"
          />
          <FeatureCard
            icon="💾"
            title="Кэширование"
            description="Хэш изображений и текста для экономии ресурсов"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>ScreenTranslate — Прототип экранного переводчика • Python + PyQt6 + EasyOCR + OpenAI API</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 hover:border-blue-700/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/10">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

export default App;
