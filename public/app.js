/**
 * 永劫无间宏查看器 - Cloudflare Workers + D1 版本
 * 从API加载数据，ATK同步在前端实现
 */

// API基础路径
const API_BASE = '/api';

// 全局数据
let allMacros = [];
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;
const perPage = 50;

// ===== 数据加载 =====

async function loadMacroData() {
    try {
        // 加载分类列表
        await loadCategories();
        // 加载宏列表
        await loadMacros();
    } catch (error) {
        console.error('加载宏数据失败:', error);
        document.getElementById('macroList').innerHTML = `
            <div class="no-results">❌ 加载失败: ${error.message}</div>
        `;
    }
}

// 加载分类列表
async function loadCategories() {
    const response = await fetch(`${API_BASE}/categories`);
    const result = await response.json();
    if (result.success) {
        const categoryFilter = document.getElementById('categoryFilter');
        result.data.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = `${cat.name} (${cat.count})`;
            categoryFilter.appendChild(option);
        });
    }
}

// 加载宏列表
async function loadMacros(page = 1) {
    const searchTerm = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;
    
    const params = new URLSearchParams({ page, per_page: perPage });
    if (searchTerm) params.append('search', searchTerm);
    if (category) params.append('category', category);
    
    const response = await fetch(`${API_BASE}/macros?${params}`);
    const result = await response.json();
    
    if (result.success) {
        allMacros = result.data;
        currentPage = result.pagination.page;
        totalPages = result.pagination.total_pages;
        totalCount = result.pagination.total;
        
        displayMacros(allMacros);
        updateStats();
        updatePagination();
    }
}

// 显示宏列表
function displayMacros(macros) {
    const macroList = document.getElementById('macroList');
    
    if (!macros || macros.length === 0) {
        macroList.innerHTML = '<div class="no-results">😕 没有找到匹配的宏</div>';
        return;
    }
    
    macroList.innerHTML = macros.map(macro => createMacroCard(macro)).join('');
}

// 创建宏卡片HTML
function createMacroCard(macro) {
    const name = macro.name || '未命名宏';
    const category = macro.category || '未分类';
    const macroType = macro.macroType || macro.macro?.type || 'UNKNOWN';
    
    let keysHTML = '';
    if (macroType === 'KEYSTROKE') {
        keysHTML = renderKeystroke(macro.macro);
    } else if (macroType === 'SEQUENCE') {
        keysHTML = renderSequence(macro.macro);
    }
    
    // 只有SEQUENCE类型可以同步到ATK
    const syncBtn = macroType === 'SEQUENCE' 
        ? `<button class="card-sync-btn" onclick="event.stopPropagation(); syncSingleMacro('${macro.id}')">\ud83d\udd04 同步到ATK</button>`
        : '';
    
    return `
        <div class="macro-card" data-macro-id="${macro.id}" onclick="showMacroDetail('${macro.id}')">
            <div class="macro-header">
                <div class="macro-name">${escapeHtml(name)}</div>
                ${category !== '未分类' ? `<div class="macro-category">${escapeHtml(category)}</div>` : ''}
            </div>
            <div class="macro-type">类型: ${macroType}</div>
            <div class="macro-keys">${keysHTML}</div>
            ${syncBtn}
        </div>
    `;
}

// ===== 渲染函数 =====

function renderKeystroke(macro) {
    const actionName = macro.actionName || '';
    if (actionName) {
        return `<div class="key-display">${escapeHtml(actionName)}</div>`;
    }
    
    const code = macro.keystroke?.code;
    const modifiers = macro.keystroke?.modifiers || [];
    
    let keys = [];
    modifiers.forEach(mod => keys.push(getModifierName(mod)));
    if (code) keys.push(getKeyName(code));
    
    return keys.map(key => `<div class="key-display">${escapeHtml(key)}</div>`).join('');
}

