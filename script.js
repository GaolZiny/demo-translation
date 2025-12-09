// Configuration
const CONFIG = {
    // Webhook URL for the translation workflow
    webhookUrl: 'https://translation-proxy.gaol-ziny.workers.dev',
    // For testing, use: https://zg-n8n.zglife.qzz.io/webhook/e097559a-eaad-4717-8985-8bfe51ff3365
    // https://translation-proxy.gaol-ziny.workers.dev
    fieldName: '問い合わせ内容',
    // Timeout in milliseconds (60 seconds)
    timeout: 60000
};

// DOM Elements
const elements = {
    japaneseInput: document.getElementById('japaneseInput'),
    translateBtn: document.getElementById('translateBtn'),
    clearBtn: document.getElementById('clearBtn'),
    copyBtn: document.getElementById('copyBtn'),
    charCount: document.getElementById('charCount'),
    outputContainer: document.getElementById('outputContainer'),
    translationResult: document.getElementById('translationResult'),
    errorMessage: document.getElementById('errorMessage'),
    errorText: document.getElementById('errorText')
};

// State
let isTranslating = false;

// Event Listeners
elements.japaneseInput.addEventListener('input', handleInputChange);
elements.translateBtn.addEventListener('click', handleTranslate);
elements.clearBtn.addEventListener('click', handleClear);
elements.copyBtn.addEventListener('click', handleCopy);

// Handle input change to update character count
function handleInputChange() {
    const text = elements.japaneseInput.value;
    const charCount = text.length;
    elements.charCount.textContent = `${charCount} 文字`;

    // Enable/disable translate button
    elements.translateBtn.disabled = text.trim().length === 0 || isTranslating;
}

// Handle translation
async function handleTranslate() {
    const inputText = elements.japaneseInput.value.trim();

    if (!inputText) {
        showError('翻訳するテキストを入力してください。');
        return;
    }

    // Set translating state
    isTranslating = true;
    elements.translateBtn.disabled = true;
    elements.translateBtn.classList.add('btn-loading'); // Add loading class for spinner
    elements.clearBtn.disabled = true;
    hideError();
    hideResult();

    try {
        // Call n8n workflow
        const result = await callN8nWorkflow(inputText);

        // Display result
        displayResult(result);

    } catch (error) {
        console.error('Translation error:', error);
        showError(error.message || '翻訳中にエラーが発生しました。もう一度お試しください。');
    } finally {
        // Reset translating state
        isTranslating = false;
        elements.translateBtn.disabled = false;
        elements.translateBtn.classList.remove('btn-loading'); // Remove loading class
        elements.clearBtn.disabled = false;
    }
}

// Call n8n workflow via webhook
async function callN8nWorkflow(text) {
    console.log('Calling n8n webhook with text:', text);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    try {
        const response = await fetch(CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                [CONFIG.fieldName]: text
            }),
            signal: controller.signal
        });

        // Clear timeout if request completes successfully
        clearTimeout(timeoutId);

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Webhookの呼び出しに失敗しました (${response.status})`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        // Check if webhook is responding immediately (not waiting for workflow completion)
        if (data && typeof data === 'object') {
            const jsonStr = JSON.stringify(data);
            if (jsonStr.includes('Workflow got started') || jsonStr.includes('workflow got started')) {
                throw new Error('⚠️ Webhookが「即座に応答」モードに設定されています。\n\nn8nで以下の手順を実行してください：\n1. Webhookノードをクリック\n2. 「Respond」を「When Last Node Finishes」に変更\n3. ワークフローを保存');
            }
        }

        // The webhook might respond immediately or return the result
        // Check different possible response structures

        // For AI Agent response structure (most likely)
        if (data && data.output) {
            // The structured output parser returns {type, content}
            if (typeof data.output === 'object' && data.output.content) {
                return data.output.content;
            }
            // Or just the output string directly
            if (typeof data.output === 'string') {
                return data.output;
            }
        }

        // For direct content field
        if (data && data.content) {
            return data.content;
        }

        // For text field
        if (data && data.text) {
            return data.text;
        }

        // For immediate webhook string response
        if (data && typeof data === 'string') {
            return data;
        }

        // For nested json structure
        if (data && data.json) {
            if (data.json.content) {
                return data.json.content;
            }
            if (data.json.output) {
                if (typeof data.json.output === 'object' && data.json.output.content) {
                    return data.json.output.content;
                }
                return data.json.output;
            }
            if (data.json.text) {
                return data.json.text;
            }
        }

        // Log the full response for debugging
        console.warn('Could not extract translation from response:', data);
        console.warn('Response structure:', JSON.stringify(data, null, 2));
        throw new Error('翻訳結果を取得できませんでした。\n\nブラウザのコンソール（F12）を開いて、レスポンスの構造を確認してください。');

    } catch (error) {
        // Clear timeout
        clearTimeout(timeoutId);

        // Handle timeout
        if (error.name === 'AbortError') {
            throw new Error('⏱️ サービス混雑中です。\n時間をあけてからご利用ください。');
        }

        // Handle connection error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('n8nサーバーに接続できません。サーバーが起動しているか確認してください。');
        }

        throw error;
    }
}

// Display translation result
function displayResult(translationText) {
    // Hide placeholder
    const placeholder = elements.outputContainer.querySelector('.placeholder-content');
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // Show translation result
    elements.translationResult.textContent = translationText;
    elements.translationResult.style.display = 'block';

    // Show copy button
    elements.copyBtn.style.display = 'flex';

    // Scroll to result
    elements.outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide result
function hideResult() {
    const placeholder = elements.outputContainer.querySelector('.placeholder-content');
    if (placeholder) {
        placeholder.style.display = 'flex';
    }

    elements.translationResult.style.display = 'none';
    elements.translationResult.textContent = '';
    elements.copyBtn.style.display = 'none';
}

// Show error message
function showError(message) {
    elements.errorText.textContent = message;
    elements.errorMessage.style.display = 'flex';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

// Hide error message
function hideError() {
    elements.errorMessage.style.display = 'none';
}

// Handle clear button
function handleClear() {
    // Clear input
    elements.japaneseInput.value = '';

    // Reset character count
    elements.charCount.textContent = '0 文字';

    // Hide result
    hideResult();

    // Hide error
    hideError();

    // Disable translate button
    elements.translateBtn.disabled = true;

    // Focus input
    elements.japaneseInput.focus();
}

// Handle copy button
async function handleCopy() {
    const text = elements.translationResult.textContent;

    try {
        await navigator.clipboard.writeText(text);

        // Show feedback
        const originalText = elements.copyBtn.innerHTML;
        elements.copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            コピーしました
        `;
        elements.copyBtn.classList.add('copied');

        // Reset after 2 seconds
        setTimeout(() => {
            elements.copyBtn.innerHTML = originalText;
            elements.copyBtn.classList.remove('copied');
        }, 2000);

    } catch (error) {
        console.error('Copy failed:', error);
        showError('コピーに失敗しました。');
    }
}

// Initialize
function init() {
    // Set initial state
    elements.translateBtn.disabled = true;

    // Focus input
    elements.japaneseInput.focus();

    console.log('Translation app initialized');
    console.log('Webhook URL:', CONFIG.webhookUrl);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