function renderSequence(macro) {
    const sequence = macro.sequence;
    if (!sequence) return '<div class="sequence-info">无序列信息</div>';
    
    const defaultDelay = sequence.defaultDelay || 0;
    let html = `<div class="sequence-info">默认延迟: ${defaultDelay}ms</div>`;
    
    const sequenceTypes = [
        { key: 'simpleSequence', label: '' },
        { key: 'heldSequence', label: '(按住)' },
        { key: 'toggleSequence', label: '(切换)' },
        { key: 'pressSequence', label: '(按下)' },
        { key: 'releaseSequence', label: '(释放)' }
    ];
    
    for (const seqType of sequenceTypes) {
        if (sequence[seqType.key]?.components?.length > 0) {
            const components = sequence[seqType.key].components;
            if (seqType.label) {
                html += `<div class="sequence-info">${seqType.label}</div>`;
            }
            html += '<div class="sequence-steps">' + renderComponents(components) + '</div>';
            break;
        }
    }
    
    return html;
}

function renderComponents(components) {
    let html = '';
    components.forEach(component => {
        if (component.keyboard) {
            const displayName = component.keyboard.displayName;
            const isDown = component.keyboard.isDown;
            const className = isDown ? 'key-down' : 'key-up';
            const symbol = isDown ? '↓' : '↑';
            html += `<div class="sequence-step ${className}">${symbol} ${escapeHtml(displayName)}</div>`;
        } else if (component.delay) {
            html += `<div class="sequence-step delay">⏱ ${component.delay.durationMs}ms</div>`;
        } else if (component.mouse) {
            html += renderMouseAction(component.mouse);
        } else if (component.mouseMacro) {
            html += `<div class="sequence-step mouse-action">🖱 ${component.mouseMacro.action}</div>`;
        }
    });
    return html;
}

function renderMouseAction(mouse) {
    if (mouse.button) {
        const buttonName = getMouseButtonName(mouse.button.hidUsage);
        const isDown = mouse.button.isDown;
        const symbol = isDown ? '↓' : '↑';
        const className = isDown ? 'mouse-down' : 'mouse-up';
        return `<div class="sequence-step ${className}">🖱 ${symbol} ${buttonName}</div>`;
    } else if (mouse.wheel) {
        return `<div class="sequence-step mouse-wheel">🖱 ${getMouseWheelAction(mouse.wheel.hidUsage)}</div>`;
    } else if (mouse.move) {
        return `<div class="sequence-step mouse-move">🖱 移动 (${mouse.move.x || 0}, ${mouse.move.y || 0})</div>`;
    }
    return '';
}

// ===== 键码映射 =====

function getModifierName(code) {
    const modifiers = {
        224: 'Ctrl', 225: 'Shift', 226: 'Alt', 227: 'Win',
        228: 'Right Ctrl', 229: 'Right Shift', 230: 'Right Alt', 231: 'Right Win'
    };
    return modifiers[code] || `Mod${code}`;
}

function getKeyName(code) {
    const keys = {
        4: 'A', 5: 'B', 6: 'C', 7: 'D', 8: 'E', 9: 'F', 10: 'G', 11: 'H',
        12: 'I', 13: 'J', 14: 'K', 15: 'L', 16: 'M', 17: 'N', 18: 'O', 19: 'P',
        20: 'Q', 21: 'R', 22: 'S', 23: 'T', 24: 'U', 25: 'V', 26: 'W', 27: 'X',
        28: 'Y', 29: 'Z',
        30: '1', 31: '2', 32: '3', 33: '4', 34: '5', 35: '6', 36: '7', 37: '8',
        38: '9', 39: '0',
        40: 'Enter', 41: 'Esc', 42: 'Backspace', 43: 'Tab', 44: 'Space',
        45: '-', 46: '=', 47: '[', 48: ']', 49: '\\', 51: ';', 52: '\'',
        53: '`', 54: ',', 55: '.', 56: '/',
        58: 'F1', 59: 'F2', 60: 'F3', 61: 'F4', 62: 'F5', 63: 'F6',
        64: 'F7', 65: 'F8', 66: 'F9', 67: 'F10', 68: 'F11', 69: 'F12'
    };
    return keys[code] || `Key${code}`;
}

function getMouseButtonName(hidUsage) {
    const buttons = { '1': '左键', '2': '右键', '3': '中键', '4': '侧键1', '5': '侧键2' };
    return buttons[hidUsage] || `按键${hidUsage}`;
}

function getMouseWheelAction(hidUsage) {
    const wheels = { '1': '滚轮向上', '2': '滚轮向下', '6': '滚轮向上', '7': '滚轮向下' };
    return wheels[hidUsage] || `滚轮${hidUsage}`;
}

// ===== 工具函数 =====

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function searchMacros() {
    currentPage = 1;
    loadMacros(1);
}

function updateStats() {
    document.getElementById('totalCount').textContent = `总计: ${totalCount} 个宏`;
    document.getElementById('filteredCount').textContent = `显示: ${allMacros.length} | 第 ${currentPage}/${totalPages} 页`;
    document.getElementById('filteredCount').style.display = 'inline-block';
}

function updatePagination() {
    const existingPagination = document.querySelector('.pagination');
    if (existingPagination) existingPagination.remove();
    
    if (totalPages <= 1) return;
    
    let html = '<div class="pagination">';
    
    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">« 上一页</button>`;
    }
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += '<span class="page-dots">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        html += `<button class="page-btn ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="page-dots">...</span>';
        html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">下一页 »</button>`;
    }
    
    html += '</div>';
    document.querySelector('.container').insertAdjacentHTML('beforeend', html);
}

function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        loadMacros(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ===== 宏详情模态窗口 =====

function showMacroDetail(macroId) {
    const macro = allMacros.find(m => m.id === macroId);
    if (!macro) return;
    
    displayMacroModal(macro);
}

function displayMacroModal(macro) {
    const modal = document.getElementById('macroModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = macro.name || '未命名宏';
    
    let html = '<div class="modal-info-grid">';
    html += `
        <div class="modal-info-item">
            <div class="modal-info-label">宏名称</div>
            <div class="modal-info-value">${escapeHtml(macro.name || '未命名')}</div>
        </div>
        <div class="modal-info-item">
            <div class="modal-info-label">分类</div>
            <div class="modal-info-value">${escapeHtml(macro.category || '未分类')}</div>
        </div>
        <div class="modal-info-item">
            <div class="modal-info-label">类型</div>
            <div class="modal-info-value">${escapeHtml(macro.macroType)}</div>
        </div>
    `;
    html += '</div>';
    
    html += '<div class="modal-section">';
    html += '<div class="modal-section-title">⚙️ 宏配置详情</div>';
    
    if (macro.macroType === 'KEYSTROKE') {
        html += renderKeystrokeDetail(macro.macro);
    } else if (macro.macroType === 'SEQUENCE') {
        html += renderSequenceDetail(macro.macro);
    }
    
    html += '</div>';
    
    modalBody.innerHTML = html;
    modal.classList.add('show');
}

function renderKeystrokeDetail(macro) {
    let html = '<div class="modal-keystroke">';
    if (macro.actionName) {
        html += `<div class="modal-key">${escapeHtml(macro.actionName)}</div>`;
    }
    if (macro.keystroke) {
        (macro.keystroke.modifiers || []).forEach(mod => {
            html += `<div class="modal-key">${escapeHtml(getModifierName(mod))}</div>`;
        });
        if (macro.keystroke.code) {
            html += `<div class="modal-key">${escapeHtml(getKeyName(macro.keystroke.code))}</div>`;
        }
    }
    html += '</div>';
    return html;
}

function renderSequenceDetail(macro) {
    const sequence = macro.sequence;
    if (!sequence) return '<div class="modal-info-value">无序列信息</div>';
    
    let html = '<div class="modal-sequence-container">';
    html += `<div class="modal-info-label">默认延迟: ${sequence.defaultDelay || 0}ms</div>`;
    
    const sequenceTypes = [
        { key: 'simpleSequence', label: '简单序列' },
        { key: 'heldSequence', label: '按住序列' },
        { key: 'toggleSequence', label: '切换序列' }
    ];
    
    for (const seqType of sequenceTypes) {
        if (sequence[seqType.key]?.components?.length > 0) {
            const components = sequence[seqType.key].components;
            html += `<div class="modal-info-label" style="margin-top: 15px;">${seqType.label} (共 ${components.length} 步):</div>`;
            html += '<div class="modal-sequence-steps">' + renderComponentsDetail(components) + '</div>';
        }
    }
    
    html += '</div>';
    return html;
}

function renderComponentsDetail(components) {
    let html = '';
    components.forEach(component => {
        if (component.keyboard) {
            const isDown = component.keyboard.isDown;
            const className = isDown ? 'key-down' : 'key-up';
            const symbol = isDown ? '↓' : '↑';
            html += `<div class="modal-sequence-step ${className}">${symbol} ${escapeHtml(component.keyboard.displayName)}</div>`;
        } else if (component.delay) {
            html += `<div class="modal-sequence-step delay">⏱ ${component.delay.durationMs}ms</div>`;
        } else if (component.mouse) {
            if (component.mouse.button) {
                const isDown = component.mouse.button.isDown;
                const className = isDown ? 'mouse-down' : 'mouse-up';
                const symbol = isDown ? '↓' : '↑';
                html += `<div class="modal-sequence-step ${className}">🖱 ${symbol} ${getMouseButtonName(component.mouse.button.hidUsage)}</div>`;
            }
        }
    });
    return html;
}

function closeModal() {
    document.getElementById('macroModal').classList.remove('show');
}

// ===== ATK Hub 同步功能 =====

// G Hub 到 ATK 键码映射
const GHUB_TO_ATK_KEYCODE = {
    4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13,
    14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22,
    23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29,
    30: 30, 31: 31, 32: 32, 33: 33, 34: 34, 35: 35, 36: 36, 37: 37, 38: 38, 39: 39,
    40: 40, 41: 41, 42: 42, 43: 43, 44: 44, 45: 45, 46: 46, 47: 47, 48: 48,
    49: 49, 51: 51, 52: 52, 53: 53, 54: 54, 55: 55, 56: 56,
    58: 58, 59: 59, 60: 60, 61: 61, 62: 62, 63: 63, 64: 64, 65: 65,
    66: 66, 67: 67, 68: 68, 69: 69
};

// 转换宏为ATK格式
function convertMacroToATK(macro) {
    if (macro.macroType !== 'SEQUENCE') return null;
    
    const sequence = macro.macro?.sequence;
    if (!sequence) return null;
    
    const seqTypes = ['simpleSequence', 'heldSequence', 'toggleSequence', 'pressSequence', 'releaseSequence'];
    let components = null;
    
    for (const type of seqTypes) {
        if (sequence[type]?.components?.length > 0) {
            components = sequence[type].components;
            break;
        }
    }
    
    if (!components) return null;
    
    const actions = [];
    let lastDelay = sequence.defaultDelay || 50;
    
    for (const comp of components) {
        if (comp.delay) {
            lastDelay = comp.delay.durationMs || 50;
        } else if (comp.keyboard) {
            // G Hub 使用 hidUsage 字段存储键码
            const keyCode = parseInt(comp.keyboard.hidUsage) || comp.keyboard.hidCode || comp.keyboard.keyCode;
            if (keyCode) {
                actions.push({
                    delay: lastDelay,
                    keyStatus: comp.keyboard.isDown ? 0 : 1,
                    type: 1,
                    keyCode: GHUB_TO_ATK_KEYCODE[keyCode] || keyCode
                });
            }
        } else if (comp.mouse?.button) {
            actions.push({
                delay: lastDelay,
                keyStatus: comp.mouse.button.isDown ? 0 : 1,
                type: 4,
                keyCode: parseInt(comp.mouse.button.hidUsage) || 1
            });
        }
    }
    
    if (actions.length === 0) return null;
    
    return {
        name: macro.name,
        type: 0,
        frequency: 1,
        actions: actions
    };
}

// 显示提示消息
function showToast(message, isSuccess = true) {
    const toast = document.getElementById('syncToast');
    toast.textContent = message;
    toast.className = 'sync-toast show ' + (isSuccess ? 'success' : 'error');
    setTimeout(() => toast.className = 'sync-toast', 3000);
}

// 单个宏同步到ATK
function syncSingleMacro(macroId) {
    const macro = allMacros.find(m => m.id === macroId);
    if (!macro) {
        showToast('❌ 找不到宏数据', false);
        return;
    }
    
    const atkMacro = convertMacroToATK(macro);
    if (!atkMacro) {
        showToast('❌ 该宏无法转换', false);
        return;
    }
    
    // 生成同步代码
    const script = generateSyncScript(atkMacro);
    
    navigator.clipboard.writeText(script).then(() => {
        showToast(`✅ 「${macro.name}」同步代码已复制，请到ATK Hub控制台粘贴`);
    }).catch(err => {
        showToast('❌ 复制失败: ' + err.message, false);
    });
}

// 生成同步代码
function generateSyncScript(atkMacro) {
    const macroJson = JSON.stringify(atkMacro);
    return `
(async () => {
  const log = (...args) => console.log('[naraka-sync]', ...args);
  const newMacro = ${macroJson};

  function upsert(list) {
    const i = list.findIndex(m => m.name === newMacro.name);
    if (i >= 0) list[i] = newMacro; else list.push(newMacro);
  }

  // 1) 真实设备：通过 Pinia 写入 InfoControllerStore.deviceData.deviceConfig.macroList
  try {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia;
    const infoStore = pinia?._s?.get('InfoControllerStore');
    const state = infoStore?.$state;
    const deviceData = state?.deviceData;
    if (deviceData?.deviceConfig) {
      deviceData.deviceConfig.macroList = deviceData.deviceConfig.macroList || [];
      upsert(deviceData.deviceConfig.macroList);
      if (typeof infoStore.setDeviceData === 'function') {
        infoStore.setDeviceData(deviceData);
      } else if (typeof infoStore.$patch === 'function') {
        infoStore.$patch(s => { s.deviceData = deviceData; });
      }
      // 尝试自动点击“保存”按钮（如存在）
      try {
        const btns = Array.from(document.querySelectorAll('button'));
        const saveBtn = btns.find(b => /保存/.test(b.textContent || ''));
        if (saveBtn) saveBtn.click();
      } catch (_) {}
      log('✅ 已写入宏到真实设备配置: ' + newMacro.name + '。若未自动保存，请手动点击“保存”。');
      return { success: true, mode: 'real', count: deviceData.deviceConfig.macroList.length };
    }
  } catch (e) {
    log('real-device path failed', e);
  }

  // 2) 演示模式回退：写入 sessionStorage 中的演示设备数据
  try {
    const keys = ['__demo_kb_summary_4471', '__demo_mouse_summary_4580-ATK F1 Ultimate 2.0', '__demo_mouse_summary_4252-ATK RS6'];
    for (const key of keys) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      parsed.deviceConfig = parsed.deviceConfig || {};
      parsed.deviceConfig.macroList = parsed.deviceConfig.macroList || [];
      upsert(parsed.deviceConfig.macroList);
      sessionStorage.setItem(key, JSON.stringify(parsed));
      log('✅ 已写入宏到演示设备配置: ' + newMacro.name);
      return { success: true, mode: 'demo', count: parsed.deviceConfig.macroList.length };
    }
  } catch (e) {
    log('demo path failed', e);
  }

  console.error('❌ 未找到 ATK Hub 运行环境或设备数据。请确认已打开 hub.atk.pro 并连接设备或进入演示模式。');
  return { success: false };
})();
`;
}

// ===== 事件绑定 =====

document.addEventListener('DOMContentLoaded', function() {
    // 搜索
    document.getElementById('searchBtn').addEventListener('click', searchMacros);
    document.getElementById('searchInput').addEventListener('keyup', e => {
        if (e.key === 'Enter') searchMacros();
    });
    document.getElementById('categoryFilter').addEventListener('change', searchMacros);
    
    // 详情模态窗口
    document.querySelector('#macroModal .modal-close').addEventListener('click', closeModal);
    window.addEventListener('click', e => {
        if (e.target === document.getElementById('macroModal')) closeModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
    
    // 加载数据
    loadMacroData();
});
