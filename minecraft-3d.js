        // --- 游戏主要全局配置与变量 ---
        const BLOCK_SIZE = 1;
        const WORLD_SIZE = 96;
        const PLAYER_HEIGHT = 1.6;
        const JUMP_SPEED = 10;
        const MAX_RISE_SPEED = 20;
        const MAX_REACH = 6.0;

        // 音效系统（Web Audio API）
        let audioCtx = null;
        let audioReady = false;
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                audioReady = true;
            }
        }
        // 首次用户交互时创建并激活音频上下文（浏览器自动播放策略要求）
        function ensureAudio() {
            if (!audioCtx) initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
        // 持续监听用户交互（不移除），确保 AudioContext 随时可恢复
        document.addEventListener('click', ensureAudio);
        document.addEventListener('keydown', ensureAudio);
        document.addEventListener('touchstart', ensureAudio);
        function playSound(type, freq, duration) {
            try {
                if (!audioCtx || !audioReady) return;
                if (audioCtx.state === 'suspended') return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = type;
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
                osc.start();
                osc.stop(audioCtx.currentTime + duration);
            } catch (e) { /* 音频失败不影响游戏 */ }
        }
        function playMiningSound() {
            playSound('square', 120 + Math.random() * 60, 0.1);
        }
        function playBreakSound() {
            playSound('square', 80, 0.15);
            setTimeout(() => playSound('sawtooth', 60, 0.1), 50);
        }
        function playHitSound() {
            playSound('sawtooth', 200 + Math.random() * 100, 0.08);
        }
        function playPlaceSound() {
            playSound('square', 300, 0.05);
        }
        function playCraftSound() {
            playSound('triangle', 400, 0.05);
            setTimeout(() => playSound('triangle', 500, 0.05), 50);
            setTimeout(() => playSound('triangle', 600, 0.08), 100);
        }
        
        // === 语音合成（TTS）：让副本怪物朗读题目 ===
        // === 语音系统：智能选择最佳中文语音 ===
        let cachedVoices = [];
        let preferredVoiceName = localStorage.getItem('tts_preferred_voice') || '';
        
        // 优先使用的优质中文语音（按质量排序）
        const VOICE_PRIORITY = [
            'Microsoft Yaoyao',       // Edge 小雅（女声，甜美）
            'Microsoft Yaoyu',        // Edge 小宇（男声，温暖）
            'Microsoft Huihui',       // Edge 慧慧（女声，活泼）
            'Microsoft Kangkang',     // Edge 康康（男声）
            'Microsoft Xiaoxiao',     // Edge 晓晓（女声，标准）
            'Microsoft Yunxi',        // Edge 云希（男声，自然）
            'Microsoft Xiaoyi',       // Edge 晓伊（女声，温柔）
            'Tingting',               // macOS 婷婷
            'Meijia',                 // macOS 美佳
            'Sinji',                  // macOS 声音
            'Yu-shu',                 // 语速
            'Yun-ye',                 // 云野
            'Yu-cao',                 // 语草
            'Google 普通话',
            'Google 普通话（中国大陆）',
            'Microsoft Zhiyu',        // 智宇
            'Microsoft Zhi' ,          // 智
        ];
        
        function loadVoices() {
            cachedVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            // 语音列表异步加载，延迟重试
            if (cachedVoices.length === 0 && window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = () => {
                    cachedVoices = window.speechSynthesis.getVoices();
                };
            }
        }
        // 初始化加载
        if ('speechSynthesis' in window) {
            loadVoices();
            // 部分浏览器需要延迟加载
            setTimeout(loadVoices, 500);
            setTimeout(loadVoices, 2000);
        }
        
        function getBestChineseVoice() {
            // 优先用户选择的语音
            if (preferredVoiceName) {
                const match = cachedVoices.find(v => v.name === preferredVoiceName);
                if (match) return match;
            }
            // 按优先级查找
            for (const name of VOICE_PRIORITY) {
                const match = cachedVoices.find(v => v.name && v.name.includes(name));
                if (match) return match;
            }
            // 备用：任意中文语音
            return cachedVoices.find(v => v.lang && (v.lang.includes('zh-CN') || v.lang.includes('zh_CN') || v.lang.includes('zh-CN'))) || 
                   cachedVoices.find(v => v.lang && v.lang.startsWith('zh'));
        }
        
        function speakText(text, rate) {
            if (!('speechSynthesis' in window)) return;
            try {
                window.speechSynthesis.cancel();
                // 分段朗读：Chrome 中文 TTS 有长度限制，超过 ~200 字会中断
                const segments = text.split(/(?<=[。！？，；\n])/);
                const sentences = [];
                let buf = '';
                for (const seg of segments) {
                    buf += seg;
                    if (buf.length >= 80) {
                        sentences.push(buf.trim());
                        buf = '';
                    }
                }
                if (buf.trim()) sentences.push(buf.trim());
                
                let idx = 0;
                function speakNext() {
                    if (idx >= sentences.length) return;
                    const utter = new SpeechSynthesisUtterance(sentences[idx]);
                    utter.lang = 'zh-CN';
                    utter.rate = rate || 0.9;
                    utter.pitch = 1.0;
                    utter.volume = 1.0;
                    const bestVoice = getBestChineseVoice();
                    if (bestVoice) utter.voice = bestVoice;
                    utter.onend = () => { idx++; speakNext(); };
                    utter.onerror = () => { idx++; speakNext(); };
                    window.speechSynthesis.speak(utter);
                }
                speakNext();
            } catch (e) {
                // TTS 失败不影响游戏
            }
        }
        
        function stopSpeaking() {
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch (e) {}
            }
        }
        
        // 切换语音（供设置面板调用）
        function cycleTTSVoice() {
            // 先刷新语音列表（防止之前没加载完成）
            if ('speechSynthesis' in window) {
                cachedVoices = window.speechSynthesis.getVoices();
            }
            const zhVoices = cachedVoices.filter(v => v.lang && v.lang.startsWith('zh'));
            if (zhVoices.length === 0) {
                showStatus('⚠️ 未找到中文语音，无法切换');
                return;
            }
            const currentIdx = zhVoices.findIndex(v => v.name === preferredVoiceName);
            const nextIdx = (currentIdx + 1) % zhVoices.length;
            preferredVoiceName = zhVoices[nextIdx].name;
            localStorage.setItem('tts_preferred_voice', preferredVoiceName);
            showStatus(`🔊 语音已切换：${preferredVoiceName}`);
            // 自动试听
            speakText(`当前语音是 ${preferredVoiceName}，朗读效果测试。`, 0.95);
        }

        // === 全局拼音映射表（中文 → 拼音）===
        const PINYIN_MAP = {
            '草地': 'cǎo dì', '泥土': 'nì tǔ', '石头': 'shí tou', '原木': 'yuán mù',
            '树叶': 'shù yè', '沙子': 'shā zi', '基岩': 'jī yán', '水': 'shuǐ',
            '雪': 'xuě', '木板': 'mù bǎn', '工作台': 'gōng zuò tái', '玻璃': 'bō lí',
            '红砖': 'hóng zhuān', '石砖': 'shí zhuān', '圆石': 'yuán shí',
            '发光石': 'fā guāng shí', '黑曜石': 'hēi yào shí', '铁矿石': 'tiě kuàng shí',
            '煤矿石': 'méi kuàng shí', '火把': 'huǒ bǎ',
            '青铜宝箱': 'qīng tóng bǎo xiāng', '白银宝箱': 'bái yín bǎo xiāng',
            '黄金宝箱': 'huáng jīn bǎo xiāng', '副本宝箱': 'fù běn bǎo xiāng',
            '耕地': 'gēng dì', '作物': 'zuò wù',
            '锄头': 'chú tóu', '木剑': 'mù jiàn', '石剑': 'shí jiàn', '铁剑': 'tiě jiàn',
            '木镐': 'mù gǎo', '石镐': 'shí gǎo', '铁镐': 'tiě gǎo',
            '木斧': 'mù fǔ', '石斧': 'shí fǔ', '铁斧': 'tiě fǔ',
            '盾牌': 'dùn pái', '手枪': 'shǒu qiāng', '步枪': 'bù qiāng', '狙击枪': 'jū jī qiāng',
            '坦克': 'tǎn kè', '钻石剑': 'zuàn shí jiàn', '金剑': 'jīn jiàn',
            '钻石镐': 'zuàn shí gǎo', '金镐': 'jīn gǎo',
            '铁': 'tiě', '煤': 'méi', '木头': 'mù tou', '铁块': 'tiě kuài',
            '种子': 'zhǒng zi', '麦子': 'mài zi',
            '铁胸甲': 'tiě xiōng jiǎ', '铁护腿': 'tiě hù tuǐ', '铁靴子': 'tiě xuē zi',
            '出生点': 'chū shēng diǎn', '玩家': 'wán jiā',
            '合成': 'hé chéng', '存档': 'cún dàng', '背包': 'bēi bāo',
            '装备': 'zhuāng bèi', '仓库': 'cāng kù',
            '已装备': 'yǐ zhuāng bèi', '未获得': 'wèi huò dé',
            '已拥有': 'yǐ yōng yǒu', '未拥有': 'wèi yōng yǒu',
            '伤害': 'shāng hài',
            // UI/系统常用词
            '已保存': 'yǐ bǎo cún', '已读取': 'yǐ dú qǔ', '没有找到': 'méi zhǎo dào',
            '请选择': 'qǐng xuǎn zé', '开始游戏': 'kāi shǐ yóu xì', '进入游戏': 'jìn rù yóu xì',
            '破坏': 'pò huài', '放置': 'fàng zhì', '攻击': 'gōng jī', '采集': 'cài jí',
            '分解': 'fēn jiě', '解锁': 'jiě suǒ', '传送': 'chuán sòng', '切换': 'qiē huàn',
            '关闭': 'guān bì', '打开': 'dǎ kāi', '飞行': 'fēi xíng', '行走': 'xíng zǒu',
            '夜晚': 'yè wǎn', '白天': 'bái tiān', '晴朗': 'qíng lǎng', '下雨': 'xià yǔ',
            '阴天': 'yīn tiān', '台风': 'tái fēng', '复活': 'fù huó', '脱困': 'tuō kùn',
            '磕头': 'kē tóu', '恢复': 'huī fù', '生命': 'shēng mìng', '饥饿': 'jī è',
            '读取': 'dú qǔ', '保存': 'bǎo cún', '文件': 'wén jiàn', '浏览器': 'lǎn kàn qiú',
            '缓存': 'huàn cún', '本地': 'běn dì', '选择': 'xuǎn zé', '错误': 'cuò wù',
            '失败': 'shī bài', '成功': 'chéng gōng', '警告': 'jǐng gào', '提示': 'tí shì',
            '小心': 'xiǎo xīn', '注意': 'zhù yì', '恭喜': 'gōng xǐ', '奖励': 'jiǎng lì',
            '宝箱': 'bǎo xiāng', '关卡': 'guān kǎ', '得分': 'dé fēn', '通关': 'tōng guān',
            '挑战': 'tiǎo zhàn', '教材': 'jiào cái', '语文': 'yǔ wén', '朗读': 'lǎng dú',
            '题目': 'tí mù', '答案': 'dá àn', '正确': 'zhèng què', '取消': 'qǔ xiāo',
            '确认': 'què rèn', '进入': 'jìn rù', '副本': 'fù běn', '城市': 'chéng shì',
            '地图': 'dì tú', '小地图': 'xiǎo dì tú', '世界': 'shì jiè', '坐标': 'zuò biāo',
            '位置': 'wèi zhì', '信息': 'xìn xī', '怪物': 'guài wù', '武器': 'wǔ qì',
            '工具': 'gōng jù', '物品': 'wù pǐn', '面板': 'miàn bǎn', '角色': 'jiǎo sè',
            '属性': 'shǔ xìng', '状态': 'zhuàng tài', '时间': 'shí jiān', '天气': 'tiān qì',
            '速度': 'sù dù', '血量': 'xuè liàng', '技能': 'jì néng', '夜间': 'yè jiān',
            '自爆': 'zì bào', '治疗': 'zhì liáo', '逃跑': 'táo pǎo', '射击': 'shè jí',
            '爬墙': 'pá qiáng', '瞬移': 'shùn yí', '追击': 'zhuī jí', '牛吼': 'niú hǒu',
            '声呐': 'shēng nà', '定位': 'dìng wèi', '祝福': 'zhù fú', '护盾': 'hù dùn',
            '恐慌': 'kōng huǎng', '远程': 'yuǎn chéng', '极速': 'jí sù', '快速': 'kuài sù',
            '附近': 'fù jìn', '范围': 'fàn wéi', '短': 'duǎn', '探测': 'tàn cè',
            '周围': 'zhōu wéi', '保护': 'bǎo hù', '不受': 'bù shòu', '生成': 'shēng chéng',
            '加载': 'jiā zài', '初始化': 'chū shǐ huà', '纹理': 'wén lǐ', '地形': 'dì xíng',
            '数据': 'shù jù', '连接': 'lián jiē', '网络': 'wǎng luò', '刷新': 'shuā xīn',
            '重试': 'chóng shì', '不支持': 'bù zhī chí', '鼠标': 'shǔ bǐ', '锁定': 'suǒ dìng',
            '拖动': 'tuō dòng', '视角': 'shì jiǎo', '模式': 'mó shì', '方块': 'fāng kuài',
            '当前': 'dāng qián', '未开始': 'wèi kāi shǐ', '最大': 'zuì dà', '全部': 'quán bù',
            '批量': 'pī liàng', '配方': 'pèi fāng', '一览': 'yī làN', '自动': 'zì dòng',
            '填充': 'tián chōng', '点击': 'diǎn jī', '拖拽': 'tuō rài', '材料': 'cái liào',
            '格子': 'gé zi', '输出': 'shū chū', '按钮': 'àn niǔ', '合成': 'hé chéng',
            '管理': 'guǎn lǐ', '本地保存': 'běn dì bǎo cún', '读取存档': 'dú qǔ cún dàng',
            '保存文件': 'bǎo cún wén jiàn', '打开文件': 'dǎ kāi wén jiàn',
            '状态': 'zhuàng tài', '未设置': 'wèi shè zhì', '文件夹': 'wén jiàn jié',
            '自动保存': 'zì dòng bǎo cún',
            '传送门': 'chuán sòng mén', '进入副本': 'jìn rù fù běn', '传送': 'chuán sòng',
            '出生点选择': 'chū shēng diǎn xuǎn zé', '已解锁': 'yǐ jiě suǒ', '未解锁': 'wèi jiě suǒ',
            '玩家位置': 'wán jiā wèi zhì', '副本入口': 'fù běn rù kǒu',
            '怪物图鉴': 'guài wù tú jiàn', '玩家属性': 'wán jiā shǔ xìng',
            '教材闯关': 'jiào cái chuǎn guān', '单元': 'dān yuán', '完成': 'wán chéng',
            '物品栏': 'wù pǐn lán', '武器与工具': 'wǔ qì yǔ gōng jù', '当前选中': 'dāng qián xuǎn zhōng',
        };

        function lookupPinyin(name) {
            if (!name) return '';
            if (PINYIN_MAP[name]) return PINYIN_MAP[name];
            for (const [cn, py] of Object.entries(PINYIN_MAP)) {
                if (cn.length >= 2 && name.includes(cn)) return py;
            }
            return '';
        }

        // === 拼音上标标注（ruby HTML）===
        // 生成 <ruby>汉字<rt>拼音</rt></ruby> 格式
        function withPinyin(text) {
            const py = lookupPinyin(text);
            if (py) {
                // 检查是否已有ruby标注，避免重复
                if (text.includes('<ruby>') || text.includes('<rt>')) return text;
                return `<ruby>${text}<rt>${py}</rt></ruby>`;
            }
            return text;
        }

        // === 鼠标悬停朗读汉字 ===
        let lastHoverReadTime = 0;
        const HOVER_READ_COOLDOWN = 600; // 600ms冷却，防止连续触发
        function hasChineseChars(text) {
            return /[\u4e00-\u9fff]/.test(text);
        }
        document.addEventListener('mouseover', (e) => {
            const now = Date.now();
            if (now - lastHoverReadTime < HOVER_READ_COOLDOWN) return;
            const el = e.target;
            if (!el || !el.textContent) return;
            // 跳过按钮、输入框等非文本元素
            const tag = el.tagName.toLowerCase();
            if (tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select') return;
            // 跳过工作台配方（有专门的mouseenter朗读）
            if (el.closest('.recipe-item')) return;
            // 跳过朗读面板（有专门的朗读按钮）
            if (el.closest('#reading-overlay')) return;
            const text = el.textContent.trim();
            if (!text || text.length < 1 || text.length > 100) return;
            if (!hasChineseChars(text)) return;
            // 跳过已经朗读过的元素（5秒内）
            if (el.dataset._lastRead && (now - parseInt(el.dataset._lastRead)) < 5000) return;
            el.dataset._lastRead = now.toString();
            lastHoverReadTime = now;
            // 获取纯文本，去除拼音和英文
            let pureText = el.innerText ? el.innerText.trim() : text;
            // 移除括号内容（英文翻译）
            pureText = pureText.replace(/\([^)]*\)/g, '').trim();
            // 移除emoji
            pureText = pureText.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim();
            // 清理多余空格
            pureText = pureText.replace(/\s+/g, ' ').trim();
            if (pureText.length >= 1 && hasChineseChars(pureText)) {
                speakText(pureText, 0.95);
            }
        });

        // 怪物与玩家模型
        let playerArm = null; // 第一人称视角下的手臂
        let shieldMesh = null; // 盾牌网格（举在身前）
        let shieldInFirstPerson = null; // 第一人称盾牌
        let shieldVisible = false; // 盾牌是否显示
        let mouseDeltaX = 0, mouseDeltaY = 0; // 鼠标位移（坦克炮塔瞄准用）
        const mobs = []; // 存储所有怪物

        // 方块定义与材质配置
        const BLOCK_TYPES = {
            GRASS:  { id: 1,  name: "草地",     pinyin: "cǎo dì",     color: 0x55aa44 },
            DIRT:   { id: 2,  name: "泥土",     pinyin: "nì tǔ",      color: 0x866043 },
            STONE:  { id: 3,  name: "石头",     pinyin: "shí tou",    color: 0x808080 },
            WOOD:   { id: 4,  name: "原木",     pinyin: "yuán mù",    color: 0x674a27 },
            LEAVES: { id: 5,  name: "树叶",     pinyin: "shù yè",     color: 0x2e8b57 },
            SAND:   { id: 6,  name: "沙子",     pinyin: "shā zi",     color: 0xeedd88 },
            BEDROCK:{ id: 7,  name: "基岩",     pinyin: "jī yán",     color: 0x444444 },
            WATER:  { id: 8,  name: "水",       pinyin: "shuǐ",       color: 0x3377cc, transparent: true, opacity: 0.6, depthWrite: false, collision: false },
            SNOW:   { id: 9,  name: "雪",       pinyin: "xuě",        color: 0xf0f0f0 },
            PLANKS: { id: 10, name: "木板",     pinyin: "mù bǎn",     color: 0xc4a46c },
            TABLE:  { id: 11, name: "工作台",   pinyin: "gōng zuò tái", color: 0xa08050 },
            GLASS:  { id: 12, name: "玻璃",     pinyin: "bō lí",      color: 0xaaeeff, transparent: true, opacity: 0.4 },
            BRICK:  { id: 13, name: "红砖",     pinyin: "hóng zhuān", color: 0x993322 },
            SBRICK: { id: 14, name: "石砖",     pinyin: "shí zhuān",  color: 0x666666 },
            COBBLE: { id: 15, name: "圆石",     pinyin: "yuán shí",   color: 0x555555 },
            GLOW:   { id: 16, name: "发光石",   pinyin: "fā guāng shí", color: 0xffff88, emissive: true },
            OBSIDIAN:{id: 17, name: "黑曜石",   pinyin: "hēi yào shí", color: 0x111122 },
            IRONORE:{ id: 18, name: "铁矿石",   pinyin: "tiě kuàng shí", color: 0xd4a373 },
            COAL:   { id: 19, name: "煤矿石",   pinyin: "méi kuàng shí", color: 0x333333 },
            TORCH:  { id: 20, name: "火把",     pinyin: "huǒ bǎ",     color: 0xffaa00, icon: "🔥" },
            CHEST_B: { id: 21, name: "青铜宝箱", pinyin: "qīng tóng bǎo xiāng", color: 0xc0824a },
            CHEST_S: { id: 22, name: "白银宝箱", pinyin: "bái yín bǎo xiāng", color: 0xdfe3e8 },
            CHEST_G: { id: 23, name: "黄金宝箱", pinyin: "huáng jīn bǎo xiāng", color: 0xffc93a },
            DUNGEON_CHEST: { id: 24, name: "副本宝箱", pinyin: "fù běn bǎo xiāng", color: 0xff8800 },
            FARMLAND: { id: 25, name: "耕地",   pinyin: "gēng dì",    color: 0x6b4423, collision: false },
            CROP:     { id: 26, name: "作物",   pinyin: "zuò wù",     color: 0x44cc44, collision: false },
            LAVA:     { id: 27, name: "熔岩",   pinyin: "róng yán",   color: 0xff4400, emissive: true, collision: false },
            ICE:      { id: 28, name: "冰块",   pinyin: "bīng kuài",  color: 0x99ddff },
            WATERFALL:{ id: 29, name: "瀑布",   pinyin: "pù bù",      color: 0x66bbff, transparent: true, opacity: 0.6, depthWrite: false, collision: false },
            MUSHROOM: { id: 30, name: "蘑菇",   pinyin: "mó gū",      color: 0xdd5544, collision: false },
            BAMBOO:   { id: 31, name: "竹子",   pinyin: "zhú zi",     color: 0x88cc66, collision: false },
            CORAL:    { id: 32, name: "珊瑚",   pinyin: "shān hú",    color: 0xff7744, collision: false },
            GRANITE:  { id: 33, name: "花岗岩", pinyin: "huā gǎng yán", color: 0xa68b6f },
            SEEDS:    { id: 34, name: "种子",   pinyin: "zhǒng zi",   color: 0x88cc66, collision: false, icon: "🌱" },
            WHEAT:    { id: 35, name: "小麦",   pinyin: "xiǎo mài",   color: 0xddaa33, collision: false, icon: "🌾" },
        };

        // 工具类型（非方块）
        const TOOLS = {
            HOE:      { name: "锄头", pinyin: "chú tóu", color: 0xc0a040, icon: "⚒️", damage: 1, type: "tool" },
            SWORD_W:  { name: "木剑", pinyin: "mù jiàn", color: 0x8b6914, icon: "⚔️", damage: 4, type: "weapon" },
            SWORD_S:  { name: "石剑", pinyin: "shí jiàn", color: 0x777777, icon: "⚔️", damage: 6, type: "weapon" },
            SWORD_I:  { name: "铁剑", pinyin: "tiě jiàn", color: 0xdddddd, icon: "⚔️", damage: 10, type: "weapon" },
            PICK_W:   { name: "木镐", pinyin: "mù gǎo", color: 0x8b6914, icon: "⛏️", damage: 3, type: "weapon" },
            PICK_S:   { name: "石镐", pinyin: "shí gǎo", color: 0x777777, icon: "⛏️", damage: 5, type: "weapon" },
            PICK_I:   { name: "铁镐", pinyin: "tiě gǎo", color: 0xdddddd, icon: "⛏️", damage: 8, type: "weapon" },
            AXE_W:    { name: "木斧", pinyin: "mù fǔ", color: 0x8b6914, icon: "🪓", damage: 3, type: "weapon" },
            AXE_S:    { name: "石斧", pinyin: "shí fǔ", color: 0x777777, icon: "🪓", damage: 5, type: "weapon" },
            AXE_I:    { name: "铁斧", pinyin: "tiě fǔ", color: 0xdddddd, icon: "🪓", damage: 7, type: "weapon" },
            SHIELD:   { name: "盾牌", pinyin: "dùn pái", color: 0x4444aa, icon: "🛡️", damage: 0, type: "tool" },
            TORCH:    { name: "火把", pinyin: "huǒ bǎ", color: 0xffaa00, icon: "🔥", damage: 0, type: "tool" },
            PISTOL:   { name: "手枪", pinyin: "shǒu qiāng", color: 0x666666, icon: "🔫", damage: 8,  type: "weapon" },
            RIFLE:    { name: "步枪", pinyin: "bù qiāng", color: 0x444444, icon: "🎯", damage: 14, type: "weapon" },
            SNIPER:   { name: "狙击枪", pinyin: "jū jī qiāng", color: 0x2a2a2a, icon: "🔭", damage: 22, type: "weapon" },
            TANK:     { name: "坦克", pinyin: "tǎn kè", color: 0x3a4a2a, icon: "⚙️", damage: 30, type: "vehicle" },
            SWORD_D:  { name: "钻石剑", pinyin: "zuàn shí jiàn", color: 0x44ffcc, icon: "⚔️", damage: 16, type: "weapon", super: true },
            SWORD_G:  { name: "金剑", pinyin: "jīn jiàn", color: 0xffcc33, icon: "⚔️", damage: 13, type: "weapon", super: true },
            PICK_D:   { name: "钻石镐", pinyin: "zuàn shí gǎo", color: 0x44ffcc, icon: "⛏️", damage: 12, type: "weapon", super: true },
            PICK_G:   { name: "金镐", pinyin: "jīn gǎo", color: 0xffcc33, icon: "⛏️", damage: 10, type: "weapon", super: true },
            RUZI:     { name: "金箍棒", pinyin: "jīn gū bàng", color: 0xff8800, icon: "🪄", damage: 20, type: "weapon", super: true },
        };

        // 怪物类型定义（textureKey 对应 mobTextures 中的纹理）
        const MOB_TYPES = {
            CREEPER:  { name: "苦力怕", pinyin: "kǔ lì pà", bodyColor: 0x55aa44, headColor: 0x55aa44, eyeColor: 0x000000, speed: 1.5, hostile: true, scale: 1.0, legs: 2, textureKey: 'DAD', nightAbility: 'explode', abilityName: '💥 自爆', abilityDesc: '靠近玩家时自爆造成范围伤害' },
            ZOMBIE:   { name: "僵尸", pinyin: "jiāng shī", bodyColor: 0x4a6b4a, headColor: 0x6b8e23, eyeColor: 0xff0000, speed: 1.2, hostile: true, scale: 1.0, legs: 2, textureKey: 'MOM', nightAbility: 'heal', abilityName: '💚 群体治疗', abilityDesc: '治疗附近的僵尸' },
            PIG:      { name: "猪", pinyin: "zhū", bodyColor: 0xffb6c1, headColor: 0xffb6c1, eyeColor: 0x000000, speed: 0.8, hostile: false, scale: 0.9, legs: 4, textureKey: 'PIG', nightAbility: 'panic', abilityName: '🏃 恐慌逃跑', abilityDesc: '夜晚加速逃跑' },
            SKELETON: { name: "骷髅", pinyin: "kū lóu", bodyColor: 0xeeeeee, headColor: 0xeeeeee, eyeColor: 0x000000, speed: 1.0, hostile: true, scale: 1.0, legs: 2, textureKey: 'RUYI', nightAbility: 'shoot', abilityName: '🏹 远程射击', abilityDesc: '发射箭矢远程攻击' },
            SPIDER:   { name: "蜘蛛", pinyin: "zhī zhū", bodyColor: 0x222222, headColor: 0x222222, eyeColor: 0xff0000, speed: 2.0, hostile: true, scale: 1.1, legs: 8, textureKey: 'AUNT', nightAbility: 'climb', abilityName: '🧗 爬墙', abilityDesc: '可以攀爬墙壁和天花板' },
            ENDERMAN: { name: "末影人", pinyin: "mò yǐng rén", bodyColor: 0x6600cc, headColor: 0x6600cc, eyeColor: 0xff00ff, speed: 1.5, hostile: true, scale: 1.3, legs: 2, textureKey: 'UNCLE', nightAbility: 'teleport', abilityName: '✨ 瞬移', abilityDesc: '瞬移到玩家身后攻击' },
            WOLF:     { name: "狼", pinyin: "láng", bodyColor: 0x888888, headColor: 0x888888, eyeColor: 0x000000, speed: 1.5, hostile: false, scale: 1.0, legs: 4, textureKey: 'SHUAISHU', nightAbility: 'speed', abilityName: '⚡ 极速追击', abilityDesc: '速度翻倍追击猎物' },
            COW:      { name: "牛", pinyin: "niú", bodyColor: 0x664422, headColor: 0x664422, eyeColor: 0x000000, speed: 0.6, hostile: false, scale: 1.1, legs: 4, textureKey: 'COW', nightAbility: 'bellow', abilityName: '🐮 牛吼', abilityDesc: '吼叫吓退附近的怪物' },
            SHEEP:    { name: "羊", pinyin: "yáng", bodyColor: 0xeeeeee, headColor: 0xeeeeee, eyeColor: 0x000000, speed: 0.7, hostile: false, scale: 0.9, legs: 4, textureKey: 'SHEEP', nightAbility: 'flee', abilityName: '🐑 快速逃跑', abilityDesc: '看到怪物时快速逃跑' },
            CHICKEN:  { name: "鸡", pinyin: "jī", bodyColor: 0xeeeeee, headColor: 0xeeeeee, eyeColor: 0x000000, speed: 1.0, hostile: false, scale: 0.8, legs: 2, wings: true, textureKey: 'CHICKEN', nightAbility: 'fly', abilityName: '🐔 夜间飞行', abilityDesc: '夜晚可以短暂飞行' },
            BAT:      { name: "蝙蝠", pinyin: "biān fú", bodyColor: 0x444444, headColor: 0x444444, eyeColor: 0xff0000, speed: 1.2, hostile: false, scale: 0.7, legs: 0, wings: true, flying: true, textureKey: 'BAT', nightAbility: 'sonar', abilityName: '🦇 声呐定位', abilityDesc: '用声波探测周围环境' },
            RABBIT:   { name: "兔子", pinyin: "tù zi", bodyColor: 0xdddddd, headColor: 0xeeeeee, eyeColor: 0x000000, speed: 0.9, hostile: false, scale: 0.8, legs: 4, ears: true, textureKey: 'RABBIT', nightAbility: 'hop', abilityName: '🐰 跳跃', abilityDesc: '可以跳跃躲避危险' },
            GRANDMA:  { name: "奶奶", pinyin: "nǎi nai", bodyColor: 0xffcc66, headColor: 0xffcc66, eyeColor: 0x000000, speed: 0.5, hostile: false, scale: 10.0, legs: 2, textureKey: 'GRANDMA', guardian: true, nightAbility: 'bless', abilityName: '🙏 祝福', abilityDesc: '夜晚保护附近玩家不受攻击' },
            GRANDPA:  { name: "爷爷", pinyin: "yé ye", bodyColor: 0x88aaff, headColor: 0x88aaff, eyeColor: 0x000000, speed: 0.5, hostile: false, scale: 10.0, legs: 2, textureKey: 'GRANDPA', guardian: true, nightAbility: 'shield', abilityName: '🛡️ 护盾', abilityDesc: '夜晚为附近玩家生成护盾' },
        };

        const hotbarItems = [
            BLOCK_TYPES.GRASS, BLOCK_TYPES.DIRT, BLOCK_TYPES.STONE, BLOCK_TYPES.WOOD,
            BLOCK_TYPES.LEAVES, BLOCK_TYPES.SAND, BLOCK_TYPES.WATER, BLOCK_TYPES.SNOW,
            BLOCK_TYPES.PLANKS, BLOCK_TYPES.TABLE, BLOCK_TYPES.GLASS, BLOCK_TYPES.BRICK,
            BLOCK_TYPES.SBRICK, BLOCK_TYPES.COBBLE, BLOCK_TYPES.GLOW, BLOCK_TYPES.OBSIDIAN,
            BLOCK_TYPES.LAVA, BLOCK_TYPES.ICE, BLOCK_TYPES.WATERFALL,
            BLOCK_TYPES.MUSHROOM, BLOCK_TYPES.BAMBOO, BLOCK_TYPES.CORAL,
            BLOCK_TYPES.TORCH, BLOCK_TYPES.SEEDS, BLOCK_TYPES.WHEAT,
            TOOLS.HOE, TOOLS.SWORD_W, TOOLS.SWORD_S, TOOLS.SWORD_I,
            TOOLS.PICK_W, TOOLS.PICK_S, TOOLS.PICK_I,
            TOOLS.AXE_W, TOOLS.AXE_S, TOOLS.AXE_I,
            TOOLS.SHIELD,
            TOOLS.PISTOL, TOOLS.RIFLE, TOOLS.SNIPER, TOOLS.TANK
        ];
        let selectedBlockIndex = 0;

        // === 装备可用性检查 ===
        // 工具/武器/载具需要合成后才可使用；方块类始终可用（泥土、石头等基础方块）
        function isItemAvailable(item) {
            if (!item) return false;
            // 方块类：始终可用（基础方块无需合成）
            if (item.type === 'block' || item.type === 'resource' || item.type === 'crop' || item.type === 'special') {
                return true;
            }
            // 工具/武器/载具：检查库存
            if (item.type === 'tool' || item.type === 'weapon' || item.type === 'vehicle') {
                const name = (item.name || '').toLowerCase();
                // 锄头
                if (item.name && item.name.includes('锄')) return inventory.hoe;
                // 剑
                if (item.name && item.name.includes('木剑')) return inventory.swordW;
                if (item.name && item.name.includes('石剑')) return inventory.swordS;
                if (item.name && item.name.includes('铁剑')) return inventory.swordI;
                // 镐
                if (item.name && item.name.includes('木镐')) return inventory.pickW;
                if (item.name && item.name.includes('石镐')) return inventory.pickS;
                if (item.name && item.name.includes('铁镐')) return inventory.pickI;
                // 斧
                if (item.name && item.name.includes('木斧')) return inventory.axeW;
                if (item.name && item.name.includes('石斧')) return inventory.axeS;
                if (item.name && item.name.includes('铁斧')) return inventory.axeI;
                // 盾牌
                if (item.name && item.name.includes('盾')) return inventory.shield;
                // 枪械
                if (item.name && item.name.includes('手枪')) return inventory.pistol;
                if (item.name && item.name.includes('步枪')) return inventory.rifle;
                if (item.name && item.name.includes('狙击')) return inventory.sniper;
                if (item.name && item.name.includes('坦克')) return inventory.tank;
                // 金箍棒（采集 200 块材料解锁的特殊武器）
                if (item.name && item.name.includes('金箍棒')) return inventory.ruyiJbg;
                return false;
            }
            // 默认允许（基础方块）
            return true;
        }

        // 获取物品数量（用于显示）
        function getItemCount(item) {
            if (!item) return 0;
            const name = (item.name || '');
            // 工具/武器/载具：数量为1（已合成）或0（未合成）
            if (item.type === 'tool' || item.type === 'weapon' || item.type === 'vehicle') {
                return isItemAvailable(item) ? 1 : 0;
            }
            // === 所有有库存跟踪的物品都显示数量 ===
            if (name.includes('原木')) return inventory.wood;
            if (name.includes('木板')) return inventory.planks;
            if (name.includes('石头') && !name.includes('砖') && !name.includes('发') && !name.includes('矿')) return inventory.stone;
            if (name.includes('圆石')) return inventory.cobble;
            if (name.includes('铁矿石')) return inventory.iron;
            if (name.includes('煤矿石')) return inventory.coal;
            if (name.includes('工作台')) return inventory.table;
            if (name.includes('火把') && item.type !== 'tool') return inventory.torch;
            if (name.includes('种子')) return inventory.seeds;
            if (name.includes('小麦')) return inventory.wheat;
            return 0; // 基础方块（草地/泥土/沙子等）不显示数量
        }

        // 玩家库存（用于合成系统）
        const inventory = { wood: 0, planks: 0, sticks: 0, stone: 0, cobble: 0, iron: 0, coal: 0, hoe: false, table: 0, swordW: false, swordS: false, swordI: false, pickW: false, pickS: false, pickI: false, axeW: false, axeS: false, axeI: false, shield: false, torch: 0, swordD: false, swordG: false, pickD: false, pickG: false, pistol: false, rifle: false, sniper: false, tank: false, ruyiJbg: false, seeds: 0, wheat: 0, armorChest: false, armorLegs: false, armorBoots: false };

        // === 采集进度系统 ===
        // 累计采集材料块数（解锁矿石/特殊武器/答题挑战的进度）
        let totalCollected = 0;
        // 当玩家处于答题/白天时，怪物不能攻击（由 takeDamage 与追击逻辑检查）
        let playerInvulnerable = false;
        // 里程碑提示去重
        let _collectedMilestones = new Set();

        // === 🎮 小学生趣味系统 ===
        // 金币系统
        let coins = 0;
        // 每日任务系统
        let dailyTasks = [];        // 今日任务列表
        let dailyTaskDate = '';     // 今日日期（YYYY-MM-DD），用于判断是否刷新
        let dailyTasksDone = 0;     // 今日已完成任务数
        // 成就徽章系统
        let unlockedBadges = new Set();  // 已解锁徽章 id 集合
        let stepsToday = 0;              // 今日步数（任务用）
        let blocksMinedToday = 0;        // 今日挖矿数（任务用）
        let mobsDefeatedToday = 0;       // 今日击败怪物数（任务用）
        // 场景图鉴系统
        let discoveredBiomes = new Set();  // 已发现的生物群系
        // 宠物系统
        let pets = [];  // 已驯服的宠物列表 [{type, mesh, following: true}]
        // 守护神对话状态
        let guardianTalkCooldown = 0;    // 对话冷却时间戳
        // 步数统计
        let stepAccum = 0;
        let lastStepPos = null;

        // 教材闯关系统状态（提前声明，供存档加载时恢复）
        let levelState = {
            progress: {},
            superWeapons: [],
            completedUnits: 0,
            totalUnits: 0
        };
        let levelPanelOpen = false;

        // 玩家生命/饥饿值
        let health = 20, maxHealth = 20;
        let invincibleUntil = 0; // 无敌截止时间戳（存档加载后的保护窗口，避免开局被夜晚怪物打死）

        // 存档加载保护：防止存档中过低的生命/饥饿值导致玩家加载后立即死亡。
        // （典型症状：点"开始游戏"后几秒角色就死，弹出死亡复活界面，无法移动）
        function protectLoadedVitals(source) {
            const minHealth = Math.max(10, Math.ceil(maxHealth * 0.5));  // 至少 50% 生命，最低 10
            const minHunger = Math.max(12, Math.ceil(maxHunger * 0.6));  // 至少 60% 饥饿，最低 12
            let adjusted = false;
            if (!(health > 0)) { health = minHealth; adjusted = true; }
            else if (health < minHealth) { health = minHealth; adjusted = true; }
            if (!(hunger > 0)) { hunger = minHunger; adjusted = true; }
            else if (hunger < minHunger) { hunger = minHunger; adjusted = true; }
            // 给予短暂无敌窗口 + 清除附近怪物：存档位置可能在夜晚/怪物领地内
            invincibleUntil = Date.now() + 15000;
            let cleared = 0;
            try { cleared = clearHostilesNearPlayer(15); } catch (e) { }
            if (adjusted || cleared > 0) {
                try { updateVitalsUI(); } catch (e) { }
                const parts = [];
                if (adjusted) parts.push('生命/饥饿过低已补充');
                if (cleared > 0) parts.push('清除附近 ' + cleared + ' 只怪物');
                showStatus('🛡️ 存档保护：' + parts.join('，') + ' · 15 秒无敌');
            }
        }

        // 清除玩家附近半径内的敌对怪物（用于存档加载保护，避免开局被围攻）
        function clearHostilesNearPlayer(radius) {
            if (typeof mobs === 'undefined' || !mobs || !scene) return 0;
            let pos;
            try { pos = getPlayerPos(); } catch (e) { return 0; }
            let cleared = 0;
            for (const mob of mobs) {
                if (!mob || !mob.alive || !mob.type || !mob.type.hostile || !mob.mesh) continue;
                const dx = mob.mesh.position.x - pos.x;
                const dz = mob.mesh.position.z - pos.z;
                if (dx * dx + dz * dz <= radius * radius) {
                    try { scene.remove(mob.mesh); } catch (e) { }
                    mob.alive = false;
                    mob.mesh.visible = false;
                    cleared++;
                }
            }
            return cleared;
        }

        // 计算护甲减伤（胸甲20%，护腿15%，靴子10%）
        function getArmorReduction() {
            let reduction = 0;
            if (inventory.armorChest) reduction += 0.20;
            if (inventory.armorLegs) reduction += 0.15;
            if (inventory.armorBoots) reduction += 0.10;
            return reduction;
        }

        // 受到伤害（含护甲减伤）
        function takeDamage(rawDamage) {
            // 存档加载保护窗口内免疫伤害（防止开局被夜晚怪物/坠落打死）
            if (invincibleUntil > 0 && Date.now() < invincibleUntil) {
                showStatus('🛡️ 存档保护中，免疫伤害');
                return 0;
            }
            // 答题时或白天：免疫怪物伤害
            if (playerInvulnerable) {
                showStatus('🛡️ 答题保护中，免疫伤害');
                return 0;
            }
            if (isDaytime()) {
                showStatus('☀️ 白天安全模式，免疫伤害');
                return 0;
            }
            const reduction = getArmorReduction();
            const actualDamage = Math.max(1, Math.round(rawDamage * (1 - reduction)));
            health = Math.max(0, health - actualDamage);
            updateVitalsUI();
            if (reduction > 0) {
                showStatus(`🛡️ 护甲减免了 ${Math.round(rawDamage - actualDamage)} 点伤害！`);
            }
            // === 掉血特效 ===
            triggerDamageEffect(actualDamage);
            return actualDamage;
        }

        // 掉血视觉特效：屏幕红闪 + 飘字
        let damageOverlay = null;
        function triggerDamageEffect(dmg) {
            // 1. 屏幕红色闪屏
            if (!damageOverlay) {
                damageOverlay = document.createElement('div');
                damageOverlay.id = 'damage-overlay';
                damageOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;opacity:0;transition:opacity 0.15s ease-out;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 30%,rgba(255,0,0,0.6) 100%);';
                document.body.appendChild(damageOverlay);
            }
            damageOverlay.style.opacity = '1';
            setTimeout(() => { if (damageOverlay) damageOverlay.style.opacity = '0'; }, 200);

            // 2. 飘字伤害数字
            const dmgText = document.createElement('div');
            dmgText.textContent = `-${dmg}`;
            const isCrit = dmg >= 5;
            dmgText.style.cssText = `position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);font-size:${isCrit ? '48' : '32'}px;font-weight:bold;color:${isCrit ? '#ff3333' : '#ff6666'};text-shadow:0 0 8px rgba(255,0,0,0.8),2px 2px 0 #000;z-index:10000;pointer-events:none;transition:all 0.8s ease-out;`;
            document.body.appendChild(dmgText);
            requestAnimationFrame(() => {
                dmgText.style.top = '30%';
                dmgText.style.opacity = '0';
            });
            setTimeout(() => dmgText.remove(), 800);
        }
        let hunger = 20, maxHunger = 20;

        // 出生点位置（全局变量，供其他函数使用）
        let spawnX = 0, spawnZ = 0;
        let hungerTimer = 0;
        let nearGuardian = false;
        let nearZeyu = false;  // 是否靠近泽宇（兔子）
        let guardianReadTimer = 0;  // 自动朗读计时器

        // 自动存档系统（三层：缓存 + 本地 + 文件）
        let lastSaveTime = 0;
        let lastLocalSaveTime = 0;
        let lastFileSaveTime = 0;
        let playerDead = false; // 玩家是否死亡（用于存档控制）
        let lavaBurnAccum = 0; // 熔岩伤害累加器（防止每帧多次扣血）
        const SAVE_INTERVAL = 30000; // 每30秒写入缓存
        const LOCAL_SAVE_INTERVAL = 120000; // 每2分钟从缓存写入本地
        const FILE_SAVE_INTERVAL = 300000; // 每5分钟写入文件
        const SAVE_KEY_CACHE = 'minecraft3d_cache'; // 缓存存档
        const SAVE_KEY = 'minecraft3d_local'; // 本地存档
        const SAVE_FILE_NAME = 'minecraft3d_save.json'; // 存档文件名
        const SAVE_FILE_PATH = '/Users/renqiangtang2022/Documents/Codex/progress/minecraft3d_save.json'; // 默认存档路径
        
        // 文件句柄（通过 File System Access API 获取）
        let fileHandle = null;
        
        // === IndexedDB 存储文件句柄 ===
        function openIDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open('Minecraft3D', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('handles')) {
                        db.createObjectStore('handles');
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(e.target.error);
            });
        }
        
        async function saveFileHandle(handle, key = 'saveFile') {
            try {
                const db = await openIDB();
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, key);
                await new Promise((resolve, reject) => {
                    tx.oncomplete = resolve;
                    tx.onerror = reject;
                });
            } catch (e) {
                console.warn('保存文件句柄失败:', e);
            }
        }
        
        async function loadFileHandle(key = 'saveFile') {
            try {
                const db = await openIDB();
                const tx = db.transaction('handles', 'readonly');
                const req = tx.objectStore('handles').get(key);
                return new Promise((resolve) => {
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
            } catch (e) {
                console.warn('读取文件句柄失败:', e);
                return null;
            }
        }
        
        async function removeFileHandle() {
            try {
                const db = await openIDB();
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').delete('saveFile');
            } catch (e) {
                console.warn('删除文件句柄失败:', e);
            }
        }
        
        // === 文件存档操作 ===
        async function chooseSaveFile() {
            try {
                if (!window.showSaveFilePicker) {
                    showStatus('❌ 浏览器不支持文件保存API，请使用Chrome/Edge');
                    return;
                }
                
                // 使用 showDirectoryPicker 选择文件夹（推荐 progress 文件夹）
                if (window.showDirectoryPicker) {
                    const dirHandle = await window.showDirectoryPicker();
                    // 在选中的文件夹中创建存档文件
                    const fileHandle = await dirHandle.getFileHandle(SAVE_FILE_NAME, { create: true });
                    // 保存目录和文件句柄
                    await saveFileHandle(fileHandle, 'saveFile');
                    await saveFileHandle(dirHandle, 'saveDir');
                    // 设置全局 fileHandle
                    fileHandle = fileHandle;
                    showStatus('✅ 存档文件已创建，将自动保存！');
                    saveGame();
                    return;
                }
                
                // 后备方案：使用 showSaveFilePicker
                const handle = await window.showSaveFilePicker({
                    suggestedName: SAVE_FILE_NAME,
                    types: [{ description: 'JSON存档', accept: { 'application/json': ['.json'] } }]
                });
                fileHandle = handle;
                await saveFileHandle(handle, 'saveFile');
                showStatus('✅ 已选择存档文件，存档将自动保存到此文件！');
                saveGame();
            } catch (e) {
                console.warn('选择文件失败:', e);
                showStatus('❌ 选择文件失败: ' + e.message);
            }
        }
        
        async function openSaveFile() {
            try {
                if (!window.showOpenFilePicker) {
                    showStatus('❌ 浏览器不支持文件打开API，请使用Chrome/Edge');
                    return;
                }
                const [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'JSON存档', accept: { 'application/json': ['.json'] } }]
                });
                fileHandle = handle;
                await saveFileHandle(handle, 'saveFile');
                showStatus('✅ 已打开存档文件，存档将自动保存到此文件！');
                loadGame();
            } catch (e) {
                console.warn('打开文件失败:', e);
            }
        }
        
        // 检查文件权限
        async function checkFilePermission() {
            if (!fileHandle) return false;
            try {
                const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
                return permission === 'granted';
            } catch (e) {
                console.warn('权限检查失败:', e);
                return false;
            }
        }
        
        async function writeToFile(data) {
            if (!fileHandle) return false;
            try {
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(data, null, 2));
                await writable.close();
                return true;
            } catch (e) {
                console.warn('写入文件失败:', e);
                return false;
            }
        }
        
        async function readFromFile() {
            if (!fileHandle) return null;
            try {
                const file = await fileHandle.getFile();
                const text = await file.text();
                return JSON.parse(text);
            } catch (e) {
                // 权限失效或文件不存在，静默返回 null（会回退到 localStorage）
                return null;
            }
        }
        
        // 启动时尝试加载文件句柄
        async function initFileSave() {
            fileHandle = await loadFileHandle();
            if (fileHandle) {
                // 直接尝试读取，不调用 requestPermission（页面加载时无用户激活，会触发 SecurityError）
                showStatus('📁 正在尝试加载存档...');
                let data = null;
                let readOk = false;
                try {
                    data = await readFromFile();
                    readOk = true;
                } catch (e) {
                    console.warn('文件读取失败（权限可能已失效）:', e);
                }
                if (readOk && data) {
                    // 应用文件存档数据
                    if (data.health !== undefined) health = data.health;
                    if (data.hunger !== undefined) hunger = data.hunger;
                    protectLoadedVitals('文件存档');
                    if (data.inventory) Object.assign(inventory, data.inventory);
                    if (data.selectedBlockIndex !== undefined) selectedBlockIndex = data.selectedBlockIndex;
                    if (data.gameTime !== undefined) gameTime = data.gameTime;
                    if (data.currentWeather !== undefined) currentWeather = data.currentWeather;
                    if (data.playerPos && playerModel) {
                        const px = data.playerPos.x;
                        const pz = data.playerPos.z;
                        let py = data.playerPos.y;
                        const groundY = getGroundY(px, pz);
                        const terrainY = getTerrainHeight(px, pz);
                        const safeGroundY = Math.max(groundY, terrainY + 1);
                        if (py < safeGroundY) py = safeGroundY + 0.1;
                        playerModel.position.set(px, py, pz);
                        velocity.set(0, 0, 0);
                        updatePlayerPosition();
                    }
                    // 恢复教材关卡进度
                    if (data.levelState) restoreLevelState(data.levelState);
                    // 恢复已探索解锁的城市
                    if (data.cityTeleportUnlocked) {
                        cityTeleportUnlocked = new Set(data.cityTeleportUnlocked);
                    }
                    // 恢复方块修改（挖掘/放置）
                    let extraInfo = '';
                    if (data.blockChanges) {
                        blockChanges = new Map(Object.entries(data.blockChanges));
                        for (const [ck, blocksInChunk] of generatedChunks) {
                            const pp = ck.split(',');
                            applyBlockChangesForChunk(parseInt(pp[0], 10), parseInt(pp[1], 10), blocksInChunk);
                        }
                        if (blockChanges.size > 0) extraInfo = `（含 ${blockChanges.size} 处方块修改）`;
                    }
                    if (data.cityTeleportUnlocked && data.cityTeleportUnlocked.length > 0) {
                        extraInfo += `（已探索 ${data.cityTeleportUnlocked.length} 个城市）`;
                    }
                    updateVitalsUI();
                    showStatus(`📁 已从文件加载存档${extraInfo}！`);
                    return;
                } else {
                    // 读取失败，清除无效的 fileHandle
                    fileHandle = null;
                    showStatus('📁 存档文件权限已失效，请重新选择文件（或继续用本地存档）');
                }
            }
            // 文件不存在或读取失败，使用 localStorage 存档
            loadGame();
        }

        function saveGame() {
            try {
                // 玩家死亡时不保存存档
                if (playerDead || health <= 0) return;
                
                const saveData = {
                    health: health,
                    hunger: hunger,
                    inventory: inventory,
                    selectedBlockIndex: selectedBlockIndex,
                    gameTime: gameTime,
                    currentWeather: currentWeather,
                    playerPos: playerModel ? {
                        x: playerModel.position.x,
                        y: playerModel.position.y,
                        z: playerModel.position.z
                    } : null,
                    playerDead: false,
                    levelState: (typeof levelState !== 'undefined') ? levelState : null,
                    blockChanges: Object.fromEntries(blockChanges), // 玩家挖掘/放置的方块，持久化探索痕迹
                    cityTeleportUnlocked: Array.from(cityTeleportUnlocked), // 已探索解锁的城市
                    totalCollected: totalCollected,
                    collectedMilestones: Array.from(_collectedMilestones),
                    // 🎮 趣味系统数据
                    coins: coins,
                    unlockedBadges: Array.from(unlockedBadges),
                    discoveredBiomes: Array.from(discoveredBiomes),
                    totalMobsDefeated: totalMobsDefeated,
                    totalBlocksPlaced: totalBlocksPlaced,
                    totalDailyTasksDone: totalDailyTasksDone,
                    totalCoinsEarned: totalCoinsEarned,
                    // 🎓 XP / 学习等级系统
                    playerXP: playerXP,
                    playerLevel: playerLevel,
                    xpPerLevel: xpPerLevel,
                    xpywCount: xpywCount,
                    xpsxCount: xpsxCount,
                    xpyyCount: xpyyCount,
                    dailyTasks: dailyTasks.map(t => ({ id: t.id, progress: t.progress, done: t.done })),
                    dailyTaskDate: dailyTaskDate,
                    timestamp: Date.now()
                };
                // 写入缓存
                localStorage.setItem(SAVE_KEY_CACHE, JSON.stringify(saveData));
                
                // 定时写入本地存档（从缓存同步）
                const now = Date.now();
                if (now - lastLocalSaveTime >= LOCAL_SAVE_INTERVAL) {
                    lastLocalSaveTime = now;
                    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
                    showStatus('💾 已保存至本地！');
                }
                
                // 定时写入文件存档
                if (fileHandle && now - lastFileSaveTime >= FILE_SAVE_INTERVAL) {
                    lastFileSaveTime = now;
                    writeToFile(saveData).then(success => {
                        if (success) showStatus('📁 已保存至文件！');
                        else if (fileHandle) {
                            // 文件写入失败（权限可能已失效），提示用户
                            fileHandle = null;
                            showStatus('⚠️ 文件存档写入失败，请重新选择存档文件');
                        }
                    });
                }
                
                lastSaveTime = Date.now();
            } catch (e) {
                console.warn('Save failed:', e);
            }
        }

        function loadGame() {
            try {
                // 优先读取缓存
                let saved = localStorage.getItem(SAVE_KEY_CACHE);
                let source = '缓存';
                
                // 缓存不存在，读取本地存档
                if (!saved) {
                    saved = localStorage.getItem(SAVE_KEY);
                    source = '本地';
                }
                
                if (!saved) return false;
                const data = JSON.parse(saved);
                
                // 如果存档标记为死亡，不加载（重新开始）
                if (data.playerDead === true || data.health <= 0) {
                    localStorage.removeItem(SAVE_KEY_CACHE);
                    localStorage.removeItem(SAVE_KEY);
                    showStatus('🔄 重新开始游戏');
                    return false;
                }
                
                if (data.health !== undefined) health = data.health;
                if (data.hunger !== undefined) hunger = data.hunger;
                protectLoadedVitals(source + '存档');
                if (data.inventory) Object.assign(inventory, data.inventory);
                if (data.selectedBlockIndex !== undefined) selectedBlockIndex = data.selectedBlockIndex;
                if (data.gameTime !== undefined) gameTime = data.gameTime;
                if (data.currentWeather !== undefined) currentWeather = data.currentWeather;
                if (data.totalCollected !== undefined) totalCollected = data.totalCollected;
                if (data.collectedMilestones) _collectedMilestones = new Set(data.collectedMilestones);
                // 🎮 加载趣味系统数据
                if (data.coins !== undefined) coins = data.coins;
                if (data.unlockedBadges) unlockedBadges = new Set(data.unlockedBadges);
                if (data.discoveredBiomes) discoveredBiomes = new Set(data.discoveredBiomes);
                if (data.totalMobsDefeated !== undefined) totalMobsDefeated = data.totalMobsDefeated;
                if (data.totalBlocksPlaced !== undefined) totalBlocksPlaced = data.totalBlocksPlaced;
                if (data.totalDailyTasksDone !== undefined) totalDailyTasksDone = data.totalDailyTasksDone;
                if (data.totalCoinsEarned !== undefined) totalCoinsEarned = data.totalCoinsEarned;
                // 🎓 加载 XP / 学习等级数据
                if (data.playerXP !== undefined) playerXP = data.playerXP;
                if (data.playerLevel !== undefined) playerLevel = data.playerLevel;
                if (data.xpPerLevel !== undefined) xpPerLevel = data.xpPerLevel;
                if (data.xpywCount !== undefined) xpywCount = data.xpywCount;
                if (data.xpsxCount !== undefined) xpsxCount = data.xpsxCount;
                if (data.xpyyCount !== undefined) xpyyCount = data.xpyyCount;
                if (data.dailyTaskDate) dailyTaskDate = data.dailyTaskDate;
                if (data.dailyTasks) {
                    // 恢复每日任务（合并进度）
                    const savedTasks = data.dailyTasks;
                    dailyTasks = savedTasks.map(st => {
                        const tpl = DAILY_TASK_POOL.find(t => t.id === st.id);
                        if (!tpl) return null;
                        return { ...tpl, progress: st.progress || 0, done: st.done || false };
                    }).filter(Boolean);
                    dailyTasksDone = dailyTasks.filter(t => t.done).length;
                }
                if (data.playerPos && playerModel) {
                    // 加载位置后验证是否在有效地面
                    let px = data.playerPos.x;
                    let py = data.playerPos.y;
                    let pz = data.playerPos.z;
                    // 确保玩家在地面上方
                    const groundY = getGroundY(px, pz);
                    const terrainY = getTerrainHeight(px, pz);
                    // 使用较高的地面高度（blocksMap优先，terrainHeight后备）
                    const safeGroundY = Math.max(groundY, terrainY + 1);
                    if (py < safeGroundY) py = safeGroundY + 0.1;
                    // 确保不在方块内部
                    if (checkCollision(px, py + 0.5, pz, 0.3, 1.6)) {
                        // 位置无效，重置到出生点
                        px = spawnX || 0;
                        pz = spawnZ || 0;
                        const spawnGroundY = Math.max(getGroundY(px, pz), getTerrainHeight(px, pz) + 1);
                        py = spawnGroundY + 0.1;
                    }
                    playerModel.position.set(px, py, pz);
                    velocity.set(0, 0, 0);
                    // 立即更新位置，确保落地
                    updatePlayerPosition();
                }
                // 恢复教材关卡进度与已获得的超级武器
                if (data.levelState) restoreLevelState(data.levelState);
                // 恢复金箍棒（采集200块材料解锁）
                if (inventory.ruyiJbg && !hotbarItems.find(i => i.name === TOOLS.RUZI.name)) {
                    hotbarItems.push(TOOLS.RUZI);
                }
                // 恢复已探索解锁的城市
                if (data.cityTeleportUnlocked) {
                    cityTeleportUnlocked = new Set(data.cityTeleportUnlocked);
                }
                // 恢复方块修改（挖掘/放置），并对当前已生成的 chunk 立即应用
                let extraInfo = '';
                if (data.blockChanges) {
                    blockChanges = new Map(Object.entries(data.blockChanges));
                    for (const [ck, blocksInChunk] of generatedChunks) {
                        const pp = ck.split(',');
                        applyBlockChangesForChunk(parseInt(pp[0], 10), parseInt(pp[1], 10), blocksInChunk);
                    }
                    if (blockChanges.size > 0) extraInfo = `（含 ${blockChanges.size} 处方块修改）`;
                }
                if (data.cityTeleportUnlocked && data.cityTeleportUnlocked.length > 0) {
                    extraInfo += `（已探索 ${data.cityTeleportUnlocked.length} 个城市）`;
                }
                updateVitalsUI();
                showStatus(`📂 已从${source}读取存档${extraInfo}！`);
                return true;
            } catch (e) {
                console.warn('Load failed:', e);
                return false;
            }
        }

        function checkAutoSave() {
            const now = Date.now();
            if (now - lastSaveTime >= SAVE_INTERVAL) {
                saveGame();
            }
        }

        // 三维场景变量
        let scene, camera, renderer, controls;
        let waterSurface = null;
        let playerTexture = null;
        let mobTextures = {};  // 每个怪物类型的纹理
        let TEXTURE_NAMES = {};  // 纹理名称映射（textureKey -> 中文名称）
        let playerModel = null;
        let cloudMesh = null; // 筋斗云
        let thirdPerson = true;  // 第三人称/第一人称切换
        let handItem = null;
        let handItemMesh = null;
        let blocksMap = new Map(); // 存储所有方块 (key: "x,y,z", val: {typeId, instId})
        let treeBlocks = new Set(); // 存储树木方块（不碰撞）
        let blockChanges = new Map(); // 玩家修改的方块（key -> typeId，-1 表示移除），存档时持久化，重新加载 chunk 后应用
        let suppressBlockChanges = false; // chunk 地形生成期间抑制记录（只保存玩家手动修改）
        let cropStages = new Map(); // 作物生长阶段 (key: "x,y,z" -> 0-7)
        const CROP_FULL_STAGE = 7; // 作物完全成熟阶段
        const CROP_GROWTH_INTERVAL = 5; // 每 5 秒生长一阶段

        function getBlockCropStage(key) {
            return cropStages.get(key) || 0;
        }
        function setBlockCropStage(key, stage) {
            cropStages.set(key, stage);
        }
        function clearBlockCropStage(key) {
            cropStages.delete(key);
        }
        let raycaster = new THREE.Raycaster();
        let mouse = new THREE.Vector2(0, 0); // 准星固定在屏幕中心

        function getPlayerPos() {
            return playerModel ? playerModel.position : controls.getObject().position;
        }
        
        // 更新玩家位置（确保落地）
        function updatePlayerPosition() {
            if (!playerModel) return;
            const pos = playerModel.position;
            // 飞行时不吸附地面，允许自由移动
            if (!flying) {
                const groundY = Math.max(getGroundY(pos.x, pos.z), getTerrainHeight(pos.x, pos.z) + 1);
                if (pos.y < groundY) {
                    pos.y = groundY;
                    if (velocity.y < 0) velocity.y = 0;
                }
            }
            // 同步相机
            if (controls && controls.getObject()) {
                controls.getObject().position.copy(pos);
            }
        }

        // 昼夜系统（10分钟周期：白天0-300，夜晚300-600）
        let gameTime = 30; // 初始白天
        const DAY_LENGTH = 600;
        const DAY_END = 300;
        function isDaytime() { return (gameTime % DAY_LENGTH) < DAY_END; }

        // 天气系统
        let currentWeather = 'sunny'; // sunny, cloudy, rain, snow, wind, typhoon
        let weatherTimer = 0;
        let weatherParticles = null;
        let sunMesh = null, moonMesh = null;
        let starField = null; // 星空
        let weatherCloudMesh = null; // 天气云朵
        // 阴历月亮圆缺（根据日期计算月相）
        function getMoonPhase() {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            // 简化的月相计算（以农历初一为基准，约29.53天一个周期）
            const newMoonDate = new Date(2024, 0, 10); // 2024年1月10日农历新年
            const daysSinceNewMoon = Math.floor((now - newMoonDate) / (1000 * 60 * 60 * 24));
            const phase = daysSinceNewMoon % 29.53;
            return phase / 29.53; // 0=新月, 0.5=满月
        }

        // 物理与移动控制变量
        let moveForward = false;
        let moveBackward = false;
        let moveLeft = false;
        let moveRight = false;
        let canJump = false;
        let jumpHeld = false;
        let sprintHeld = false;
        let flyDownHeld = false; // 飞行下降（Q键）
        let flyBoost = false; // 飞行加速（Shift键）
        let gameActive = false; // 游戏是否激活（Pointer Lock 成功 或 兜底拖拽模式）
        let fallbackMode = false; // 是否处于「按住鼠标拖拽看视角」兜底模式（一旦进入就不再回退到菜单）
        let flying = false; // 飞行模式（F 键切换，可穿越全地图）

        // 玩家模型肢体引用（用于走路动画）
        let playerLegL = null, playerLegR = null, playerArmL = null, playerArmR = null;
        let playerHandL = null, playerHandR = null;
        let walkPhase = 0; // 走路动画相位
        let attackTimer = 0; // 攻击动画计时器

        let prevTime = performance.now();
        const velocity = new THREE.Vector3();
        const direction = new THREE.Vector3();

        // === 噪声函数（无限地图地形生成）===
        function hash2D(x, z) {
            const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
            return n - Math.floor(n);
        }
        function smoothstep(t) { return t * t * (3 - 2 * t); }
        function lerp(a, b, t) { return a + (b - a) * t; }
        function noise2D(x, z) {
            const x0 = Math.floor(x), z0 = Math.floor(z);
            const fx = x - x0, fz = z - z0;
            const sx = smoothstep(fx), sz = smoothstep(fz);
            return lerp(lerp(hash2D(x0,z0), hash2D(x0+1,z0), sx),
                        lerp(hash2D(x0,z0+1), hash2D(x0+1,z0+1), sx), sz);
        }
        function fbm(x, z, oct, freq, amp) {
            let val = 0, total = 0;
            for (let i = 0; i < oct; i++) {
                val += noise2D(x * freq, z * freq) * amp;
                total += amp; freq *= 2; amp *= 0.5;
            }
            return val / total;
        }

        // === 区块系统（无限地图）===
        const CHUNK_SIZE = 16;
        const WATER_LEVEL = 2;        // 水面高度
        const RENDER_DIST = 4;        // 渲染距离（chunk 数）
        const UNLOAD_DIST = 6;        // 卸载距离（chunk 数，略大于渲染距离避免频繁重载）
        const generatedChunks = new Map(); // key "cx,cz" -> Set of block keys in this chunk
        const WATER_LEVEL_Y = WATER_LEVEL;

        function chunkKey(cx, cz) { return cx + ',' + cz; }

        // ===== 内联版第一人称控制器 =====
        // 不依赖第二个 CDN 文件：如果 PointerLockControls.js 加载失败，
        // 用它自带的实现，避免整段初始化抛异常导致"点开始没反应/无法移动"。
        function SimplePointerLockControls(camera, domElement) {
            const scope = this;
            scope.camera = camera;
            scope.domElement = domElement || document.body;
            scope.isLocked = false;
            scope._listeners = {};
            scope._euler = new THREE.Euler(0, 0, 0, 'YXZ');
            scope._vec = new THREE.Vector3();

            document.addEventListener('pointerlockchange', () => {
                const got = document.pointerLockElement === scope.domElement;
                scope.isLocked = got;
                scope.dispatchEvent({ type: got ? 'lock' : 'unlock' });
            });

            document.addEventListener('mousemove', (e) => {
                if (!scope.isLocked) return;
                const mx = e.movementX || e.mozMovementX || 0;
                const my = e.movementY || e.mozMovementY || 0;
                // 跟踪鼠标位移（坦克炮塔瞄准用）
                mouseDeltaX += mx;
                mouseDeltaY += my;
                scope._euler.setFromQuaternion(scope.camera.quaternion);
                scope._euler.y -= mx * 0.002;
                scope._euler.x -= my * 0.002;
                scope._euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, scope._euler.x));
                scope.camera.quaternion.setFromEuler(scope._euler);
            });

            scope.lock = function () {
                try {
                    const p = scope.domElement.requestPointerLock();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                } catch (err) { /* 由 pointerlockerror 处理 */ }
            };
            scope.unlock = function () {
                if (document.exitPointerLock) document.exitPointerLock();
            };
            scope.getObject = function () { return camera; };
            scope.moveForward = function (distance) {
                scope._vec.setFromMatrixColumn(camera.matrix, 0);
                scope._vec.crossVectors(camera.up, scope._vec);
                camera.position.addScaledVector(scope._vec, distance);
            };
            scope.moveRight = function (distance) {
                scope._vec.setFromMatrixColumn(camera.matrix, 0);
                camera.position.addScaledVector(scope._vec, distance);
            };
            scope.addEventListener = function (type, cb) {
                (scope._listeners[type] = scope._listeners[type] || []).push(cb);
            };
            scope.dispatchEvent = function (ev) {
                (scope._listeners[ev.type] || []).forEach(cb => cb(ev));
            };
        }

        // 更新进度条的辅助函数（全局，generateTerrain 等函数需要调用）
        function updateProgress(percent, text) {
            const bar = document.getElementById('loading-bar');
            const statusEl = document.getElementById('loading-status');
            const percentEl = document.getElementById('loading-percent');
            if (bar) bar.style.width = percent + '%';
            if (statusEl) statusEl.innerHTML = withPinyin(text);
            if (percentEl) percentEl.textContent = percent + '%';
        }

        // 启动流程
        window.addEventListener('DOMContentLoaded', async () => {
            // 防御：Three.js 库加载失败时给出明确提示
            if (typeof THREE === 'undefined') {
                document.getElementById('instructions').innerHTML =
                    '<h1 style="color:#ff5555">加载失败 (Jiā Zài Shī Bài)</h1>' +
                    '<p>Three.js 3D 库未能加载（需要访问 unpkg.com）。</p>' +
                    '<p>请检查网络连接或改用其他浏览器，然后刷新本页重试。</p>';
                return;
            }
            
            // 等待一帧让UI更新
            function waitFrame() {
                return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
            
            updateProgress(5, '初始化界面...');
            await waitFrame();
            initUI();
            
            updateProgress(15, '初始化合成系统...');
            await waitFrame();
            initCraftGridEvents();
            
            updateProgress(25, '初始化3D场景...');
            await waitFrame();
            initThree();
            
            updateProgress(35, '生成地形（区块）...');
            await waitFrame();
            await generateTerrain();
            
            updateProgress(70, '初始化副本入口...');
            await waitFrame();
            initDungeonEntrances();
            
            updateProgress(85, '加载存档...');
            await waitFrame();
            initFileSave(); // 异步加载文件存档
            
            updateProgress(88, '加载本地教材...');
            await waitFrame();
            await LOCAL_TEXTBOOK.load(); // 从 教材/*.txt 动态读取课文
            
            updateProgress(92, '启动游戏...');
            await waitFrame();
            animate();
            
            updateProgress(100, '加载完成！');
            
            // 隐藏加载指示器
            setTimeout(() => {
                const loadingEl = document.getElementById('loading-indicator');
                if (loadingEl) {
                    loadingEl.style.display = 'none';
                }
                // 隐藏全屏加载遮罩
                const fullLoader = document.getElementById('full-screen-loader');
                if (fullLoader) {
                    fullLoader.style.display = 'none';
                }
            }, 500);
        });

        // 1. 初始化快捷栏与界面交互
        function initUI() {
            const container = document.getElementById('hotbar-container');
            container.innerHTML = '';
            hotbarItems.forEach((item, index) => {
                const slot = document.createElement('div');
                const available = isItemAvailable(item);
                slot.className = `hotbar-slot ${index === 0 && available ? 'active' : ''} ${available ? '' : 'locked'}`;
                slot.dataset.index = index;

                const keyLabel = document.createElement('span');
                keyLabel.className = 'slot-key';
                keyLabel.innerText = index + 1;
                keyLabel.style.opacity = available ? '0.8' : '0.3';

                const icon = document.createElement('div');
                icon.className = 'block-icon';
                if (item.icon) {
                    icon.style.fontFamily = 'monospace';
                    icon.style.fontSize = '20px';
                    icon.style.display = 'flex';
                    icon.style.alignItems = 'center';
                    icon.style.justifyContent = 'center';
                    icon.style.backgroundColor = available ? 'rgba(180,160,80,0.6)' : 'rgba(80,80,80,0.4)';
                    icon.innerText = available ? item.icon : '🔒';
                } else {
                    icon.style.backgroundColor = available ? '#' + item.color.toString(16).padStart(6, '0') : '#333333';
                    if (!available) {
                        icon.style.opacity = '0.4';
                    }
                }
                
                // 显示物品名称
                const nameLabel = document.createElement('span');
                nameLabel.className = 'slot-name';
                nameLabel.style.color = available ? '#ddd' : '#666';
                nameLabel.innerText = available ? item.name : '🔒' + item.name;
                slot.appendChild(nameLabel);

                // 显示数量
                const count = getItemCount(item);
                if (count > 0) {
                    const countLabel = document.createElement('span');
                    countLabel.className = 'slot-count';
                    countLabel.innerText = '×' + count;
                    slot.appendChild(countLabel);
                }
                
                slot.appendChild(keyLabel);
                slot.appendChild(icon);

                slot.addEventListener('click', () => selectSlot(index));
                container.appendChild(slot);
            });

            // 滚轮切换选中的方块
            window.addEventListener('wheel', (e) => {
                if (e.deltaY > 0) {
                    selectSlot((selectedBlockIndex + 1) % hotbarItems.length);
                } else {
                    selectSlot((selectedBlockIndex - 1 + hotbarItems.length) % hotbarItems.length);
                }
            });
            
            // 功能按钮事件
            document.getElementById('btn-save-panel').addEventListener('click', () => {
                toggleSavePanel();
            });
            document.getElementById('save-btn-local').addEventListener('click', () => {
                saveGame();
                document.getElementById('save-status').innerHTML = '✅ 已保存到浏览器缓存 (Yǐ Bǎo Cún Dào Lǎn Kàn Qiú Huàn Cún)！';
            });
            document.getElementById('save-btn-load').addEventListener('click', () => {
                if (loadGame()) {
                    document.getElementById('save-status').innerHTML = '✅ 存档已读取 (Cún Dàng Yǐ Dú Qǔ)！';
                } else {
                    document.getElementById('save-status').innerHTML = '❌ 没有找到存档 (Mèi Zhǎo Dào Cún Dàng)！';
                }
            });
            document.getElementById('save-btn-file-save').addEventListener('click', () => {
                chooseSaveFile();
                document.getElementById('save-status').innerHTML = '📁 请选择存档文件位置 (Qǐng Xuǎn Zé Wén Jiàn Wèi Zhì)';
            });
            document.getElementById('save-btn-file-open').addEventListener('click', () => {
                openSaveFile();
                document.getElementById('save-status').innerHTML = '📂 请选择存档文件 (Qǐng Xuǎn Zé Wén Jiàn)';
            });
            document.getElementById('btn-player').addEventListener('click', () => {
                togglePlayerStats();
            });
            document.getElementById('btn-teleport').addEventListener('click', () => {
                toggleCityTeleport();
            });
            document.getElementById('btn-map').addEventListener('click', () => {
                toggleWorldMap();
            });
            document.getElementById('btn-reading').addEventListener('click', () => {
                toggleReadingPanel();
            });
            document.getElementById('btn-voice').addEventListener('click', () => {
                cycleTTSVoice();
            });
        }
        
        // === 存档面板系统 ===
        function toggleSavePanel() {
            const overlay = document.getElementById('save-panel-overlay');
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
                // 关闭面板：恢复游戏状态并重新锁定鼠标
                gameActive = true;
                controls.lock();
            } else {
                overlay.style.display = 'flex';
                if (gameActive) {
                    gameActive = false;
                    controls.unlock();
                }
            }
        }
        
        // === 城市传送系统 ===
        function toggleCityTeleport() {
            const overlay = document.getElementById('city-teleport-overlay');
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
                // 关闭面板：恢复游戏状态并重新锁定鼠标
                gameActive = true;
                controls.lock();
            } else {
                overlay.style.display = 'flex';
                renderCityMap();
                if (gameActive) {
                    gameActive = false;
                    controls.unlock();
                }
            }
        }
        
        function renderCityMap() {
            const container = document.getElementById('city-map-container');
            container.innerHTML = '';
            
            // 地图范围：-180 到 180（容纳所有城市坐标）
            const mapRange = 420;
            const containerRect = container.getBoundingClientRect();
            const width = containerRect.width || 750;
            const height = containerRect.height || 700;
            
            // 玩家位置标记（带标签）
            const playerPos = getPlayerPos();
            const playerX = (playerPos.x + mapRange) / (mapRange * 2) * width;
            const playerY = (playerPos.z + mapRange) / (mapRange * 2) * height;
            const playerMarker = document.createElement('div');
            playerMarker.className = 'map-player-marker';
            playerMarker.style.left = playerX + 'px';
            playerMarker.style.top = playerY + 'px';
            playerMarker.title = `玩家位置 (${Math.round(playerPos.x)}, ${Math.round(playerPos.z)})`;
            playerMarker.innerHTML = `<span style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:10px;color:#fff;background:rgba(255,68,68,0.9);padding:2px 6px;border-radius:3px;white-space:nowrap;border:1px solid #fff;">📍 玩家 (${Math.round(playerPos.x)}, ${Math.round(playerPos.z)})</span>`;
            container.appendChild(playerMarker);
            
            // 出生点/复活点标记（可传送）
            const spawnX_val = (spawnX + mapRange) / (mapRange * 2) * width;
            const spawnY_val = (spawnZ + mapRange) / (mapRange * 2) * height;
            const spawnDot = document.createElement('div');
            spawnDot.className = 'map-dot';
            spawnDot.style.left = spawnX_val + 'px';
            spawnDot.style.top = spawnY_val + 'px';
            spawnDot.style.background = '#00ff00';
            spawnDot.style.width = '30px';
            spawnDot.style.height = '30px';
            spawnDot.style.fontSize = '14px';
            spawnDot.innerHTML = '🏠<span class="dot-label">出生点 (chū shēng diǎn)</span>';
            spawnDot.title = '出生点/复活点 (chū shēng diǎn)（点击传送）';
            spawnDot.addEventListener('click', () => {
                teleportToSpawn();
            });
            container.appendChild(spawnDot);
            
            // 城市标记
            CITY_TELEPORTS.forEach(city => {
                const unlocked = cityTeleportUnlocked.has(city.name);
                const marker = cityTeleportMarkers.find(m => m.city.name === city.name);
                if (!marker) return;
                
                const x = (marker.city.x + mapRange) / (mapRange * 2) * width;
                const y = (marker.city.z + mapRange) / (mapRange * 2) * height;
                
                const dot = document.createElement('div');
                dot.className = 'map-dot' + (unlocked ? '' : ' locked');
                // 检查是否是当前位置
                const isCurrent = Math.hypot(playerPos.x - marker.city.x, playerPos.z - marker.city.z) < 5;
                if (isCurrent) dot.classList.add('current');
                
                dot.style.left = x + 'px';
                dot.style.top = y + 'px';
                dot.style.background = '#' + city.color.toString(16).padStart(6, '0');
                dot.style.cursor = (unlocked && !isCurrent) ? 'pointer' : 'not-allowed';
                dot.innerHTML = `${city.icon}<span class="dot-label">${city.name} (${city.pinyin})</span>`;
                dot.title = `${city.name} ${city.pinyin}${unlocked ? '' : ' (未解锁)'}`;
                
                if (unlocked && !isCurrent) {
                    dot.addEventListener('click', (e) => {
                        e.stopPropagation();
                        teleportToCity(city.name);
                    });
                } else if (isCurrent) {
                    dot.title = `${city.name}（当前所在城市）`;
                }
                
                container.appendChild(dot);
            });
            
            // 副本传送门标记（地图上显示副本入口）
            if (dungeonPortals.length > 0) {
                dungeonPortals.forEach(p => {
                    const x = (p.entrance.x + mapRange) / (mapRange * 2) * width;
                    const y = (p.entrance.z + mapRange) / (mapRange * 2) * height;
                    
                    const dot = document.createElement('div');
                    dot.className = 'map-dot';
                    dot.style.left = x + 'px';
                    dot.style.top = y + 'px';
                    dot.style.background = '#' + p.entrance.color.toString(16).padStart(6, '0');
                    dot.style.width = '25px';
                    dot.style.height = '25px';
                    dot.style.fontSize = '12px';
                    dot.innerHTML = '⚔️<span class="dot-label">' + p.entrance.name + '</span>';
                    dot.title = p.entrance.name + ' (fù běn rù kǒu)';
                    container.appendChild(dot);
                });
            }
        }
        
        function teleportToCity(cityName) {
            const marker = cityTeleportMarkers.find(m => m.city.name === cityName);
            if (!marker) {
                showStatus('❌ 找不到该城市！');
                return;
            }
            
            // 传送玩家到城市传送点上方安全位置
            const pos = getPlayerPos();
            const targetX = marker.city.x;
            const targetZ = marker.city.z;
            
            // 强制加载传送点周围的区块（确保传送点地形已生成）
            const pcx = Math.floor(targetX / CHUNK_SIZE);
            const pcz = Math.floor(targetZ / CHUNK_SIZE);
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    generateChunk(pcx + dx, pcz + dz);
                }
            }
            
            // 找到安全高度（确保不在水下、不在方块内）
            const safePos = findSafeTeleportPos(targetX, targetZ);
            pos.x = safePos.x;
            pos.z = safePos.z;
            pos.y = safePos.y;
            velocity.set(0, 0, 0);
            
            // 传送后检查：如果玩家在方块内，向上推出
            if (checkCollision(pos.x, pos.y, pos.z, 0.3, 1.8)) {
                for (let step = 0.2; step <= 5.0; step += 0.2) {
                    if (!checkCollision(pos.x, pos.y + step, pos.z, 0.3, 1.8)) {
                        pos.y += step;
                        break;
                    }
                }
            }
            
            // 关闭面板
            document.getElementById('city-teleport-overlay').style.display = 'none';
            
            // 恢复游戏
            gameActive = true;
            controls.lock();
            
            showStatus(`🗺️ 传送到 ${cityName}！`);
            saveGame();
        }
        
        // 传送到出生点
        function teleportToSpawn() {
            const targetX = spawnX;
            const targetZ = spawnZ;
            
            // 强制加载出生点周围的区块
            const pcx = Math.floor(targetX / CHUNK_SIZE);
            const pcz = Math.floor(targetZ / CHUNK_SIZE);
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    generateChunk(pcx + dx, pcz + dz);
                }
            }
            
            // 找到安全位置
            const safePos = findSafeTeleportPos(targetX, targetZ);
            const pos = getPlayerPos();
            pos.x = safePos.x;
            pos.z = safePos.z;
            pos.y = safePos.y;
            velocity.set(0, 0, 0);
            
            // 传送后检查：如果玩家在方块内，向上推出
            if (checkCollision(pos.x, pos.y, pos.z, 0.3, 1.8)) {
                for (let step = 0.2; step <= 5.0; step += 0.2) {
                    if (!checkCollision(pos.x, pos.y + step, pos.z, 0.3, 1.8)) {
                        pos.y += step;
                        break;
                    }
                }
            }
            
            // 关闭面板
            document.getElementById('city-teleport-overlay').style.display = 'none';
            document.getElementById('world-map-overlay').style.display = 'none';
            
            // 恢复游戏
            gameActive = true;
            controls.lock();
            
            showStatus('🏠 传送到出生点！');
            saveGame();
        }
        
        // 寻找安全传送位置（不在水下、不在方块内）
        function findSafeTeleportPos(targetX, targetZ) {
            const tx = Math.floor(targetX);
            const tz = Math.floor(targetZ);
            
            // 检查目标位置是否安全
            if (isTeleportPosSafe(tx, tz)) {
                const groundY = getGroundY(tx, tz);
                return { x: tx + 0.5, z: tz + 0.5, y: groundY + 0.1 };
            }
            
            // 搜索附近的陆地区域（螺旋搜索）
            for (let radius = 2; radius <= 30; radius += 2) {
                for (let dx = -radius; dx <= radius; dx += 2) {
                    for (let dz = -radius; dz <= radius; dz += 2) {
                        const x = tx + dx, z = tz + dz;
                        if (isTeleportPosSafe(x, z)) {
                            const groundY = getGroundY(x, z);
                            return { x: x + 0.5, z: z + 0.5, y: groundY + 0.1 };
                        }
                    }
                }
            }
            
            // 后备：使用原始目标位置，确保在水面以上且不在方块内
            const groundY = Math.max(getGroundY(tx, tz), getTerrainHeight(tx, tz) + 1, WATER_LEVEL + 2);
            return { x: tx + 0.5, z: tz + 0.5, y: groundY + 0.2 };
        }
        
        // 检查传送位置是否安全（不在水下、不在方块内、有空间站立）
        function isTeleportPosSafe(x, z) {
            // 检查地形高度是否在水面以上
            const terrainH = getTerrainHeight(x, z);
            if (terrainH < WATER_LEVEL + 1) return false;
            
            // 检查地面方块是否存在（允许树方块，玩家可站在树旁）
            const groundY = getGroundY(x, z);
            const groundBlockY = Math.floor(groundY) - 1;
            const groundKey = `${x},${groundBlockY},${z}`;
            if (!blocksMap.has(groundKey)) {
                // 地面方块不存在，用后备高度
                const fallbackY = getTerrainHeight(x, z) + 1;
                if (fallbackY < WATER_LEVEL + 1) return false;
            }
            
            // 检查玩家头顶是否有空间（至少2格高）
            const startCheckY = Math.floor(groundY) + 1;
            for (let y = startCheckY; y < startCheckY + 2; y++) {
                const key = `${x},${y},${z}`;
                if (blocksMap.has(key) && isBlockSolid(key) && !treeBlocks.has(key)) {
                    return false;  // 头顶有实心方块
                }
            }
            
            return true;
        }
        
        // === 世界地图系统 ===
        function toggleWorldMap() {
            const overlay = document.getElementById('world-map-overlay');
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
                // 关闭地图：恢复游戏状态并重新锁定鼠标
                gameActive = true;
                controls.lock();
            } else {
                overlay.style.display = 'flex';
                renderWorldMap();
                if (gameActive) {
                    gameActive = false;
                    controls.unlock();
                }
            }
        }
        
        function renderWorldMap() {
            const container = document.getElementById('map-container');
            container.innerHTML = '';
            
            // 地图范围：-180 到 180（容纳所有城市坐标）
            const mapRange = 420;
            const containerRect = container.getBoundingClientRect();
            const width = containerRect.width || 750;
            const height = containerRect.height || 700;
            
            // 玩家位置标记（带标签）
            const playerPos = getPlayerPos();
            const playerX = (playerPos.x + mapRange) / (mapRange * 2) * width;
            const playerY = (playerPos.z + mapRange) / (mapRange * 2) * height;
            const playerMarker = document.createElement('div');
            playerMarker.className = 'map-player-marker';
            playerMarker.style.left = playerX + 'px';
            playerMarker.style.top = playerY + 'px';
            playerMarker.title = `玩家位置 (${Math.round(playerPos.x)}, ${Math.round(playerPos.z)})`;
            playerMarker.innerHTML = `<span style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:10px;color:#fff;background:rgba(255,68,68,0.9);padding:2px 6px;border-radius:3px;white-space:nowrap;border:1px solid #fff;">📍 玩家 (${Math.round(playerPos.x)}, ${Math.round(playerPos.z)})</span>`;
            container.appendChild(playerMarker);
            
            // 出生点/复活点标记（可传送）
            const spawnX_val = (spawnX + mapRange) / (mapRange * 2) * width;
            const spawnY_val = (spawnZ + mapRange) / (mapRange * 2) * height;
            const spawnDot = document.createElement('div');
            spawnDot.className = 'map-dot';
            spawnDot.style.left = spawnX_val + 'px';
            spawnDot.style.top = spawnY_val + 'px';
            spawnDot.style.background = '#00ff00';
            spawnDot.style.width = '30px';
            spawnDot.style.height = '30px';
            spawnDot.style.fontSize = '14px';
            spawnDot.innerHTML = '🏠<span class="dot-label">出生点 (chū shēng diǎn)</span>';
            spawnDot.title = '出生点/复活点 (chū shēng diǎn)（点击传送）';
            spawnDot.addEventListener('click', () => {
                teleportToSpawn();
            });
            container.appendChild(spawnDot);
            
            // 城市/出生点标记
            CITY_TELEPORTS.forEach(city => {
                const unlocked = cityTeleportUnlocked.has(city.name);
                const marker = cityTeleportMarkers.find(m => m.city.name === city.name);
                if (!marker) return;
                
                const x = (marker.city.x + mapRange) / (mapRange * 2) * width;
                const y = (marker.city.z + mapRange) / (mapRange * 2) * height;
                
                const dot = document.createElement('div');
                dot.className = 'map-dot' + (unlocked ? '' : ' locked');
                
                // 检查是否是当前位置
                const isCurrent = Math.hypot(playerPos.x - marker.city.x, playerPos.z - marker.city.z) < 5;
                if (isCurrent) dot.classList.add('current');
                
                dot.style.left = x + 'px';
                dot.style.top = y + 'px';
                dot.style.background = '#' + city.color.toString(16).padStart(6, '0');
                dot.innerHTML = `${city.icon}<span class="dot-label">${city.name} (${city.pinyin})</span>`;
                dot.title = `${city.name} ${city.pinyin}${unlocked ? '' : ' (未解锁)'}`;
                
                if (unlocked && !isCurrent) {
                    dot.addEventListener('click', () => {
                        teleportToCity(city.name);
                    });
                }
                
                container.appendChild(dot);
            });
            
            // 添加副本传送门标记
            if (dungeonPortals.length > 0) {
                dungeonPortals.forEach(p => {
                    const x = (p.entrance.x + mapRange) / (mapRange * 2) * width;
                    const y = (p.entrance.z + mapRange) / (mapRange * 2) * height;
                    
                    const dot = document.createElement('div');
                    dot.className = 'map-dot';
                    dot.style.left = x + 'px';
                    dot.style.top = y + 'px';
                    dot.style.background = '#' + p.entrance.color.toString(16).padStart(6, '0');
                    dot.style.width = '25px';
                    dot.style.height = '25px';
                    dot.style.fontSize = '12px';
                    dot.innerHTML = '⚔️<span class="dot-label">' + p.entrance.name + '</span>';
                    dot.title = p.entrance.name + ' (fù běn rù kǒu)';
                    container.appendChild(dot);
                });
            }
        }
        
        // N 键打开/关闭世界地图（地图打开时 gameActive 为 false，需检查 overlay 状态）
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyN') {
                const overlay = document.getElementById('world-map-overlay');
                const isOpen = overlay && overlay.style.display === 'flex';
                if (isOpen || gameActive) {
                    toggleWorldMap();
                }
            }
        });

        function selectSlot(index) {
            if (index < 0 || index >= hotbarItems.length) return;
            const item = hotbarItems[index];
            
            // 未合成的装备不能切换
            if (!isItemAvailable(item)) {
                showStatus(`❌ ${item.name} 未合成！请到工作台合成`);
                return;
            }
            
            selectedBlockIndex = index;
            const slots = document.querySelectorAll('.hotbar-slot');
            slots.forEach((s, i) => {
                if (i === index) s.classList.add('active');
                else s.classList.remove('active');
            });
            // 仅滚动快捷栏容器内部（不用 scrollIntoView，避免页面整体滚动导致鼠标锁定失效）
            const hbContainer = document.getElementById('hotbar-container');
            if (hbContainer && slots[index]) {
                const slot = slots[index];
                const slotLeft = slot.offsetLeft;
                const slotRight = slotLeft + slot.offsetWidth;
                const viewLeft = hbContainer.scrollLeft;
                const viewRight = viewLeft + hbContainer.clientWidth;
                if (slotLeft < viewLeft) hbContainer.scrollLeft = Math.max(0, slotLeft - 5);
                else if (slotRight > viewRight) hbContainer.scrollLeft = slotRight - hbContainer.clientWidth + 5;
            }
            document.getElementById('block-val').innerHTML = withPinyin(item.name);
            updateHandItem();
        }

        // === 合成系统 ===
        const RECIPE_LIST = [
            { name: '木板 (mù bǎn)',      result: 'planks', cost: { wood: 1 }, can: () => inventory.wood >= 1 },
            { name: '木棍 (mù gùn)',      result: 'sticks', cost: { planks: 2 }, can: () => inventory.planks >= 2 },
            { name: '圆石 (yuán shí)',    result: 'cobble', cost: { stone: 1 }, can: () => inventory.stone >= 1 },
            { name: '锄头 (chú tóu)',     result: 'hoe', cost: { planks: 2, sticks: 2 }, can: () => inventory.planks >= 2 && inventory.sticks >= 2 && !inventory.hoe },
            { name: '工作台 (gōng zuò tái)', result: 'table', cost: { planks: 4 }, can: () => inventory.planks >= 4 },
            { name: '木剑 (mù jiàn)',     result: 'swordW', cost: { planks: 2, sticks: 1 }, can: () => inventory.planks >= 2 && inventory.sticks >= 1 && !inventory.swordW },
            { name: '木镐 (mù gǬ)',      result: 'pickW', cost: { planks: 3, sticks: 2 }, can: () => inventory.planks >= 3 && inventory.sticks >= 2 && !inventory.pickW },
            { name: '木斧 (mù fǔ)',       result: 'axeW', cost: { planks: 3, sticks: 2 }, can: () => inventory.planks >= 3 && inventory.sticks >= 2 && !inventory.axeW },
            { name: '石剑 (shí jiàn)',    result: 'swordS', cost: { cobble: 3, sticks: 2 }, can: () => inventory.cobble >= 3 && inventory.sticks >= 2 && !inventory.swordS },
            { name: '石镐 (shí gǎo)',     result: 'pickS', cost: { cobble: 3, sticks: 2 }, can: () => inventory.cobble >= 3 && inventory.sticks >= 2 && !inventory.pickS },
            { name: '石斧 (shí fǔ)',      result: 'axeS', cost: { cobble: 3, sticks: 2 }, can: () => inventory.cobble >= 3 && inventory.sticks >= 2 && !inventory.axeS },
            { name: '石砖 (shí zhuān)',   result: 'sbrick', cost: { cobble: 4 }, can: () => inventory.cobble >= 4 },
            { name: '红砖 (hóng zhuān)',  result: 'brick', cost: { cobble: 2 }, can: () => inventory.cobble >= 2 },
            { name: '铁剑 (tiě jiàn)',    result: 'swordI', cost: { iron: 3, sticks: 2 }, can: () => inventory.iron >= 3 && inventory.sticks >= 2 && !inventory.swordI },
            { name: '铁镐 (tiě gǎo)',     result: 'pickI', cost: { iron: 3, sticks: 2 }, can: () => inventory.iron >= 3 && inventory.sticks >= 2 && !inventory.pickI },
            { name: '铁斧 (tiě fǔ)',      result: 'axeI', cost: { iron: 3, sticks: 2 }, can: () => inventory.iron >= 3 && inventory.sticks >= 2 && !inventory.axeI },
            { name: '盾牌 (dùn pái)',     result: 'shield', cost: { planks: 6, iron: 1 }, can: () => inventory.planks >= 6 && inventory.iron >= 1 && !inventory.shield },
            { name: '铁胸甲 (tiě xiōng jiǎ)', result: 'armorChest', cost: { iron: 8 }, can: () => inventory.iron >= 8 && !inventory.armorChest },
            { name: '铁护腿 (tiě hù tuǐ)',  result: 'armorLegs', cost: { iron: 7 }, can: () => inventory.iron >= 7 && !inventory.armorLegs },
            { name: '铁靴子 (tiě xuē zi)',  result: 'armorBoots', cost: { iron: 4 }, can: () => inventory.iron >= 4 && !inventory.armorBoots },
            { name: '黑曜石 (hēi yào shí)', result: 'obsidian', cost: { stone: 4 }, can: () => inventory.stone >= 4 },
        ];

        let craftingOpen = false;

        // 更新库存显示（热栏工作台数量 + 装备锁定状态）
        function updateInventoryDisplay() {
            const container = document.getElementById('hotbar-container');
            if (!container) return;
            
            hotbarItems.forEach((item, index) => {
                const slot = container.children[index];
                if (!slot) return;
                
                const available = isItemAvailable(item);
                const count = getItemCount(item);
                
                // 更新锁定状态
                if (available) {
                    slot.classList.remove('locked');
                } else {
                    slot.classList.add('locked');
                }
                
                // 更新图标
                const icon = slot.querySelector('.block-icon');
                if (icon) {
                    if (item.icon) {
                        icon.innerText = available ? item.icon : '🔒';
                        icon.style.backgroundColor = available ? 'rgba(180,160,80,0.6)' : 'rgba(80,80,80,0.4)';
                    } else {
                        icon.style.backgroundColor = available ? '#' + item.color.toString(16).padStart(6, '0') : '#333333';
                        icon.style.opacity = available ? '1' : '0.4';
                    }
                }
                
                // 更新名称
                const nameLabel = slot.querySelector('.slot-name');
                if (nameLabel) {
                    nameLabel.innerText = available ? item.name : '🔒' + item.name;
                    nameLabel.style.color = available ? '#ddd' : '#666';
                }
                
                // 更新数量
                let countLabel = slot.querySelector('.slot-count');
                if (count > 0) {
                    if (!countLabel) {
                        countLabel = document.createElement('span');
                        countLabel.className = 'slot-count';
                        slot.appendChild(countLabel);
                    }
                    countLabel.innerText = '×' + count;
                } else {
                    if (countLabel) countLabel.remove();
                }
                
                // 更新键位标签
                const keyLabel = slot.querySelector('.slot-key');
                if (keyLabel) {
                    keyLabel.style.opacity = available ? '0.8' : '0.3';
                }
            });
        }

        // === 角色面板 ===
        function toggleCharacterPanel() {
            const panel = document.getElementById('character-panel-overlay');
            if (panel.style.display === 'none' || panel.style.display === '') {
                panel.style.display = 'block';
                if (gameActive) {
                    gameActive = false;
                    controls.unlock();
                }
            } else {
                panel.style.display = 'none';
                if (gameActive) controls.lock();
            }
        }
        
        // 关闭角色面板
        document.getElementById('close-character-panel').addEventListener('click', toggleCharacterPanel);
        
        // 按 B 键打开角色面板
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyB' && gameActive) {
                toggleCharacterPanel();
            }
        });
        
        // === 玩家属性面板 ===
        function togglePlayerStats() {
            const panel = document.getElementById('player-stats-overlay');
            if (panel.style.display === 'none' || panel.style.display === '') {
                panel.style.display = 'block';
                renderPlayerStats();
                if (gameActive) {
                    gameActive = false;
                    controls.unlock();
                }
            } else {
                panel.style.display = 'none';
                // 关闭面板：恢复游戏状态并重新锁定鼠标
                gameActive = true;
                controls.lock();
            }
        }
        
        // 关闭玩家属性面板
        document.getElementById('close-player-stats').addEventListener('click', togglePlayerStats);
        
        // 按 P 键打开玩家属性面板
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP' && gameActive) {
                togglePlayerStats();
            }
            // 按 M 键打开城市传送面板
            if (e.code === 'KeyM' && gameActive) {
                toggleCityTeleport();
            }

            // ESC 关闭面板
            if (e.code === 'Escape') {
                // 关闭存档面板
                const saveOverlay = document.getElementById('save-panel-overlay');
                if (saveOverlay.style.display === 'flex') {
                    saveOverlay.style.display = 'none';
                    if (gameActive) controls.lock();
                    return;
                }
                // 关闭城市传送面板
                const teleportOverlay = document.getElementById('city-teleport-overlay');
                if (teleportOverlay.style.display === 'flex') {
                    teleportOverlay.style.display = 'none';
                    if (gameActive) controls.lock();
                }
            }
        });
        
        // 渲染玩家属性
        function renderPlayerStats() {
            // 生命/饥饿
            const healthPct = (health / maxHealth) * 100;
            const hungerPct = (hunger / maxHunger) * 100;
            document.getElementById('stats-health-text').textContent = `${health}/${maxHealth}`;
            document.getElementById('stats-health-bar').style.width = `${healthPct}%`;
            document.getElementById('stats-hunger-text').textContent = `${hunger}/${maxHunger}`;
            document.getElementById('stats-hunger-bar').style.width = `${hungerPct}%`;
            
            // 装备
            const equipEl = document.getElementById('stats-equipment');
            equipEl.innerHTML = '';
            const equipments = [
                { name: '锄头', key: 'hoe', icon: '⚒️', owned: inventory.hoe },
                { name: '木剑', key: 'swordW', icon: '⚔️', owned: inventory.swordW },
                { name: '石剑', key: 'swordS', icon: '⚔️', owned: inventory.swordS },
                { name: '铁剑', key: 'swordI', icon: '⚔️', owned: inventory.swordI },
                { name: '木镐', key: 'pickW', icon: '⛏️', owned: inventory.pickW },
                { name: '石镐', key: 'pickS', icon: '⛏️', owned: inventory.pickS },
                { name: '铁镐', key: 'pickI', icon: '⛏️', owned: inventory.pickI },
                { name: '木斧', key: 'axeW', icon: '🪓', owned: inventory.axeW },
                { name: '石斧', key: 'axeS', icon: '🪓', owned: inventory.axeS },
                { name: '铁斧', key: 'axeI', icon: '🪓', owned: inventory.axeI },
                { name: '盾牌', key: 'shield', icon: '🛡️', owned: inventory.shield },
                { name: '手枪', key: 'pistol', icon: '🔫', owned: inventory.pistol },
                { name: '步枪', key: 'rifle', icon: '🎯', owned: inventory.rifle },
                { name: '狙击枪', key: 'sniper', icon: '🔭', owned: inventory.sniper },
                { name: '坦克', key: 'tank', icon: '⚙️', owned: inventory.tank },
                { name: '火把', key: 'torch', icon: '🔥', owned: inventory.torch > 0 },
                { name: '铁胸甲', key: 'armorChest', icon: '🦺', owned: inventory.armorChest },
                { name: '铁护腿', key: 'armorLegs', icon: '👖', owned: inventory.armorLegs },
                { name: '铁靴子', key: 'armorBoots', icon: '🥾', owned: inventory.armorBoots },
            ];
            equipments.forEach(eq => {
                const div = document.createElement('div');
                div.style.cssText = `background:${eq.owned ? '#445' : '#333'};padding:8px;border-radius:4px;border:1px solid ${eq.owned ? '#888' : '#555'};text-align:center;`;
                div.innerHTML = `<span style="font-size:20px">${eq.icon}</span><br><span style="font-size:12px;color:${eq.owned ? '#ff5' : '#888'}">${withPinyin(eq.name)}</span><br><span style="font-size:11px;color:#aaa">${withPinyin(eq.owned ? '已装备' : '未获得')}</span>`;
                equipEl.appendChild(div);
            });
            
            // 物品栏
            const invEl = document.getElementById('stats-inventory');
            invEl.innerHTML = '';
            const inventoryItems = [
                { name: '原木', count: inventory.wood || 0, icon: '🪵' },
                { name: '木板', count: inventory.planks || 0, icon: '🟫' },
                { name: '木棍', count: inventory.sticks || 0, icon: '📏' },
                { name: '石头', count: inventory.stone || 0, icon: '🪨' },
                { name: '圆石', count: inventory.cobble || 0, icon: '⚫' },
                { name: '铁', count: inventory.iron || 0, icon: '⚙️' },
                { name: '煤', count: inventory.coal || 0, icon: '⬛' },
                { name: '沙子', count: inventory.sand || 0, icon: '🟨' },
                { name: '工作台', count: inventory.table || 0, icon: '📋' },
                { name: '石砖', count: inventory.sbrick || 0, icon: '🧱' },
                { name: '红砖', count: inventory.brick || 0, icon: '🧱' },
                { name: '玻璃', count: inventory.glass || 0, icon: '🔲' },
                { name: '黑曜石', count: inventory.obsidian || 0, icon: '⚫' },
                { name: '雪', count: inventory.snow || 0, icon: '❄️' },
                { name: '火把', count: inventory.torch || 0, icon: '🔥' },
                { name: '泥土', count: inventory.dirt || 0, icon: '🟤' },
                { name: '种子', count: inventory.seeds || 0, icon: '🌱' },
                { name: '麦子', count: inventory.wheat || 0, icon: '🌾' },
                { name: '铁胸甲', count: inventory.armorChest ? 1 : 0, icon: '🦺' },
                { name: '铁护腿', count: inventory.armorLegs ? 1 : 0, icon: '👖' },
                { name: '铁靴子', count: inventory.armorBoots ? 1 : 0, icon: '🥾' },
            ];
            inventoryItems.forEach(item => {
                const div = document.createElement('div');
                div.style.cssText = `background:#222;padding:6px;border-radius:4px;text-align:center;font-size:12px;`;
                div.innerHTML = `<span style="font-size:16px">${item.icon}</span><br>${withPinyin(item.name)}<br><b style="color:#ff5">×${item.count}</b>`;
                invEl.appendChild(div);
            });
            
            // 仓库（武器和工具）
            const warehouseEl = document.getElementById('stats-warehouse');
            warehouseEl.innerHTML = '';
            const warehouseItems = [
                { name: '木剑', owned: !!inventory.swordW, icon: '⚔️', dmg: '4' },
                { name: '石剑', owned: !!inventory.swordS, icon: '⚔️', dmg: '6' },
                { name: '铁剑', owned: !!inventory.swordI, icon: '⚔️', dmg: '10' },
                { name: '木镐', owned: !!inventory.pickW, icon: '⛏️', dmg: '3' },
                { name: '石镐', owned: !!inventory.pickS, icon: '⛏️', dmg: '5' },
                { name: '铁镐', owned: !!inventory.pickI, icon: '⛏️', dmg: '8' },
                { name: '木斧', owned: !!inventory.axeW, icon: '🪓', dmg: '3' },
                { name: '石斧', owned: !!inventory.axeS, icon: '🪓', dmg: '5' },
                { name: '铁斧', owned: !!inventory.axeI, icon: '🪓', dmg: '7' },
                { name: '木锄', owned: !!inventory.hoe, icon: '⚒️', dmg: '1' },
                { name: '盾牌', owned: !!inventory.shield, icon: '🛡️', dmg: '0' },
                { name: '手枪', owned: !!inventory.pistol, icon: '🔫', dmg: '8' },
                { name: '步枪', owned: !!inventory.rifle, icon: '🎯', dmg: '14' },
                { name: '狙击枪', owned: !!inventory.sniper, icon: '🔭', dmg: '22' },
                { name: '坦克', owned: !!inventory.tank, icon: '⚙️', dmg: '30' },
            ];
            warehouseItems.forEach(item => {
                const div = document.createElement('div');
                div.style.cssText = `background:${item.owned ? '#2a3a2a' : '#222'};padding:6px;border-radius:4px;text-align:center;font-size:12px;border:1px solid ${item.owned ? '#5a5' : '#444'};`;
                div.innerHTML = `<span style="font-size:16px;opacity:${item.owned ? 1 : 0.3}">${item.icon}</span><br>${withPinyin(item.name)}<br><b style="color:${item.owned ? '#5f5' : '#666'}">${withPinyin(item.owned ? '已拥有' : '未拥有')}</b><br><span style="font-size:10px;color:#aaa">${withPinyin('伤害')}: ${item.dmg}</span>`;
                warehouseEl.appendChild(div);
            });
            
            // 当前选中
            const current = hotbarItems[selectedBlockIndex];
            document.getElementById('stats-current').innerHTML = `
                <span style="font-size:20px">${current.icon || ''}</span>
                <span style="margin-left:10px;font-size:14px">${withPinyin(current.name || '方块')}</span>
                <span style="color:#aaa;margin-left:10px;font-size:12px">(按1-9/滚轮切换)</span>
            `;
            
            // 状态
            const isDay = gameTime > 30 && gameTime < 330;
            const statusEl = document.getElementById('stats-status');
            statusEl.innerHTML = `
                🌤️ ${withPinyin('时间')}：${isDay ? '☀️' + withPinyin('白天') : '🌙' + withPinyin('夜晚')} (${gameTime.toFixed(0)})<br>
                🌍 ${withPinyin('坐标')}：(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
                🎮 ${withPinyin('模式')}：${flying ? '✈️' + withPinyin('飞行') : '🚶' + withPinyin('行走')}<br>
                📡 ${withPinyin('天气')}：${weatherType || withPinyin('晴朗')}<br>
                💾 ${withPinyin('存档')}：${withPinyin('已自动保存')}
            `;
        }
        
        // === 夜晚技能系统 ===
        // 检测是否是夜晚
        function isNight() {
            return gameTime > 12000 && gameTime < 24000;
        }
        
        // 执行怪物夜晚技能
        function executeNightAbility(mob) {
            if (!isNight()) return;
            if (!mob.type.nightAbility) return;
            // 玩家飞行时无法被攻击
            if (flying) return;
            
            const playerPos = getPlayerPos();
            const mobPos = mob.mesh.position;
            const dist = Math.sqrt(
                (mobPos.x - playerPos.x) ** 2 + 
                (mobPos.z - playerPos.z) ** 2
            );
            
            switch (mob.type.nightAbility) {
                case 'explode':
                    if (dist < 3 && Math.random() < 0.02) {
                        takeDamage(8);
                        playSound('square', 100, 0.3);
                        showStatus('💥 苦力怕自爆了！');
                        mob.alive = false;
                        scene.remove(mob.mesh);
                        mobs.splice(mobs.indexOf(mob), 1);
                    }
                    break;
                case 'heal':
                    if (Math.random() < 0.01) {
                        mobs.forEach(m => {
                            if (m !== mob && m.type.name === '僵尸' && m.alive) {
                                m.hp = Math.min(m.maxHp, m.hp + 2);
                                updateHealthBar(m.healthBar, m.hp);
                            }
                        });
                        showStatus('💚 僵尸群体治疗！');
                    }
                    break;
                case 'panic':
                    mob.panicSpeed = mob.type.speed * 2;
                    break;
                case 'shoot':
                    if (dist < 15 && Math.random() < 0.005) {
                        takeDamage(2);
                        playSound('square', 800, 0.1);
                        showStatus('🏹 骷髅射箭！');
                    }
                    break;
                case 'climb':
                    mob.canClimb = true;
                    break;
                case 'teleport':
                    if (dist < 10 && dist > 2 && Math.random() < 0.003) {
                        mobPos.x = playerPos.x + (Math.random() - 0.5) * 2;
                        mobPos.z = playerPos.z + (Math.random() - 0.5) * 2;
                        takeDamage(3);
                        showStatus('✨ 末影人瞬移！');
                        playSound('sine', 400, 0.2);
                    }
                    break;
                case 'speed':
                    mob.speedBoost = 2;
                    break;
                case 'bellow':
                    if (dist < 10 && Math.random() < 0.002) {
                        mobs.forEach(m => {
                            if (m.alive && m.type.hostile) {
                                const mDist = Math.sqrt(
                                    (mobPos.x - m.mesh.position.x) ** 2 + 
                                    (mobPos.z - m.mesh.position.z) ** 2
                                );
                                if (mDist < 15) {
                                    m.stunTimer = 2.0;
                                }
                            }
                        });
                        showStatus('🐮 牛吼退怪物！');
                        playSound('sawtooth', 200, 0.3);
                    }
                    break;
                case 'flee':
                    mob.fleeSpeed = mob.type.speed * 1.5;
                    break;
                case 'fly':
                    if (Math.random() < 0.01) {
                        mob.flying = true;
                        mob.flyTimer = 3.0;
                    }
                    break;
                case 'sonar':
                    if (dist < 8 && Math.random() < 0.01) {
                        showStatus('🦇 蝙蝠发现你了！');
                        playSound('sine', 1200, 0.1);
                    }
                    break;
                case 'bless':
                    if (dist < 15 && Math.random() < 0.005) {
                        health = Math.min(maxHealth, health + 1);
                        hunger = Math.min(maxHunger, hunger + 1);
                        updateVitalsUI();
                        showStatus('🙏 奶奶的祝福！');
                    }
                    break;
                case 'shield':
                    if (dist < 15 && Math.random() < 0.003) {
                        playerShield = true;
                        playerShieldTimer = 5.0;
                        showStatus('🛡️ 爷爷的护盾！');
                        playSound('sine', 600, 0.2);
                    }
                    break;
            }
        }
        
        // 玩家护盾
        let playerShield = false;
        let playerShieldTimer = 0;
        
        // === 图形化合成系统 ===
        // 合成格子状态 (9格)
        let craftGrid = new Array(9).fill(null);
        // 每个格子: { type: 'wood', count: 1 } 或 null
        
        // 材料配置
        const MATERIALS = [
            // 基础材料（采集获得）
            { key: 'wood', name: '原木', pinyin: 'yuán mù', icon: '🪵', get: () => inventory.wood || 0 },
            { key: 'stone', name: '石头', pinyin: 'shí tou', icon: '🪨', get: () => inventory.stone || 0 },
            { key: 'iron', name: '铁', pinyin: 'tiě', icon: '⚙️', get: () => inventory.iron || 0 },
            { key: 'coal', name: '煤', pinyin: 'méi', icon: '⬛', get: () => inventory.coal || 0 },
            { key: 'sand', name: '沙子', pinyin: 'shā zi', icon: '🟨', get: () => inventory.sand || 0 },
            { key: 'snow', name: '雪', pinyin: 'xuě', icon: '❄️', get: () => inventory.snow || 0 },
            // 合成物品（可再次放入合成台）
            { key: 'planks', name: '木板', pinyin: 'mù bǎn', icon: '🟫', get: () => inventory.planks || 0 },
            { key: 'sticks', name: '木棍', pinyin: 'mù gùn', icon: '📏', get: () => inventory.sticks || 0 },
            { key: 'cobble', name: '圆石', pinyin: 'yuán shí', icon: '⚫', get: () => inventory.cobble || 0 },
            { key: 'sbrick', name: '石砖', pinyin: 'shí zhuān', icon: '🧱', get: () => inventory.sbrick || 0 },
            { key: 'brick', name: '红砖', pinyin: 'hóng zhuān', icon: '🟥', get: () => inventory.brick || 0 },
            { key: 'glass', name: '玻璃', pinyin: 'bō li', icon: '🔲', get: () => inventory.glass || 0 },
            { key: 'obsidian', name: '黑曜石', pinyin: 'hēi yào shí', icon: '⚫', get: () => inventory.obsidian || 0 },
            { key: 'torch', name: '火把', pinyin: 'huǒ bǎ', icon: '🔥', get: () => inventory.torch || 0 },
            { key: 'snowblock', name: '雪块', pinyin: 'xuě kuài', icon: '🌨️', get: () => inventory.snowblock || 0 },
            { key: 'fence', name: '栅栏', pinyin: 'zhà lán', icon: '🚧', get: () => inventory.fence || 0 },
            { key: 'ladder', name: '梯子', pinyin: 'tī zi', icon: '🪜', get: () => inventory.ladder || 0 },
            { key: 'plate', name: '压力板', pinyin: 'yā lì bǎn', icon: '🔲', get: () => inventory.plate || 0 },
            { key: 'trapdoor', name: '活板门', pinyin: 'huó bǎn mén', icon: '🚪', get: () => inventory.trapdoor || 0 },
            { key: 'bucket', name: '桶', pinyin: 'tǒng', icon: '🪣', get: () => inventory.bucket || 0 },
            { key: 'ironblock', name: '铁块', pinyin: 'tiě kuài', icon: '⚙️', get: () => inventory.ironblock || 0 },
            { key: 'stoneblock', name: '石头块', pinyin: 'shí tou kuài', icon: '🪨', get: () => inventory.stoneblock || 0 },
            { key: 'seeds', name: '种子', pinyin: 'zhǒng zi', icon: '🌱', get: () => inventory.seeds || 0 },
            { key: 'wheat', name: '麦子', pinyin: 'mài zi', icon: '🌾', get: () => inventory.wheat || 0 },
            { key: 'shield', name: '盾牌', pinyin: 'dùn pái', icon: '🛡️', get: () => inventory.shield ? 1 : 0 },
            { key: 'irondoor', name: '铁门', pinyin: 'tiě mén', icon: '🚪', get: () => inventory.irondoor || 0 },
        ];
        
        // 配方名称拼音映射（用于朗读和显示）
        const RECIPE_PINYIN = {
            '木板': 'mù bǎn', '木棍': 'mù gùn', '工作台': 'gōng zuò tái',
            '木剑': 'mù jiàn', '石剑': 'shí jiàn', '铁剑': 'tiě jiàn',
            '手枪': 'shǒu qiāng', '步枪': 'bù qiāng', '狙击枪': 'jū jī qiāng', '坦克': 'tǎn kě',
            '木镐': 'mù gǎo', '石镐': 'shí gǎo', '铁镐': 'tiě gǎo',
            '木斧': 'mù fǔ', '石斧': 'shí fǔ', '铁斧': 'tiě fǔ',
            '木锄': 'mù chú', '石锄': 'shí chú', '铁锄': 'tiě chú',
            '石砖': 'shí zhuān', '红砖': 'hóng zhuān', '玻璃': 'bō li',
            '黑曜石': 'hēi yào shí', '雪块': 'xuě kuài', '栅栏': 'zhà lán',
            '梯子': 'tī zi', '压力板': 'yā lì bǎn', '活板门': 'huó bǎn mén',
            '桶': 'tǒng', '木桶': 'mù tǒng', '铁块': 'tiě kuài', '石头块': 'shí tou kuài',
            '火把': 'huǒ bǎ', '盾牌': 'dùn pái', '铁门': 'tiě mén',
        };
        
        // 合成配方（3x3网格模式，指定材料类型）
        // pattern: [[materialType|null, materialType|null, ...], ...] 3行3列
        const CRAFT_RECIPES = [
            // 木板：1原木 → 4木板
            { pattern: [[null,'wood',null],[null,null,null],[null,null,null]], result: 'planks', count: 4, name: '木板', icon: '🟫' },
            // 工作台：4木板 → 1工作台（必须在木棍前面，避免匹配错误）
            { pattern: [['planks','planks',null],['planks','planks',null],[null,null,null]], result: 'table', count: 1, name: '工作台', icon: '📋' },
            // 木桶：3木板竖排 → 1木桶（必须在木棍前面，3木板包含2木板的情况）
            { pattern: [[null,'planks',null],[null,'planks',null],[null,'planks',null]], result: 'woodbucket', count: 1, name: '木桶', icon: '🪣' },
            // 木棍：2木板竖排 → 4木棍
            { pattern: [[null,'planks',null],[null,'planks',null],[null,null,null]], result: 'sticks', count: 4, name: '木棍', icon: '📏' },
            // 木剑：2木板+1木棍 → 1木剑
            { pattern: [[null,'planks',null],[null,'planks',null],[null,'sticks',null]], result: 'swordW', count: 1, name: '木剑', icon: '⚔️', tool: true },
            // 木镐：3木板+2木棍 → 1木镐
            { pattern: [['planks','planks','planks'],[null,'sticks','sticks'],[null,null,null]], result: 'pickW', count: 1, name: '木镐', icon: '⛏️', tool: true },
            // 木斧：3木板+2木棍 → 1木斧
            { pattern: [['planks','planks',null],['planks','sticks',null],[null,'sticks',null]], result: 'axeW', count: 1, name: '木斧', icon: '🪓', tool: true },
            // 木锄：2木板+2木棍 → 1木锄
            { pattern: [['planks','planks',null],['sticks','sticks',null],[null,'sticks',null]], result: 'hoe', count: 1, name: '木锄', icon: '⚒️', tool: true },
            // 石剑：2圆石+2木棍 → 1石剑
            { pattern: [[null,'cobble',null],[null,'cobble',null],[null,'sticks',null]], result: 'swordS', count: 1, name: '石剑', icon: '⚔️', tool: true },
            // 石镐：3圆石+2木棍 → 1石镐
            { pattern: [['cobble','cobble','cobble'],[null,'sticks','sticks'],[null,null,null]], result: 'pickS', count: 1, name: '石镐', icon: '⛏️', tool: true },
            // 石斧：3圆石+2木棍 → 1石斧
            { pattern: [['cobble','cobble',null],['cobble','sticks',null],[null,'sticks',null]], result: 'axeS', count: 1, name: '石斧', icon: '🪓', tool: true },
            // 石锄：2圆石+2木棍 → 1石锄
            { pattern: [['cobble','cobble',null],['sticks','sticks',null],[null,'sticks',null]], result: 'hoe', count: 1, name: '石锄', icon: '⚒️', tool: true },
            // 石砖：4圆石 → 4石砖
            { pattern: [['cobble','cobble',null],['cobble','cobble',null],[null,null,null]], result: 'sbrick', count: 4, name: '石砖', icon: '🧱' },
            // 红砖：2圆石 → 4红砖
            { pattern: [['cobble',null,null],['cobble',null,null],[null,null,null]], result: 'brick', count: 4, name: '红砖', icon: '🧱' },
            // 铁剑：2铁+2木棍 → 1铁剑
            { pattern: [[null,'iron',null],[null,'iron',null],[null,'sticks',null]], result: 'swordI', count: 1, name: '铁剑', icon: '⚔️', tool: true },
            // 铁镐：3铁+2木棍 → 1铁镐
            { pattern: [['iron','iron','iron'],[null,'sticks','sticks'],[null,null,null]], result: 'pickI', count: 1, name: '铁镐', icon: '⛏️', tool: true },
            // 铁斧：3铁+2木棍 → 1铁斧
            { pattern: [['iron','iron',null],['iron','sticks',null],[null,'sticks',null]], result: 'axeI', count: 1, name: '铁斧', icon: '🪓', tool: true },
            // 铁锄：2铁+2木棍 → 1铁锄
            { pattern: [['iron','iron',null],['sticks','sticks',null],[null,'sticks',null]], result: 'hoe', count: 1, name: '铁锄', icon: '⚒️', tool: true },
            // 盾牌：6木板+1铁 → 1盾牌
            { pattern: [['planks','planks','planks'],['planks','iron','planks'],[null,null,null]], result: 'shield', count: 1, name: '盾牌', icon: '🛡️', tool: true },
            // === 铁盔甲 ===
            // 铁胸甲：8铁 → 1铁胸甲
            { pattern: [['iron','iron','iron'],[null,'iron','iron'],[null,'iron','iron']], result: 'armorChest', count: 1, name: '铁胸甲', icon: '🦺', tool: true },
            // 铁护腿：7铁 → 1铁护腿
            { pattern: [['iron','iron','iron'],['iron',null,'iron'],['iron',null,'iron']], result: 'armorLegs', count: 1, name: '铁护腿', icon: '👖', tool: true },
            // 铁靴子：4铁 → 1铁靴子
            { pattern: [['iron','iron',null],['iron','iron',null],[null,null,null]], result: 'armorBoots', count: 1, name: '铁靴子', icon: '🥾', tool: true },
            // === 热武器配方 ===
            // 手枪：2铁+1煤+1木棍 → 1手枪
            { pattern: [['iron','iron',null],[null,'coal',null],[null,'sticks',null]], result: 'pistol', count: 1, name: '手枪', icon: '🔫', tool: true },
            // 步枪：2铁+1煤+2木棍 → 1步枪
            { pattern: [['iron','iron','coal'],[null,'sticks',null],[null,'sticks',null]], result: 'rifle', count: 1, name: '步枪', icon: '🎯', tool: true },
            // 狙击枪：3铁+2煤+1木棍 → 1狙击枪
            { pattern: [['iron','iron','iron'],[null,'coal','coal'],[null,'sticks',null]], result: 'sniper', count: 1, name: '狙击枪', icon: '🔭', tool: true },
            // 坦克：3铁块+3煤+3铁 → 1坦克
            { pattern: [['ironblock','ironblock','ironblock'],['coal','coal','coal'],['iron','iron','iron']], result: 'tank', count: 1, name: '坦克', icon: '⚙️', tool: true },
            // 玻璃：4沙子 → 4玻璃
            { pattern: [['sand','sand',null],['sand','sand',null],[null,null,null]], result: 'glass', count: 4, name: '玻璃', icon: '🔲' },
            // 黑曜石：8石头 → 1黑曜石
            { pattern: [['stone','stone','stone'],['stone','stone','stone'],['stone','stone',null]], result: 'obsidian', count: 1, name: '黑曜石', icon: '⚫' },
            // 火把：1煤+1木棍 → 4火把
            { pattern: [[null,'coal',null],[null,'sticks',null],[null,null,null]], result: 'torch', count: 4, name: '火把', icon: '🔥' },
            // 雪块：4雪 → 1雪块
            { pattern: [['snow','snow',null],['snow','snow',null],[null,null,null]], result: 'snow', count: 1, name: '雪块', icon: '❄️' },
            // 栅栏：6木板+2木棍 → 6栅栏
            { pattern: [[null,'planks','planks',null],[null,'planks','planks',null],[null,'sticks','sticks',null]], result: 'fence', count: 6, name: '栅栏', icon: '🚧' },
            // 梯子：7木棍 → 4梯子
            { pattern: [['sticks',null,'sticks'],['sticks',null,'sticks'],['sticks',null,'sticks']], result: 'ladder', count: 4, name: '梯子', icon: '🪜' },
            // 桶：3铁 → 1桶
            { pattern: [['iron',null,'iron'],[null,'iron',null],[null,null,null]], result: 'bucket', count: 1, name: '桶', icon: '🪣' },
            // 铁块：9铁 → 1铁块
            { pattern: [['iron','iron','iron'],['iron','iron','iron'],['iron','iron','iron']], result: 'ironblock', count: 1, name: '铁块', icon: '⚙️' },
            // 石头块：9石头 → 1石头块
            { pattern: [['stone','stone','stone'],['stone','stone','stone'],['stone','stone','stone']], result: 'stoneblock', count: 1, name: '石头块', icon: '🪨' },
            // 金块：9金 → 1金块（需要金锭）
            // 钻石块：9钻石 → 1钻石块（需要钻石）

            // 压力板：2木板 → 2压力板
            { pattern: [['planks','planks',null],[null,null,null],[null,null,null]], result: 'pressureplate', count: 2, name: '压力板', icon: '⬜' },
            // 活板门：6木板 → 6活板门
            { pattern: [['planks','planks','planks'],['planks','planks','planks'],[null,null,null]], result: 'trapdoor', count: 6, name: '活板门', icon: '🚪' },
            // 铁门：6铁 → 1铁门
            { pattern: [['iron','iron',null],['iron','iron',null],['iron','iron',null]], result: 'irondoor', count: 1, name: '铁门', icon: '🚪' },
        ];
        
        // 拖拽状态
        let dragData = null;
        let dragFromSlot = null;
        
        function toggleCrafting() {
            craftingOpen = !craftingOpen;
            const overlay = document.getElementById('crafting-overlay');
            if (craftingOpen) {
                overlay.classList.add('visible');
                renderCrafting();
                // 打开面板：暂停游戏并解锁鼠标
                if (gameActive) {
                    gameActive = false;
                    controls.unlock();
                }
            } else {
                overlay.classList.remove('visible');
                // 关闭面板：恢复游戏状态并重新锁定鼠标
                gameActive = true;
                if (!fallbackMode) controls.lock();
                // 清空合成格子
                craftGrid = new Array(9).fill(null);
            }
        }
        
        function renderCrafting() {
            // 渲染材料栏
            const matBar = document.getElementById('materials-bar');
            matBar.innerHTML = '';
            MATERIALS.forEach(mat => {
                const count = mat.get();
                const el = document.createElement('div');
                el.className = 'mat-item' + (count <= 0 ? ' empty' : '');
                // 显示拼音
                const pinyinHtml = mat.pinyin ? `<span class="mat-pinyin">${mat.pinyin}</span>` : '';
                el.innerHTML = `<span class="icon">${mat.icon}</span><span>${mat.name}${pinyinHtml}</span><span class="count">×${count}</span>`;
                el.draggable = count > 0;
                // 添加提示框（含拼音）
                const titleText = mat.pinyin ? `${mat.name}（${mat.pinyin}）` : mat.name;
                el.title = `${mat.icon} ${titleText} ×${count}`;
                el.addEventListener('mouseenter', (e) => {
                    showTooltip(e, `${mat.icon} ${titleText}`, `库存：×${count}`);
                    // TTS朗读（中文名+拼音）
                    if (mat.pinyin) speakText(`${mat.name}，${mat.pinyin}`, 0.9);
                    else speakText(mat.name, 0.9);
                });
                el.addEventListener('mousemove', (e) => {
                    moveTooltip(e);
                });
                el.addEventListener('mouseleave', () => {
                    hideTooltip();
                    stopSpeaking();
                });
                el.addEventListener('dragstart', (e) => {
                    dragData = { type: mat.key, fromInv: true };
                    dragFromSlot = null;
                    el.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });
                el.addEventListener('dragend', () => {
                    el.classList.remove('dragging');
                    dragData = null;
                });
                matBar.appendChild(el);
            });
            
            // 渲染合成格子
            renderCraftGrid();
            
            // 渲染输出
            renderCraftOutput();
            
            // 渲染提示
            renderRecipeHints();
            
            // 渲染配方列表
            renderRecipeList();
        }
        
        // 提示框控制
        const matTooltip = document.getElementById('mat-tooltip');
        
        function showTooltip(e, title, desc) {
            matTooltip.innerHTML = `<span class="tip-name">${title}</span><br><span class="tip-count">${desc}</span>`;
            matTooltip.style.display = 'block';
            moveTooltip(e);
        }
        
        function moveTooltip(e) {
            matTooltip.style.left = (e.clientX + 10) + 'px';
            matTooltip.style.top = (e.clientY + 10) + 'px';
        }
        
        function hideTooltip() {
            matTooltip.style.display = 'none';
        }
        
        // 渲染配方列表
        function renderRecipeList() {
            const container = document.getElementById('recipe-list-grid');
            if (!container) return;
            container.innerHTML = '';
            
            // 配方分类
            const categories = [
                { name: '🌲 基础材料', pinyin: 'jī chǔ cái liào', items: ['木板','木棍','工作台'] },
                { name: '⚔️ 武器', pinyin: 'wǔ qì', items: ['木剑','石剑','铁剑'] },
                { name: '🔫 热武器', pinyin: 'rè wǔ qì', items: ['手枪','步枪','狙击枪','坦克'] },
                { name: '🛠️ 工具', pinyin: 'gōng jù', items: ['木镐','石镐','铁镐','木斧','石斧','铁斧','木锄','石锄','铁锄'] },
                { name: '🧱 建筑材料', pinyin: 'jiàn zào cái liào', items: ['石砖','红砖','玻璃','黑曜石','雪块','栅栏','梯子','压力板','活板门'] },
                { name: '🪣 容器', pinyin: 'róng qì', items: ['桶','木桶','铁块','石头块'] },
                { name: '🔥 其他', pinyin: 'qí tā', items: ['火把','盾牌','铁门'] },
            ];
            
            categories.forEach(cat => {
                const catEl = document.createElement('div');
                catEl.className = 'recipe-category';
                const catPinyin = cat.pinyin ? ` <span class="cat-pinyin">(${cat.pinyin})</span>` : '';
                catEl.innerHTML = cat.name + catPinyin;
                container.appendChild(catEl);
                
                cat.items.forEach(itemName => {
                    const recipe = CRAFT_RECIPES.find(r => r.name === itemName);
                    if (!recipe) return;
                    
                    const el = document.createElement('div');
                    el.className = 'recipe-item';
                    const pinyin = RECIPE_PINYIN[itemName] || '';
                    
                    // 计算材料
                    const materials = [];
                    const counts = {};
                    for (let r = 0; r < 3; r++) {
                        for (let c = 0; c < 3; c++) {
                            const m = recipe.pattern[r][c];
                            if (m) {
                                counts[m] = (counts[m] || 0) + 1;
                            }
                        }
                    }
                    const matStr = Object.entries(counts).map(([k,v]) => {
                        const mat = MATERIALS.find(m => m.key === k);
                        return mat ? `${mat.icon}${mat.name}×${v}` : k;
                    }).join(', ');
                    
                    el.innerHTML = `
                        <div class="recipe-icon">${recipe.icon}</div>
                        <div class="recipe-name">${recipe.name}${pinyin ? ` <span class="recipe-pinyin">(${pinyin})</span>` : ''}</div>
                        <div class="recipe-count">×${recipe.count}</div>
                        <div class="recipe-materials">${matStr}</div>
                    `;
                    
                    // 鼠标悬停朗读
                    el.addEventListener('mouseenter', () => {
                        if (pinyin) speakText(`${recipe.name}，${pinyin}`, 0.9);
                        else speakText(recipe.name, 0.9);
                    });
                    
                    // 点击自动填充（检查库存是否足够）
                    el.addEventListener('click', () => {
                        // 计算所需材料
                        const needed = {};
                        for (let r = 0; r < 3; r++) {
                            for (let c = 0; c < 3; c++) {
                                const m = recipe.pattern[r][c];
                                if (m) needed[m] = (needed[m] || 0) + 1;
                            }
                        }
                        // 检查库存
                        let canCraft = true;
                        for (const [mat, cnt] of Object.entries(needed)) {
                            if ((inventory[mat] || 0) < cnt) { canCraft = false; break; }
                        }
                        if (!canCraft) {
                            showStatus('❌ 材料不足，无法合成！');
                            return;
                        }
                        // 清空网格
                        craftGrid = new Array(9).fill(null);
                        // 填充配方（库存只在合成时扣除）
                        for (let r = 0; r < 3; r++) {
                            for (let c = 0; c < 3; c++) {
                                const m = recipe.pattern[r][c];
                                if (m) {
                                    craftGrid[r * 3 + c] = { type: m, count: 1 };
                                }
                            }
                        }
                        renderCrafting();
                    });
                    
                    container.appendChild(el);
                });
            });
        }
        
        function renderCraftGrid() {
            for (let i = 0; i < 9; i++) {
                const slot = document.querySelector(`.craft-slot[data-slot="${i}"]`);
                if (!slot) continue;
                const item = craftGrid[i];
                if (item) {
                    const mat = MATERIALS.find(m => m.key === item.type);
                    slot.innerHTML = `<span>${mat ? mat.icon : '?'}</span><span class="count">×${item.count}</span>`;
                    slot.classList.add('filled');
                    // 添加提示框
                    slot.title = `${mat ? mat.icon : '?'} ${mat ? mat.name : '?'} ×${item.count}`;
                    slot.onmouseenter = (e) => {
                        showTooltip(e, `${mat ? mat.icon : '?'} ${mat ? mat.name : '?'}`, `数量：×${item.count}`);
                    };
                    slot.onmousemove = (e) => {
                        moveTooltip(e);
                    };
                    slot.onmouseleave = () => {
                        hideTooltip();
                    };
                } else {
                    slot.innerHTML = '';
                    slot.classList.remove('filled');
                    slot.title = '';
                    slot.onmouseenter = null;
                    slot.onmousemove = null;
                    slot.onmouseleave = null;
                }
            }
        }
        
        function renderCraftOutput() {
            const output = document.getElementById('craft-output');
            const recipe = matchRecipe();
            if (recipe) {
                const pinyin = RECIPE_PINYIN[recipe.name] || '';
                const displayName = pinyin ? `${recipe.name}（${pinyin}）` : recipe.name;
                output.innerHTML = `<span>${recipe.icon}</span>`;
                output.classList.add('has-item');
                // 添加提示框
                output.title = `点击合成 ${displayName} ×${recipe.count}`;
                output.onmouseenter = (e) => {
                    showTooltip(e, `${recipe.icon} ${displayName}`, `合成：×${recipe.count}`);
                    // TTS朗读
                    if (pinyin) speakText(`${recipe.name}，${pinyin}`, 0.9);
                    else speakText(recipe.name, 0.9);
                };
                output.onmousemove = (e) => {
                    moveTooltip(e);
                };
                output.onmouseleave = () => {
                    hideTooltip();
                    stopSpeaking();
                };
            } else {
                output.innerHTML = '';
                output.classList.remove('has-item');
                output.title = '无合成结果';
                output.onmouseenter = null;
                output.onmousemove = null;
                output.onmouseleave = null;
            }
        }
        
        function renderRecipeHints() {
            const hints = document.getElementById('recipe-hints');
            const recipe = matchRecipe();
            if (recipe) {
                hints.innerHTML = `<b>可以合成：${recipe.name} ×${recipe.count}</b><br>点击右侧输出格合成！`;
            } else {
                hints.innerHTML = '提示：拖拽材料到格子<br>例：<b>原木</b>放中间 → 合成<b>木板</b><br><b>2木板</b>竖排 → 合成<b>木棍</b>';
            }
        }
        
        // 匹配合成配方（检查材料类型和位置，允许额外材料在空格中）
        function matchRecipe() {
            for (const recipe of CRAFT_RECIPES) {
                const p = recipe.pattern;
                let match = true;
                // 检查每个格子
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const idx = r * 3 + c;
                        const expected = p[r][c]; // null 或 'wood' 等材料类型
                        const actual = craftGrid[idx];
                        // 如果期望有材料，格子必须有该类型材料
                        if (expected !== null) {
                            if (!actual || actual.type !== expected || actual.count <= 0) {
                                match = false;
                                break;
                            }
                        } else {
                            // 如果期望空格，格子必须为空（防止子集匹配导致错误合成）
                            if (actual && actual.count > 0) {
                                match = false;
                                break;
                            }
                        }
                    }
                    if (!match) break;
                }
                if (match) {
                    return recipe;
                }
            }
            return null;
        }
        
        // 从格子移除材料
        function removeFromGrid(slotIdx, returnToInv) {
            const item = craftGrid[slotIdx];
            craftGrid[slotIdx] = null;
            if (item && returnToInv) {
                inventory[item.type] = (inventory[item.type] || 0) + item.count;
            }
            return item;
        }
        
        // 合成
        function craftFromGrid() {
            const recipe = matchRecipe();
            if (!recipe) return;
            
            // 播放合成音效
            playCraftSound();
            
            // 消耗格子中的所有材料：从库存中扣除
            for (let i = 0; i < 9; i++) {
                if (craftGrid[i]) {
                    const item = craftGrid[i];
                    inventory[item.type] = Math.max(0, (inventory[item.type] || 0) - item.count);
                    craftGrid[i] = null;
                }
            }
            
            // 给予结果
            const resultKey = recipe.result;
            if (recipe.tool) {
                inventory[resultKey] = true;
            } else if (resultKey === 'torch') {
                inventory.torch = (inventory.torch || 0) + recipe.count;
            } else {
                inventory[resultKey] = (inventory[resultKey] || 0) + recipe.count;
            }
            
            showStatus(`✨ 合成了 ${recipe.name} ×${recipe.count}!`);
            
            // 更新热栏显示（装备解锁、数量变化）
            updateInventoryDisplay();
            
            // 自动选中新物品
            const toolResults = ['tank','sniper','rifle','pistol','shield','axeI','axeS','axeW','pickI','pickS','pickW','swordI','swordS','swordW','hoe'];
            const toolIdx = toolResults.indexOf(resultKey);
            if (toolIdx >= 0) {
                selectSlot(hotbarItems.length - 1 - toolIdx);
            }
            
            renderCrafting();
        }
        
        // 计算可合成的最大数量
        function getMaxCraftCount(recipe) {
            if (!recipe) return 0;
            // 计算每种材料每组需要的数量
            const materialCounts = {};
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const m = recipe.pattern[r][c];
                    if (m) {
                        materialCounts[m] = (materialCounts[m] || 0) + 1;
                    }
                }
            }
            
            // 计算每种材料在格子中的数量
            const inGrid = {};
            for (let i = 0; i < 9; i++) {
                if (craftGrid[i]) {
                    inGrid[craftGrid[i].type] = (inGrid[craftGrid[i].type] || 0) + craftGrid[i].count;
                }
            }
            
            let maxCount = Infinity;
            for (const [matKey, needed] of Object.entries(materialCounts)) {
                const inInv = (inventory[matKey] || 0);
                const inGr = (inGrid[matKey] || 0);
                const total = inInv + inGr;
                maxCount = Math.min(maxCount, Math.floor(total / needed));
            }
            return maxCount === Infinity ? 0 : maxCount;
        }
        
        // 批量合成
        function batchCraft(count) {
            const recipe = matchRecipe();
            if (!recipe) return;
            
            const maxCount = getMaxCraftCount(recipe);
            const actualCount = Math.min(count, maxCount);
            if (actualCount <= 0) {
                showStatus('❌ 材料不足！');
                return;
            }
            
            // 播放合成音效
            playCraftSound();
            
            // 消耗材料：批量合成需要 actualCount 组材料
            // 先计算每组需要的材料
            const matPerSet = {};
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const m = recipe.pattern[r][c];
                    if (m) matPerSet[m] = (matPerSet[m] || 0) + 1;
                }
            }
            // 从库存扣除 actualCount 组材料
            for (const [matKey, needed] of Object.entries(matPerSet)) {
                inventory[matKey] = Math.max(0, (inventory[matKey] || 0) - actualCount * needed);
            }
            // 清空格子
            for (let i = 0; i < 9; i++) {
                craftGrid[i] = null;
            }
            
            // 给予结果（批量）
            const resultKey = recipe.result;
            const totalCount = recipe.count * actualCount;
            if (recipe.tool) {
                inventory[resultKey] = true; // 工具只能合成1个
                showStatus(`✨ 合成了 ${recipe.name} ×${actualCount} (工具只保留1个)!`);
            } else if (resultKey === 'torch') {
                inventory.torch = (inventory.torch || 0) + totalCount;
                showStatus(`✨ 合成了 ${recipe.name} ×${totalCount}!`);
            } else {
                inventory[resultKey] = (inventory[resultKey] || 0) + totalCount;
                showStatus(`✨ 合成了 ${recipe.name} ×${totalCount}!`);
            }
            
            // 自动选中新物品
            const toolResults = ['tank','sniper','rifle','pistol','shield','axeI','axeS','axeW','pickI','pickS','pickW','swordI','swordS','swordW','hoe'];
            const toolIdx = toolResults.indexOf(resultKey);
            if (toolIdx >= 0) {
                selectSlot(hotbarItems.length - 1 - toolIdx);
            }
            
            renderCrafting();
        }
        
        // 自动填充配方到网格
        function autoFillRecipe(recipe) {
            if (!recipe) return;
            
            // 检查是否有足够材料
            const materialCounts = {};
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const m = recipe.pattern[r][c];
                    if (m) {
                        materialCounts[m] = (materialCounts[m] || 0) + 1;
                    }
                }
            }
            
            for (const [matKey, needed] of Object.entries(materialCounts)) {
                const have = (inventory[matKey] || 0);
                if (have < needed) {
                    showStatus(`❌ 材料不足：${matKey} ×${needed} (只有 ${have})`);
                    return;
                }
            }
            
            // 清空网格（库存只在合成时扣除）
            craftGrid = new Array(9).fill(null);
            // 填充配方
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const m = recipe.pattern[r][c];
                    if (m) {
                        craftGrid[r * 3 + c] = { type: m, count: 1 };
                    }
                }
            }
            renderCrafting();
            showStatus(`📦 已填充配方：${recipe.name}`);
        }
        
        // 设置格子（拖入材料）
        function setCraftSlot(slotIdx, type, count) {
            // 先移除原有并退回库存
            removeFromGrid(slotIdx, true);
            craftGrid[slotIdx] = { type: type, count: count };
            renderCraftGrid();
            renderCraftOutput();
            renderRecipeHints();
        }
        
        // 初始化合成格子拖拽事件
        function initCraftGridEvents() {
            const slots = document.querySelectorAll('.craft-slot');
            slots.forEach((slot, idx) => {
                // 拖拽放入
                slot.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (!dragData) return;
                    // 从库存拖入
                    if (dragData.fromInv) {
                        const count = dragData.count || 1;
                        setCraftSlot(idx, dragData.type, count);
                        renderCrafting();
                    } else if (dragData.fromSlot !== undefined) {
                        // 从格子拖到格子
                        if (dragData.fromSlot !== idx) {
                            const item = removeFromGrid(dragData.fromSlot);
                            if (item) {
                                setCraftSlot(idx, item.type, item.count);
                            }
                            renderCrafting();
                        }
                    }
                });
                // 点击移除（退回库存）
                slot.addEventListener('click', () => {
                    if (craftGrid[idx]) {
                        removeFromGrid(idx, true);
                        renderCrafting();
                    }
                });
                // 拖拽开始（从格子拖出）
                slot.addEventListener('dragstart', (e) => {
                    if (craftGrid[idx]) {
                        dragData = { type: craftGrid[idx].type, fromSlot: idx, count: craftGrid[idx].count };
                        dragFromSlot = idx;
                        e.dataTransfer.effectAllowed = 'move';
                    }
                });
                slot.addEventListener('dragend', () => {
                    dragData = null;
                    dragFromSlot = null;
                });
            });
            
            // 输出格子点击合成
            const output = document.getElementById('craft-output');
            output.addEventListener('click', () => {
                craftFromGrid();
            });
            
            // 批量合成按钮
            const btnCraftOne = document.getElementById('btn-craft-one');
            if (btnCraftOne) {
                btnCraftOne.addEventListener('click', () => {
                    batchCraft(1);
                });
            }
            
            const btnCraftMax = document.getElementById('btn-craft-max');
            if (btnCraftMax) {
                btnCraftMax.addEventListener('click', () => {
                    const recipe = matchRecipe();
                    if (recipe) {
                        const maxCount = getMaxCraftCount(recipe);
                        batchCraft(maxCount);
                    }
                });
            }
            
            // 分解按钮：将合成结果分解回原材料
            const btnDeconstruct = document.getElementById('btn-craft-deconstruct');
            if (btnDeconstruct) {
                btnDeconstruct.addEventListener('click', () => {
                    deconstructItem(1);
                });
            }
            
            // 全部分解按钮
            const btnDeconstructMax = document.getElementById('btn-craft-deconstruct-max');
            if (btnDeconstructMax) {
                btnDeconstructMax.addEventListener('click', () => {
                    deconstructAll();
                });
            }
        }
        
        // 分解合成结果回原材料（从库存中分解）
        function deconstructItem(count) {
            count = count || 1;
            // 查找库存中可分解的合成配方
            const deconstructibleItems = [];
            for (const recipe of CRAFT_RECIPES) {
                const resultKey = recipe.result;
                let haveResult = 0;
                if (recipe.tool) {
                    haveResult = inventory[resultKey] ? 1 : 0;
                } else {
                    haveResult = inventory[resultKey] || 0;
                }
                if (haveResult > 0) {
                    deconstructibleItems.push({ recipe, haveResult });
                }
            }
            
            if (deconstructibleItems.length === 0) {
                showStatus('❌ 库存中没有可分解的合成物品！');
                return;
            }
            
            // 取第一个可分解的物品
            const item = deconstructibleItems[0];
            const recipe = item.recipe;
            const resultKey = recipe.result;
            const actualCount = Math.min(count, item.haveResult);
            
            // 分解 actualCount 个
            if (recipe.tool) {
                if (actualCount >= 1) inventory[resultKey] = false;
            } else {
                inventory[resultKey] = Math.max(0, (inventory[resultKey] || 0) - actualCount);
            }
            
            // 返还原材料 × actualCount
            const materials = {};
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const m = recipe.pattern[r][c];
                    if (m) {
                        materials[m] = (materials[m] || 0) + 1;
                    }
                }
            }
            const matNames = [];
            for (const [matKey, count] of Object.entries(materials)) {
                const total = count * actualCount;
                inventory[matKey] = (inventory[matKey] || 0) + total;
                const mat = MATERIALS.find(m => m.key === matKey);
                matNames.push(`${mat ? mat.icon + mat.name : matKey}×${total}`);
            }
            
            playBreakSound();
            showStatus(`🔄 分解了 ${recipe.name} ×${actualCount} → ${matNames.join(', ')}`);
            renderCrafting();
            updateInventoryDisplay();
        }
        
        // 全部分解：分解库存中所有可分解物品
        function deconstructAll() {
            const deconstructibleItems = [];
            for (const recipe of CRAFT_RECIPES) {
                const resultKey = recipe.result;
                let haveResult = 0;
                if (recipe.tool) {
                    haveResult = inventory[resultKey] ? 1 : 0;
                } else {
                    haveResult = inventory[resultKey] || 0;
                }
                if (haveResult > 0) {
                    deconstructibleItems.push({ recipe, haveResult });
                }
            }
            
            if (deconstructibleItems.length === 0) {
                showStatus('❌ 库存中没有可分解的合成物品！');
                return;
            }
            
            let totalDeconstructed = 0;
            const allMaterials = {};
            
            for (const item of deconstructibleItems) {
                const recipe = item.recipe;
                const resultKey = recipe.result;
                const count = item.haveResult;
                
                // 扣除物品
                if (recipe.tool) {
                    inventory[resultKey] = false;
                } else {
                    inventory[resultKey] = 0;
                }
                totalDeconstructed += count;
                
                // 累计返还材料
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const m = recipe.pattern[r][c];
                        if (m) {
                            allMaterials[m] = (allMaterials[m] || 0) + 1;
                        }
                    }
                }
            }
            
            // 返还所有材料（每种材料 × 对应物品数量）
            const matNames = [];
            for (const item of deconstructibleItems) {
                const recipe = item.recipe;
                const count = item.haveResult;
                const materials = {};
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const m = recipe.pattern[r][c];
                        if (m) {
                            materials[m] = (materials[m] || 0) + 1;
                        }
                    }
                }
                for (const [matKey, matCount] of Object.entries(materials)) {
                    const total = matCount * count;
                    inventory[matKey] = (inventory[matKey] || 0) + total;
                    const mat = MATERIALS.find(m => m.key === matKey);
                    matNames.push(`${mat ? mat.icon + mat.name : matKey}×${total}`);
                }
            }
            
            playBreakSound();
            playCraftSound();
            showStatus(`🔄 全部分解！共分解 ${totalDeconstructed} 个物品 → ${matNames.join(', ')}`);
            renderCrafting();
            updateInventoryDisplay();
        }

        // 创建星空
        function createStarField() {
            const starGeometry = new THREE.BufferGeometry();
            const starCount = 2000;
            const positions = new Float32Array(starCount * 3);
            const sizes = new Float32Array(starCount);
            const colors = new Float32Array(starCount * 3);
            
            for (let i = 0; i < starCount; i++) {
                // 随机分布在天空中
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI * 0.5; // 只在上半球
                const radius = 300 + Math.random() * 100;
                
                positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = radius * Math.cos(phi);
                positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
                
                // 随机大小
                sizes[i] = 0.5 + Math.random() * 2.0;
                
                // 随机颜色（白色、蓝色、黄色）
                const colorChoice = Math.random();
                if (colorChoice < 0.6) {
                    colors[i * 3] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0; // 白色
                } else if (colorChoice < 0.8) {
                    colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0; // 蓝色
                } else if (colorChoice < 0.95) {
                    colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 0.8; // 黄色
                } else {
                    colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 0.7; // 橙色
                }
            }
            
            starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const starMaterial = new THREE.PointsMaterial({
                size: 1.5,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            starField = new THREE.Points(starGeometry, starMaterial);
            starField.visible = false; // 初始不显示
            scene.add(starField);
        }

        // 🌸 环境粒子系统（萤火虫 / 花瓣 / 光点）—— 让游戏场景更生动，吸引小学生
        let envFireflies = null, envPetals = null, envSparkles = null;
        function createEnvironmentParticles() {
            // === 萤火虫（夜晚显示，黄绿色发光漂浮）===
            const ffCount = 40;
            const ffGeo = new THREE.BufferGeometry();
            const ffPos = new Float32Array(ffCount * 3);
            const ffCol = new Float32Array(ffCount * 3);
            for (let i = 0; i < ffCount; i++) {
                ffPos[i * 3] = (Math.random() - 0.5) * 60;
                ffPos[i * 3 + 1] = 2 + Math.random() * 8;
                ffPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
                // 黄绿色
                const brightness = 0.7 + Math.random() * 0.3;
                ffCol[i * 3] = 0.6 * brightness;
                ffCol[i * 3 + 1] = 1.0 * brightness;
                ffCol[i * 3 + 2] = 0.2 * brightness;
            }
            ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
            ffGeo.setAttribute('color', new THREE.BufferAttribute(ffCol, 3));
            const ffMat = new THREE.PointsMaterial({
                size: 0.3, vertexColors: true, transparent: true, opacity: 0.9,
                sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false
            });
            envFireflies = new THREE.Points(ffGeo, ffMat);
            envFireflies.visible = false;
            scene.add(envFireflies);

            // === 花瓣（白天显示，粉色飘落）===
            const petalCount = 30;
            const petalGeo = new THREE.BufferGeometry();
            const petalPos = new Float32Array(petalCount * 3);
            const petalCol = new Float32Array(petalCount * 3);
            for (let i = 0; i < petalCount; i++) {
                petalPos[i * 3] = (Math.random() - 0.5) * 50;
                petalPos[i * 3 + 1] = 10 + Math.random() * 15;
                petalPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
                // 粉色
                const r = 0.9 + Math.random() * 0.1;
                const g = 0.5 + Math.random() * 0.2;
                const b = 0.7 + Math.random() * 0.1;
                petalCol[i * 3] = r;
                petalCol[i * 3 + 1] = g;
                petalCol[i * 3 + 2] = b;
            }
            petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
            petalGeo.setAttribute('color', new THREE.BufferAttribute(petalCol, 3));
            const petalMat = new THREE.PointsMaterial({
                size: 0.15, vertexColors: true, transparent: true, opacity: 0.85,
                sizeAttenuation: true, depthWrite: false
            });
            envPetals = new THREE.Points(petalGeo, petalMat);
            envPetals.visible = true;
            scene.add(envPetals);

            // === 光点（白天微光，白色闪烁）===
            const sparkCount = 20;
            const sparkGeo = new THREE.BufferGeometry();
            const sparkPos = new Float32Array(sparkCount * 3);
            const sparkCol = new Float32Array(sparkCount * 3);
            for (let i = 0; i < sparkCount; i++) {
                sparkPos[i * 3] = (Math.random() - 0.5) * 40;
                sparkPos[i * 3 + 1] = 1 + Math.random() * 10;
                sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
                sparkCol[i * 3] = 1.0; sparkCol[i * 3 + 1] = 1.0; sparkCol[i * 3 + 2] = 1.0;
            }
            sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
            sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
            const sparkMat = new THREE.PointsMaterial({
                size: 0.2, vertexColors: true, transparent: true, opacity: 0.6,
                sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false
            });
            envSparkles = new THREE.Points(sparkGeo, sparkMat);
            envSparkles.visible = true;
            scene.add(envSparkles);
        }

        // 更新环境粒子（在 animate 中每帧调用）
        function updateEnvironmentParticles(delta) {
            const isDay = isDaytime();
            // 每2帧更新一次，减少CPU负担
            if (Math.floor(gameTime * 60) % 2 !== 0) return;
            
            if (envFireflies) {
                envFireflies.visible = !isDay;
                if (!isDay) {
                    const pos = envFireflies.geometry.attributes.position.array;
                    for (let i = 0; i < pos.length / 3; i++) {
                        pos[i * 3] += Math.sin(gameTime * 0.5 + i) * 0.005;
                        pos[i * 3 + 1] += Math.cos(gameTime * 0.3 + i * 0.7) * 0.003;
                        pos[i * 3 + 2] += Math.sin(gameTime * 0.4 + i * 1.3) * 0.005;
                    }
                    envFireflies.material.opacity = 0.5 + Math.sin(gameTime * 2) * 0.4;
                    envFireflies.geometry.attributes.position.needsUpdate = true;
                }
            }
            if (envPetals) {
                envPetals.visible = isDay;
                if (isDay) {
                    const pos = envPetals.geometry.attributes.position.array;
                    for (let i = 0; i < pos.length / 3; i++) {
                        pos[i * 3] += Math.sin(gameTime * 0.8 + i) * 0.01;
                        pos[i * 3 + 1] -= 0.008 + Math.sin(gameTime + i * 0.5) * 0.003;
                        pos[i * 3 + 2] += Math.cos(gameTime * 0.6 + i * 0.9) * 0.01;
                        if (pos[i * 3 + 1] < 1) {
                            pos[i * 3] = (Math.random() - 0.5) * 50;
                            pos[i * 3 + 1] = 15 + Math.random() * 10;
                            pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
                        }
                    }
                    envPetals.geometry.attributes.position.needsUpdate = true;
                }
            }
            if (envSparkles) {
                envSparkles.visible = isDay;
                if (isDay) {
                    const pos = envSparkles.geometry.attributes.position.array;
                    for (let i = 0; i < pos.length / 3; i++) {
                        pos[i * 3] += Math.sin(gameTime * 1.2 + i * 0.3) * 0.008;
                        pos[i * 3 + 1] += Math.cos(gameTime * 0.9 + i * 0.7) * 0.006;
                        pos[i * 3 + 2] += Math.sin(gameTime * 0.7 + i * 1.1) * 0.008;
                    }
                    envSparkles.material.opacity = 0.3 + Math.sin(gameTime * 3) * 0.3;
                    envSparkles.geometry.attributes.position.needsUpdate = true;
                }
            }
        }

        // 2. 初始化 Three.js 场景、相机、渲染器及控制
        let _sunLight = null, _hemiLight = null, _sunGlow = null, _moonGlow = null;
        function initThree() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87ceeb); // 天空蓝
            scene.fog = new THREE.FogExp2(0x87ceeb, 0.010); // 降低雾浓度，看得更远

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

            // 半球光：天空色（蓝）从上方照射，地面色（暖棕）从下方反射，比 AmbientLight 更自然
            _hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x6b4423, 0.6);
            scene.add(_hemiLight);

            // 方向光（太阳/月光），随昼夜动态变化颜色和强度
            _sunLight = new THREE.DirectionalLight(0xfff5e0, 0.8);
            _sunLight.position.set(30, 50, 20);
            scene.add(_sunLight);

            // 太阳（白天显示，发光体 + 光晕）
            const sunGeo = new THREE.SphereGeometry(10, 32, 32);
            const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff7aa });
            sunMesh = new THREE.Mesh(sunGeo, sunMat);
            sunMesh.position.set(100, 80, -50);
            scene.add(sunMesh);
            // 太阳光晕（半透明大球）
            const glowGeo = new THREE.SphereGeometry(22, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
            _sunGlow = new THREE.Mesh(glowGeo, glowMat);
            sunMesh.add(_sunGlow);

            // 月亮（晚上显示，自发光 + 月相阴影 + 光晕）
            const moonGeo = new THREE.SphereGeometry(8, 32, 32);
            const moonMat = new THREE.MeshBasicMaterial({ color: 0xf0f0e0 });
            moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.position.set(-100, 80, -50);
            moonMesh.visible = false;
            scene.add(moonMesh);
            // 月亮光晕
            const mGlowGeo = new THREE.SphereGeometry(16, 16, 16);
            const mGlowMat = new THREE.MeshBasicMaterial({ color: 0xaaaadd, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
            _moonGlow = new THREE.Mesh(mGlowGeo, mGlowMat);
            moonMesh.add(_moonGlow);
            
            // 星空（晚上显示）
            createStarField();

            // 🌸 环境粒子系统（萤火虫、花瓣、光点）—— 让场景更生动
            createEnvironmentParticles();

            // 云朵（阴天/雨天显示）
            const cloudMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.7 });
            const cloud1 = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 20), cloudMat);
            cloud1.position.set(-30, 60, -20);
            scene.add(cloud1);
            const cloud2 = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 15), cloudMat);
            cloud2.position.set(40, 65, -30);
            scene.add(cloud2);
            const cloud3 = new THREE.Mesh(new THREE.BoxGeometry(50, 6, 25), cloudMat);
            cloud3.position.set(0, 70, -40);
            scene.add(cloud3);
            weatherCloudMesh = new THREE.Group();
            weatherCloudMesh.add(cloud1, cloud2, cloud3);
            weatherCloudMesh.visible = false;
            scene.add(weatherCloudMesh);

            // 加载角色/怪物图片纹理
            const texLoader = new THREE.TextureLoader();
            playerTexture = texLoader.load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABXklEQVR4nO3RsU0EARAEwQsWm3CwCQebiD6BN5GW3S5pzDZGqufj6+ftPr9/307/t/3z3w7VegAA2j0AAO0eAIB2/2w5erUHAKDdAwDQ7gEAaPcApgG2HL3aAwDQ7gEAaPcAALR7ANMAW45e7QEAaPcAALR7AADaPYBpgC1Hr/YAALR7AADaPQAA7R7ANMCWo1d7AADaPQAA7R4AgHYPYBpgy9GrPQAA7R4AgHYPAEC7BzANsOXo1R4AgHYPAEC7BwCg3QOYBthy9GoPAEC7BwCg3QMA0O4BTANsOXq1BwCg3QMA0O4BAGj3AKYBthy92gMA0O4BAGj3AAC0ewDTAFuOXu0BAGj3AAC0ewAA2j2AaYAtR6/2AAC0ewAA2j0AAO0ewDTAlqNXewAA2j0AAO0eAIB2D2AaYMvRqz0AAO0eAIB2DwBAuwcwDbDl6NUeAIB2DwBAuwcAoN0DGO5fgWlGzWhRXloAAAAASUVORK5CYII=');
            
            // 纹理映射表（textureKey -> base64字符串）
            // 新增图片只需在此添加即可自动应用到怪物身上
            const TEXTURE_MAP = {
    AUNT: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAX0lEQVR4nO3PMQ0AMAzAsAIbf1wFscOqFCNI5h03OuBXA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oCGEhApvcRLJYAAAAASUVORK5CYII=',
    BAT: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAX0lEQVR4nO3PMQ0AMAzAsKIbf0gFscOqFCNI5h03OuBXA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oCvuogxB3neToAAAAASUVORK5CYII=',
    CHICKEN: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXklEQVR4nO3PMQ0AMAzAsPInvYLYYVWKESTzjhsd8KsBrQGtAa0BrQGtAa0BrQGtAa0BrQHNQa0BrQGtAa0BrQHNQa0BrQGtAa0BrQHNQa0BrQGtAa0BrQHNQa0BrQHNQa0BrQGtAa0BrQHNQa0BrQGtAa0BrQHNQa0BrQGtAa0BbQHKU9LC7/CP1AAAAABJRU5ErkJggg==',
    COW: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAe0lEQVR4nO3PUQkAIBTAwJfFLGaxfwRD+HEIgwW4zdnr64YLGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLXjsAndywLVTwJAjAAAAAElFTkSuQmCC',
    DAD: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeklEQVR4nO3PUQkAIBTAwBfOCpY0pSH8OITBAtxmn/V1w0UNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWPHYBy00xLQWX3ZQAAAAASUVORK5CYII=',
    GRANDMA: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeElEQVR4nO3PUQkAIBTAwJfWtHbSEH4cwmABbnP2+rrhgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAseu1PzEg4RAuL7AAAAAElFTkSuQmCC',
    GRANDPA: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeElEQVR4nO3PUQkAIBTAwBffLJbUEH4cwmABbrP2+brhgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAseu1L0Eg4EnRVDAAAAAElFTkSuQmCC',
    MOM: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeUlEQVR4nO3PQQkAMAzAwOqrlfn/T8QexyAQAZfZs183XNCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa01oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWjBYxe47PDiB/SGUQAAAABJRU5ErkJggg==',
    PIG: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeUlEQVR4nO3PwQkAIBDAsNt/IP9OpkP4CEKhA6Rz1v664YIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALHru8iWJKYmRi4wAAAABJRU5ErkJggg==',
    RABBIT: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAX0lEQVR4nO3PMQ0AMAzAsPLnOC4FscOqFCNI5h03OuBXA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oCxthyaEB+c4EAAAAASUVORK5CYII=',
    RUYI: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAX0lEQVR4nO3PMQ0AMAzAsPIHOwwFscOqFCNI5h03OuBXA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oCSJ2ilfXpkB0AAAAASUVORK5CYII=',
    SHEEP: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAX0lEQVR4nO3PMQ0AMAzAsPIHOwwFscOqFCNI5h03OuBXA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oCSJ2ilfXpkB0AAAAASUVORK5CYII=',
    SHUAISHU: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXklEQVR4nO3PMQ0AMAzAsMIf7ILYYVWKESTzjhsd8KsBrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQHNQa0BrQGtAa0BrQGtAa0BrQGtAa0BbQE+LIF4QHSJPwAAAABJRU5ErkJggg==',
    UNCLE: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeElEQVR4nO3PQQkAMAzAwKqd2omqiD2OQSACLnPmft1wQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAseu1L0Eg4EnRVDAAAAAElFTkSuQmCC',
};;
            
            // 纹理名称映射（textureKey -> 中文名称）
            TEXTURE_NAMES = {
                PIG: '猪',
                GRANDMA: '奶奶',
                GRANDPA: '爷爷',
                DAD: '爸爸',
                MOM: '妈妈',
                RUYI: '如意',
                AUNT: '阿姨',
                UNCLE: '叔叔',
                SHUAISHU: '帅帅',
                RABBIT: '泽宇',
                COW: '刘一凡',
                SHEEP: '妹妹',
                CHICKEN: '潘晨烨',
                BAT: '潘佳研',
                // 新增图片示例：在这里添加新的名称
                // NEWMOB: '新名字',
            };
            
            // 自动加载所有怪物纹理（全部内联 base64，file:// 下也能正常加载）
            mobTextures = {};
            Object.entries(MOB_TYPES).forEach(([key, mobType]) => {
                if (mobType.textureKey && TEXTURE_MAP[mobType.textureKey]) {
                    mobTextures[mobType.textureKey] = texLoader.load(TEXTURE_MAP[mobType.textureKey]);
                }
            });

            // 水面波浪平面（跟随玩家，ShaderMaterial 动画）
            const waterGeo = new THREE.PlaneGeometry(512, 512, 64, 64);
            waterSurface = new THREE.Mesh(waterGeo, new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 }, uColor: { value: new THREE.Color(0x3399dd) } },
                vertexShader: `
                    uniform float time;
                    varying float wave;
                    void main() {
                        vec3 p = position;
                        p.z = sin(p.x * 0.3 + time * 1.5) * 0.12
                            + cos(p.y * 0.25 + time * 1.1) * 0.1
                            + sin((p.x + p.y) * 0.15 + time * 0.8) * 0.06;
                        wave = p.z;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColor;
                    varying float wave;
                    void main() {
                        float alpha = 0.55 + wave * 0.4;
                        gl_FragColor = vec4(uColor, alpha);
                    }
                `,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
            }));
            waterSurface.rotation.x = -Math.PI / 2;
            waterSurface.position.y = WATER_LEVEL;
            scene.add(waterSurface);

            // 渲染器设置
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.getElementById('game-container').appendChild(renderer.domElement);

            // 第一人称视角控制器 PointerLockControls
            // 优先用 Three 官方控制器；若第二个 CDN 文件加载失败，退回内联实现（接口一致）
            const PLC = (typeof THREE.PointerLockControls === 'function')
                ? THREE.PointerLockControls : SimplePointerLockControls;
            controls = new PLC(camera, document.body);

            const blocker = document.getElementById('blocker');
            const startBtn = document.getElementById('start-btn');
            const fallbackHint = document.getElementById('fallback-hint');

            // 兜底模式：浏览器拒绝鼠标锁定时改用「按住鼠标拖动看视角」
            // 一旦进入就不再回退到菜单（避免 unlock 事件把玩家踢回主界面）
            function activateFallbackMode() {
                if (controls.isLocked) return;
                fallbackMode = true;
                blocker.style.display = 'none';
                gameActive = true;
                renderer.domElement.style.cursor = 'none';
                fallbackHint.style.display = 'block';
                fallbackHint.innerHTML = '拖拽模式：浏览器未授予鼠标锁定<br>按住鼠标拖动 = 转动视角<br>点击（不拖动）= 左键破坏 / 右键放置<br>WASD 移动 / Space 跳跃';
            }

            let gameStartTime = 0;
            // 点击按钮或按空格键开始游戏
            function startGame() {
                if (blocker.style.display === 'none') return; // 已经在游戏中
                ensureAudio(); // 先激活音频（利用当前用户手势）
                gameStartTime = Date.now();
                gameActive = true;
                blocker.style.display = 'none';
                renderer.domElement.style.cursor = 'auto';
                controls.lock();
                // 🎮 初始化每日任务 + 金币 UI
                refreshDailyTasks();
                updateCoinsUI();
                setTimeout(() => {
                    if (!controls.isLocked) {
                        activateFallbackMode();
                    }
                }, 1500);
            }
            
            startBtn.addEventListener('click', startGame);
            
            // 开始界面的保存/读取按钮
            const startSaveBtn = document.getElementById('start-save-btn');
            const startLoadBtn = document.getElementById('start-load-btn');
            if (startSaveBtn) {
                startSaveBtn.addEventListener('click', () => {
                    saveGame();
                    showStatus('💾 游戏已保存！');
                });
            }
            if (startLoadBtn) {
                startLoadBtn.addEventListener('click', () => {
                    if (loadGame()) {
                        showStatus('📂 存档已读取！点击"开始游戏"继续');
                    } else {
                        showStatus('❌ 没有找到存档！');
                    }
                });
            }
            
            // 空格键开始游戏
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && blocker.style.display !== 'none') {
                    e.preventDefault();
                    startGame();
                }
            });

            controls.addEventListener('lock', () => {
                fallbackMode = false; // 锁定成功则退出兜底模式
                blocker.style.display = 'none';
                gameActive = true;
                renderer.domElement.style.cursor = 'auto';
                fallbackHint.style.display = 'none';
            });

            controls.addEventListener('unlock', () => {
                // 兜底模式下忽略解锁事件（否则会被踢回菜单，表现为"进不去游戏"）
                if (fallbackMode) return;
                // 启动 2 秒内忽略 unlock（pointer lock 未授予时触发一次假 unlock，会把 gameActive 改回 false）
                if (gameStartTime > 0 && Date.now() - gameStartTime < 2000) return;
                blocker.style.display = 'flex';
                gameActive = false;
                renderer.domElement.style.cursor = 'auto';
            });

            document.addEventListener('pointerlockerror', () => {
                activateFallbackMode();
            });

            // 兜底旋转：mousedown 按住后跟随鼠标位移旋转相机
            let dragActive = false;
            let lastMouseX = 0, lastMouseY = 0;
            let dragDistance = 0; // 累计拖拽距离，用于区分"点击"与"拖拽"
            let pendingClick = null;

            renderer.domElement.addEventListener('mousedown', (e) => {
                if (!gameActive || controls.isLocked) return;
                dragActive = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                dragDistance = 0;
                pendingClick = { x: e.clientX, y: e.clientY, button: e.button };
            });

            window.addEventListener('mouseup', (e) => {
                if (dragActive && pendingClick) {
                    if (dragDistance < 6) {
                        // 兜底模式下，用点击位置更新准星，使射线从点击位置出发
                        if (fallbackMode) {
                            const rect = renderer.domElement.getBoundingClientRect();
                            mouse.x = ((pendingClick.x - rect.left) / rect.width) * 2 - 1;
                            mouse.y = -((pendingClick.y - rect.top) / rect.height) * 2 + 1;
                        }
                        onMouseDown({ button: pendingClick.button });
                    }
                }
                dragActive = false;
                pendingClick = null;
            });

            window.addEventListener('mousemove', (e) => {
                if (!dragActive) return;
                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                if (dx === 0 && dy === 0) return;
                dragDistance += Math.abs(dx) + Math.abs(dy);
                const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                euler.setFromQuaternion(camera.quaternion);
                euler.y -= dx * 0.002;
                euler.x -= dy * 0.002;
                euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
                camera.quaternion.setFromEuler(euler);
            });

            // 禁止右键菜单（右键用于放置方块）
            document.addEventListener('contextmenu', (e) => e.preventDefault());


            // 进游戏时短暂显示操作提示
            const promptEl = document.getElementById('in-game-prompt');
            function showInGamePrompt(modeText) {
                promptEl.style.display = 'block';
                promptEl.innerHTML =
                    '<b style="color:#55ff55">已进入游戏</b> ' + modeText + '<br>' +
                    '<span style="color:#ff5">W A S D</span> 移动　' +
                    '<span style="color:#ff5">Space</span> 跳/上浮　' +
                    '<span style="color:#ff5">Shift</span> 下沉/冲刺<br>' +
                    '<span style="color:#55ff55">左键</span> 破坏/攻击　' +
                    '<span style="color:#55ff55">右键</span> 放置方块<br>' +
                    '<span style="color:#ff5">F</span> 飞行　' +
                    '<span style="color:#ff5">V</span> 视角　' +
                    '<span style="color:#ff5">C</span> 磕头恢复　' +
                    '<span style="color:#ff5">1-0 / 滚轮</span> 切换<br>' +
                    '<span style="color:#55ff55;font-size:13px">找到奶奶/爷爷按C磕头可恢复生命！</span><br>' +
                    '<span style="color:#44ddff;font-size:13px">📖 走近爷爷/奶奶/泽宇自动朗读课文！</span><br>' +
                    '<span style="color:#aaa;font-size:12px">6 秒后自动消失</span>';
                if (promptEl._t) clearTimeout(promptEl._t);
                promptEl._t = setTimeout(() => { promptEl.style.display = 'none'; }, 8000);
            }

            scene.add(controls.getObject());

            // 创建第一人称手臂模型（挂载到相机上）
            createPlayerArm();

            // 创建第三人称玩家模型
            playerModel = createPlayerModel();

            // 键盘与鼠标点击监听（使用包装器，确保始终调用当前版本的 onKeyDown）
            document.addEventListener('keydown', (e) => onKeyDown(e));
            document.addEventListener('keyup', (e) => onKeyUp(e));
            document.addEventListener('mousedown', onMouseDown);
            window.addEventListener('wheel', onWheel, { passive: true });

            window.addEventListener('resize', onWindowResize);

            // 初始化方块实例网格（每个方块类型一个 InstancedMesh）
            Object.values(BLOCK_TYPES).forEach(t => {
                instancedMeshes[t.id] = createInstancedMeshFor(t);
                typeCounts[t.id] = 0;
            });
        }

        // === 方块渲染系统：InstancedMesh（同类型方块共用实例网格，大幅提升性能）===
        const boxGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

        // 每个方块类型的实例容量（UNLOAD_DIST=6 时最多 169 chunks ≈ 43264 列）
        const CAPACITIES = {
            1: 50000,  // 草地（每列1个）
            2: 200000, // 泥土（每列约4层）
            3: 400000, // 石头（每列约8-10层，最多）
            4: 8192,   // 原木（树木）
            5: 16384,  // 树叶（透明）
            6: 200000, // 沙子（沙滩/沙漠/海底）
            7: 100000, // 基岩（每列1层，减层优化）
            8: 160000, // 水（海洋填充，每列约3层）
            9: 50000,  // 雪（山顶/雪原）
            10: 4096,  // 木板（玩家放置/合成）
            11: 2048,  // 工作台（玩家放置）
            12: 1024,  // 玻璃（玩家放置）
            13: 1024,  // 红砖（玩家放置）
            14: 1024,  // 石砖（玩家放置）
            15: 50000, // 圆石（峡谷/火山）
            16: 10000, // 发光石（火山口）
            17: 50000, // 黑曜石（火山）
            18: 80000, // 铁矿石（地下矿石）
            19: 40000, // 煤矿石（地下矿石）
            20: 2048,  // 火把
            21: 1024,  // 青铜宝箱（关卡奖励）
            22: 1024,  // 白银宝箱（关卡奖励）
            23: 1024,  // 黄金宝箱（关卡奖励）
            24: 64,    // 副本宝箱
            25: 4096,  // 耕地
            26: 2048,  // 作物
            27: 16384, // 熔岩（火山口）
            28: 32768, // 冰块（冰川）
            29: 16384, // 瀑布
            30: 4096,  // 蘑菇（沼泽/雨林）
            31: 8192,  // 竹子（雨林）
            32: 8192,   // 珊瑚（浅海）
            33: 200000  // 花岗岩（深层底岩，不可挖）
        };

        // typeId -> InstancedMesh
        const instancedMeshes = {};
        // typeId -> 当前已用实例数
        const typeCounts = {};
        // typeId -> [instId] -> key（用于 swap-remove 时定位）
        const instToKey = {};

        function createInstancedMeshFor(type) {
            const material = new THREE.MeshLambertMaterial({
                color: type.color,
                transparent: !!type.transparent,
                opacity: type.opacity || 1.0,
                depthWrite: !type.transparent
            });
            const im = new THREE.InstancedMesh(boxGeometry, material, CAPACITIES[type.id]);
            im.count = 0;
            im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            im.frustumCulled = false;
            im.userData.typeId = type.id;
            // 启用逐实例颜色：每个方块有轻微色差，模拟自然纹理
            im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITIES[type.id] * 3), 3);
            im.userData.origTransparent = !!type.transparent;
            im.userData.origOpacity = type.opacity || 1.0;
            im.userData.origDepthWrite = !type.transparent;
            scene.add(im);
            return im;
        }

        // 飞行模式视觉：让方块半透明，玩家可以穿过地形
        function setFlyingVisuals(enabled) {
            const opacity = enabled ? 0.22 : undefined;
            for (const [id, im] of Object.entries(instancedMeshes)) {
                const m = im.material;
                if (enabled) {
                    m.transparent = true;
                    m.opacity = opacity;
                    m.depthWrite = false;
                } else {
                    m.transparent = im.userData.origTransparent;
                    m.opacity = im.userData.origOpacity;
                    m.depthWrite = im.userData.origDepthWrite;
                }
                m.needsUpdate = true;
            }
        }

        // 判断方块是否固体（不可穿过）
        function isSolidBlock(typeId) {
            if (typeId === undefined || typeId === null) return false;
            // 查找方块类型定义，检查 collision 标志
            const blockType = Object.values(BLOCK_TYPES).find(t => t.id === typeId);
            if (blockType && blockType.collision === false) return false;
            return true;
        }
        
        // 检查某个方块是否碰撞（树木方块不碰撞）
        function isBlockSolid(key) {
            const rec = blocksMap.get(key);
            if (!rec) return false;
            if (treeBlocks.has(key)) return false; // 树木方块不碰撞
            return isSolidBlock(rec.typeId);
        }

        // 检查玩家位置是否与固体方块碰撞
        // playerPos: 玩家中心坐标 (x, y=脚底, z)
        // playerWidth: 玩家宽度的一半 (约0.3)
        // playerHeight: 玩家高度 (1.6)
        function checkCollision(px, py, pz, halfW, height) {
            // 精确计算，不使用四舍五入（防止浮点误差导致穿模）
            const x0 = Math.floor(px - halfW), x1 = Math.floor(px + halfW);
            // 使用 py - 0.001 确保包括脚底的方块层（玩家站在方块顶面时 py = blockTop，需要检查 blockTop-1 层）
            const y0 = Math.floor(py - 0.001), y1 = Math.floor(py + height);
            const z0 = Math.floor(pz - halfW), z1 = Math.floor(pz + halfW);

            // 玩家的AABB范围
            const playerMinX = px - halfW, playerMaxX = px + halfW;
            const playerMinY = py, playerMaxY = py + height;
            const playerMinZ = pz - halfW, playerMaxZ = pz + halfW;

            for (let bx = x0; bx <= x1; bx++) {
                for (let by = y0; by <= y1; by++) {
                    for (let bz = z0; bz <= z1; bz++) {
                        // 方块的AABB范围
                        const blockMinX = bx, blockMaxX = bx + 1;
                        const blockMinY = by, blockMaxY = by + 1;
                        const blockMinZ = bz, blockMaxZ = bz + 1;
                        
                        // 检查玩家的身体和方块是否有重叠
                        if (playerMinX < blockMaxX && playerMaxX > blockMinX &&
                            playerMinY < blockMaxY && playerMaxY > blockMinY &&
                            playerMinZ < blockMaxZ && playerMaxZ > blockMinZ) {
                            // 有重叠，检查是否应该跳过（玩家站在方块顶面正上方）
                            if (by === y0) {
                                const blockTop = by + 1.0;
                                // 玩家脚底距离方块顶面很近时，且玩家在方块顶面正上方，才跳过碰撞检测
                                if (Math.abs(py - blockTop) < 0.1) {
                                    const dx = Math.abs(px - (bx + 0.5));
                                    const dz = Math.abs(pz - (bz + 0.5));
                                    if (dx < 0.6 && dz < 0.6) {
                                        continue;
                                    }
                                }
                            }
                            const key = `${bx},${by},${bz}`;
                            if (isBlockSolid(key)) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        }

        // 获取地面高度（优先用 blocksMap，后备用 getTerrainHeight）
        // 返回方块顶面高度 (y+1.0)，玩家脚底站在此高度
        function getGroundY(px, pz) {
            const x = Math.floor(px), z = Math.floor(pz);
            // 从高处往低处搜索（地形最高可达约 55，搜索到 80 留余量）
            for (let y = 80; y >= -10; y--) {
                const key = `${x},${y},${z}`;
                if (isBlockSolid(key)) {
                    return y + 1.0;  // 方块顶面
                }
            }
            // 后备：用地形高度
            return getTerrainHeight(x, z) + 1.0;
        }

        // 添加方块（位置是整数格坐标）
        function addBlock(x, y, z, type) {
            const key = `${x},${y},${z}`;
            if (blocksMap.has(key)) return false;

            const id = type.id;
            const instId = typeCounts[id];
            if (instId >= CAPACITIES[id]) {
                // 容量不足：打印警告（帮助调试地形空缺问题）
                if (!addBlock._warnedCapacity) {
                    addBlock._warnedCapacity = true;
                    console.warn(`[方块容量警告] 类型ID ${id} 容量已满 (${CAPACITIES[id]})，方块可能被丢弃！`);
                }
                return false;
            }

            const im = instancedMeshes[id];
            const matrix = new THREE.Matrix4().makeTranslation(x, y, z);
            im.setMatrixAt(instId, matrix);
            im.count = instId + 1;
            typeCounts[id] = instId + 1;
            im.instanceMatrix.needsUpdate = true;

            // 逐实例颜色微变化：基于坐标的伪随机色差，模拟自然纹理不均匀
            if (im.instanceColor) {
                const baseColor = new THREE.Color(type.color);
                // 用坐标生成稳定的伪随机偏移（±8%亮度变化）
                const hash = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 0xff;
                const v = (hash / 255 - 0.5) * 0.16; // -8% ~ +8%
                baseColor.r = Math.max(0, Math.min(1, baseColor.r + v));
                baseColor.g = Math.max(0, Math.min(1, baseColor.g + v));
                baseColor.b = Math.max(0, Math.min(1, baseColor.b + v));
                im.setColorAt(instId, baseColor);
                im.instanceColor.needsUpdate = true;
            }

            blocksMap.set(key, { typeId: id, instId: instId });
            if (!suppressBlockChanges) blockChanges.set(key, id);
            if (!instToKey[id]) instToKey[id] = [];
            instToKey[id][instId] = key;
            return true;
        }

        // 移除方块（swap-remove：把最后一个实例挪到被删位置）
        function removeBlock(key) {
            const rec = blocksMap.get(key);
            if (!rec) return;

            // 基岩和花岗岩不可破坏：防止玩家挖穿底层掉进虚空
            if (rec.typeId === BLOCK_TYPES.BEDROCK.id || rec.typeId === BLOCK_TYPES.GRANITE.id) return;
            
            // 清理作物生长数据
            cropStages.delete(key);

            const id = rec.typeId;
            const instId = rec.instId;
            const im = instancedMeshes[id];
            const last = typeCounts[id] - 1;

            if (instId !== last && last >= 0) {
                const tmp = new THREE.Matrix4();
                im.getMatrixAt(last, tmp);
                im.setMatrixAt(instId, tmp);

                const lastKey = instToKey[id][last];
                if (lastKey && blocksMap.has(lastKey)) {
                    blocksMap.get(lastKey).instId = instId;
                    instToKey[id][instId] = lastKey;
                }
            }

            typeCounts[id] = last;
            im.count = last;
            im.instanceMatrix.needsUpdate = true;
            if (instToKey[id]) instToKey[id][instId] = null;

            if (!suppressBlockChanges) blockChanges.set(key, -1); // 记录玩家挖掘的方块
            treeBlocks.delete(key);
            blocksMap.delete(key);
        }

        // 强制移除（用于 chunk 卸载，基岩也移除）
        function forceRemoveBlock(key) {
            const rec = blocksMap.get(key);
            if (!rec) return;
            cropStages.delete(key);
            const id = rec.typeId;
            const instId = rec.instId;
            const im = instancedMeshes[id];
            const last = typeCounts[id] - 1;
            if (instId !== last && last >= 0) {
                const tmp = new THREE.Matrix4();
                im.getMatrixAt(last, tmp);
                im.setMatrixAt(instId, tmp);
                const lastKey = instToKey[id][last];
                if (lastKey && blocksMap.has(lastKey)) {
                    blocksMap.get(lastKey).instId = instId;
                    instToKey[id][instId] = lastKey;
                }
            }
            typeCounts[id] = last;
            im.count = last;
            im.instanceMatrix.needsUpdate = true;
            if (instToKey[id]) instToKey[id][instId] = null;
            treeBlocks.delete(key);
            blocksMap.delete(key);
        }

        // === 地形生成（噪声 + 分区块动态加载）===
        function getTerrainHeight(x, z) {
            const continent = fbm(x * 0.008, z * 0.008, 4, 1, 1);
            const mountain = fbm(x * 0.025, z * 0.025, 3, 1, 1);
            const detail = fbm(x * 0.1, z * 0.1, 2, 1, 1);
            const riverN = Math.abs(fbm(x * 0.015 + 50, z * 0.015 + 50, 3, 1, 1) - 0.5) * 2;

            let height = (continent - 0.35) * 28;
            if (continent > 0.48) {
                height += mountain * 28 * (continent - 0.48) * 2.5;
            }
            if (riverN < 0.06 && height > -2 && height < WATER_LEVEL + 5) {
                height = Math.min(height, WATER_LEVEL);
            }
            height += detail * 1.5;
            return Math.floor(height);
        }

        // 生物群系中文名映射（用于 HUD 显示）
        const BIOME_NAMES = {
            ocean: '海洋', coral: '珊瑚礁', beach: '海滩', desert: '沙漠',
            snow: '雪原', volcano: '火山', mountain: '高山', hills: '丘陵',
            plains: '平原', snowMountain: '雪山', waterfall: '瀑布', glacier: '冰川',
            jungle: '雨林', swamp: '沼泽', canyon: '峡谷'
        };

        function getBiomeType(x, z) {
            const h = getTerrainHeight(x, z);
            // 温度/湿度：海洋珊瑚礁判断也需要，故先算
            const temp = fbm(x * 0.005 + 200, z * 0.005 + 200, 2, 1, 1);      // 温度：0=冷 1=热
            const moisture = fbm(x * 0.004 + 900, z * 0.004 + 900, 3, 1, 1);   // 湿度：0=干 1=湿

            // 海洋（低于水面）；浅水 + 温暖 → 珊瑚礁
            if (h < WATER_LEVEL) {
                if (h > WATER_LEVEL - 2 && moisture > 0.35 && temp > 0.4) return 'coral';
                return 'ocean';
            }
            // 海滩
            if (h < WATER_LEVEL + 2) return 'beach';

            // 仅陆地需要这些噪声（延迟计算，省一半海洋区块的开销）
            const elevation = fbm(x * 0.003 + 500, z * 0.003 + 500, 3, 1, 1);  // 起伏度
            const volcanoNoise = fbm(x * 0.004 + 800, z * 0.004 + 800, 4, 1, 1);
            const canyonNoise = fbm(x * 0.006 + 1200, z * 0.006 + 1200, 4, 1, 1);

            // 火山：高温 + 高海拔 + 火山噪声
            if (volcanoNoise > 0.72 && h > 14) return 'volcano';

            // 峡谷：陡峭岩石（高起伏 + 中等海拔 + 干燥）
            if (canyonNoise > 0.68 && elevation > 0.45 && h > 8 && temp < 0.6) return 'canyon';

            // 雪山：高海拔 + 寒冷
            if (h > 22 && temp < 0.55) return 'snowMountain';

            // 冰川：寒冷 + 平坦 + 干燥
            if (temp < 0.35 && h < 12 && moisture < 0.45) return 'glacier';

            // 高山（无雪）
            if (h > 20) return 'mountain';

            // 雪原：寒冷 + 中高海拔
            if (temp < 0.45 && h >= 8) return 'snow';

            // 丘陵：中高海拔 + 起伏
            if (elevation > 0.55 && h > 10 && h <= 20) return 'hills';

            // 雨林：高温 + 高湿 + 低海拔
            if (temp > 0.55 && moisture > 0.5 && h < 14) return 'jungle';

            // 沼泽：高湿 + 低海拔
            if (moisture > 0.62 && h >= WATER_LEVEL && h < 8) return 'swamp';

            // 沙漠：高温 + 干燥 + 低海拔
            if (temp > 0.58 && moisture < 0.4 && h < 14) return 'desert';

            return 'plains';
        }

        function addBlockToChunk(x, y, z, type, chunkBlocks) {
            const key = x + ',' + y + ',' + z;
            if (addBlock(x, y, z, type)) {
                chunkBlocks.add(key);
            }
        }

        function generateColumn(x, z, chunkBlocks) {
            const height = getTerrainHeight(x, z);
            const biome = getBiomeType(x, z);

            // 底岩层：基岩(不可挖) + 花岗岩(不可挖)，形成 3 层实心底部
            // y=0 基岩，y=-1/-2 花岗岩；深海区域从 height 到 y=-3 之间补花岗岩
            addBlockToChunk(x, 0, z, BLOCK_TYPES.BEDROCK, chunkBlocks);
            addBlockToChunk(x, -1, z, BLOCK_TYPES.GRANITE, chunkBlocks);
            addBlockToChunk(x, -2, z, BLOCK_TYPES.GRANITE, chunkBlocks);
            // 深海区域（height < -2）补花岗岩，防止侧面看到空洞
            if (height < -2) {
                for (let y = height; y < -2; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.GRANITE, chunkBlocks);
                }
            }

            // === 通用矿石生成辅助：深层铁矿密集，浅层混合 ===
            function shouldPlaceOre(y) {
                if (y >= 1 && y <= 5) return Math.random() < 0.28;   // 深层 28%
                if (y >= 6 && y < 12) return Math.random() < 0.18;  // 中层 18%
                if (y >= 12 && y < 16) return Math.random() < 0.06; // 浅层 6%
                return false;
            }
            function placeOre(x, y, z, chunkBlocks) {
                const ore = Math.random();
                if (y <= 5) {
                    // 深层：铁矿为主（60%铁，25%煤，15%石头）
                    if (ore < 0.60) addBlockToChunk(x, y, z, BLOCK_TYPES.IRONORE, chunkBlocks);
                    else if (ore < 0.85) addBlockToChunk(x, y, z, BLOCK_TYPES.COAL, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                } else {
                    // 中浅层：铁矿 50%，煤 25%，石头 25%
                    if (ore < 0.50) addBlockToChunk(x, y, z, BLOCK_TYPES.IRONORE, chunkBlocks);
                    else if (ore < 0.75) addBlockToChunk(x, y, z, BLOCK_TYPES.COAL, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
            }

            if (biome === 'ocean') {
                // 确保海底至少有沙石层（height=0 时也要有地面，防止玩家掉入水中）
                const groundLevel = Math.max(1, height);  // 最低地面 y=1
                for (let y = 1; y < groundLevel; y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                // 海底沙层
                addBlockToChunk(x, groundLevel, z, BLOCK_TYPES.SAND, chunkBlocks);
                // 水层（只在海底之上填充水）
                for (let y = groundLevel + 1; y <= WATER_LEVEL; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.WATER, chunkBlocks);
                }
            } else if (biome === 'coral') {
                // 珊瑚礁：浅海沙底 + 珊瑚
                const groundLevel = Math.max(1, height);
                for (let y = 1; y < groundLevel; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                addBlockToChunk(x, groundLevel, z, BLOCK_TYPES.SAND, chunkBlocks);
                // 珊瑚随机生长在沙底上
                if (Math.random() < 0.3) {
                    addBlockToChunk(x, groundLevel + 1, z, BLOCK_TYPES.CORAL, chunkBlocks);
                }
                for (let y = groundLevel + 1; y <= WATER_LEVEL; y++) {
                    if (y !== groundLevel + 1 || Math.random() > 0.3) {
                        addBlockToChunk(x, y, z, BLOCK_TYPES.WATER, chunkBlocks);
                    }
                }
            } else if (biome === 'beach') {
                for (let y = 1; y < Math.max(2, height - 2); y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 2); y <= height; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.SAND, chunkBlocks);
                }
                for (let y = Math.max(height + 1, 1); y <= WATER_LEVEL; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.WATER, chunkBlocks);
                }
            } else if (biome === 'desert') {
                for (let y = 1; y < Math.max(2, height - 3); y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 3); y <= height; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.SAND, chunkBlocks);
                }
            } else if (biome === 'snow') {
                for (let y = 1; y < height; y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.SNOW, chunkBlocks);
            } else if (biome === 'snowMountain') {
                // 雪山：高海拔冰雪山峰（冰 + 雪顶）
                for (let y = 1; y < height - 3; y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, Math.random() < 0.15 ? BLOCK_TYPES.COBBLE : BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 3); y <= height; y++) {
                    if (y === height) addBlockToChunk(x, y, z, BLOCK_TYPES.SNOW, chunkBlocks);
                    else if (y >= height - 2 && Math.random() < 0.5) addBlockToChunk(x, y, z, BLOCK_TYPES.ICE, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
            } else if (biome === 'glacier') {
                // 冰川：平坦冰原
                for (let y = 1; y < height; y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.ICE, chunkBlocks);
                if (height - 1 > 0 && Math.random() < 0.35) {
                    addBlockToChunk(x, height - 1, z, BLOCK_TYPES.ICE, chunkBlocks);
                }
            } else if (biome === 'volcano') {
                // 火山：黑曜石山体 + 发光/熔岩火山口
                for (let y = 1; y < height - 2; y++) {
                    if (y < 8 && Math.random() < 0.28) {
                        const ore = Math.random();
                        if (ore < 0.55) addBlockToChunk(x, y, z, BLOCK_TYPES.IRONORE, chunkBlocks);
                        else if (ore < 0.8) addBlockToChunk(x, y, z, BLOCK_TYPES.COAL, chunkBlocks);
                        else addBlockToChunk(x, y, z, BLOCK_TYPES.OBSIDIAN, chunkBlocks);
                    } else {
                        addBlockToChunk(x, y, z, Math.random() < 0.3 ? BLOCK_TYPES.OBSIDIAN : BLOCK_TYPES.COBBLE, chunkBlocks);
                    }
                }
                for (let y = Math.max(1, height - 2); y <= height; y++) {
                    // 火山口顶部：随机熔岩 + 发光石
                    if (y === height) {
                        const r = Math.random();
                        if (r < 0.45) addBlockToChunk(x, y, z, BLOCK_TYPES.LAVA, chunkBlocks);
                        else if (r < 0.7) addBlockToChunk(x, y, z, BLOCK_TYPES.GLOW, chunkBlocks);
                        else addBlockToChunk(x, y, z, BLOCK_TYPES.OBSIDIAN, chunkBlocks);
                    } else {
                        addBlockToChunk(x, y, z, BLOCK_TYPES.OBSIDIAN, chunkBlocks);
                    }
                }
            } else if (biome === 'canyon') {
                // 峡谷：陡峭岩石，顶部圆石，偶尔有石柱
                for (let y = 1; y < height; y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, Math.random() < 0.3 ? BLOCK_TYPES.COBBLE : BLOCK_TYPES.STONE, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.COBBLE, chunkBlocks);
                if (height > 10 && Math.random() < 0.08) {
                    addBlockToChunk(x, height + 1, z, BLOCK_TYPES.COBBLE, chunkBlocks);
                }
            } else if (biome === 'mountain') {
                for (let y = 1; y < height; y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 1); y <= height; y++) {
                    addBlockToChunk(x, y, z, y === height ? BLOCK_TYPES.SNOW : BLOCK_TYPES.STONE, chunkBlocks);
                }
            } else if (biome === 'hills') {
                for (let y = 1; y < Math.max(2, height - 4); y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 4); y < height; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.DIRT, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.GRASS, chunkBlocks);
            } else if (biome === 'jungle') {
                // 雨林：潮湿土壤 + 草地（植被在下方单独生成）
                for (let y = 1; y < Math.max(2, height - 3); y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 3); y < height; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.DIRT, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.GRASS, chunkBlocks);
            } else if (biome === 'swamp') {
                // 沼泽：湿地泥土 + 水面 + 蘑菇
                for (let y = 1; y < Math.max(2, height - 2); y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                }
                for (let y = Math.max(1, height - 2); y < height; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.DIRT, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.DIRT, chunkBlocks);
                // 沼泽水面/水坑
                if (height < WATER_LEVEL) {
                    for (let y = height + 1; y <= WATER_LEVEL; y++) {
                        addBlockToChunk(x, y, z, BLOCK_TYPES.WATER, chunkBlocks);
                    }
                } else if (Math.random() < 0.25) {
                    addBlockToChunk(x, height + 1, z, BLOCK_TYPES.WATER, chunkBlocks);
                }
            } else {
                // plains
                for (let y = 1; y < Math.max(2, height - 3); y++) {
                    if (shouldPlaceOre(y)) placeOre(x, y, z, chunkBlocks);
                    else {
                        addBlockToChunk(x, y, z, BLOCK_TYPES.STONE, chunkBlocks);
                    }
                }
                for (let y = Math.max(1, height - 3); y < height; y++) {
                    addBlockToChunk(x, y, z, BLOCK_TYPES.DIRT, chunkBlocks);
                }
                addBlockToChunk(x, height, z, BLOCK_TYPES.GRASS, chunkBlocks);
            }

            // === 瀑布：当前列为低处（邻水/陆地），相邻列是高崖时，在崖面生成水柱 ===
            if (height <= WATER_LEVEL + 1) {
                const waterfallDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                for (const [dx, dz] of waterfallDirs) {
                    const nh = getTerrainHeight(x + dx, z + dz);
                    if (nh >= height + 4 && Math.random() < 0.3) {
                        const wTop = nh;
                        const wBottom = Math.max(height + 1, WATER_LEVEL + 1);
                        for (let y = wBottom; y <= wTop; y++) {
                            addBlockToChunk(x, y, z, BLOCK_TYPES.WATERFALL, chunkBlocks);
                        }
                        break; // 一列最多一条瀑布
                    }
                }
            }

            // === 植被生成 ===
            if (height > WATER_LEVEL + 1) {
                if (biome === 'jungle') {
                    // 雨林：密集树木 + 竹子 + 蘑菇
                    if (Math.random() < 0.04) createTreeInChunk(x, height + 1, z, chunkBlocks);
                    else if (Math.random() < 0.03) {
                        const bambooH = 3 + Math.floor(Math.random() * 3);
                        for (let y = 0; y < bambooH; y++) {
                            addBlockToChunk(x, height + 1 + y, z, BLOCK_TYPES.BAMBOO, chunkBlocks);
                        }
                    } else if (Math.random() < 0.02) {
                        addBlockToChunk(x, height + 1, z, BLOCK_TYPES.MUSHROOM, chunkBlocks);
                    }
                } else if (biome === 'swamp') {
                    // 沼泽：稀疏树 + 蘑菇
                    if (Math.random() < 0.008) createTreeInChunk(x, height + 1, z, chunkBlocks);
                    else if (Math.random() < 0.03) {
                        addBlockToChunk(x, height + 1, z, BLOCK_TYPES.MUSHROOM, chunkBlocks);
                    }
                } else if (biome === 'plains' || biome === 'hills') {
                    if (Math.random() < 0.006) createTreeInChunk(x, height + 1, z, chunkBlocks);
                } else if (biome === 'desert') {
                    // 沙漠：稀疏灌木（用原木代表仙人掌）
                    if (Math.random() < 0.003) {
                        addBlockToChunk(x, height + 1, z, BLOCK_TYPES.WOOD, chunkBlocks);
                    }
                }
            }
        }

        function createTreeInChunk(trunkX, startY, trunkZ, chunkBlocks) {
            const treeHeight = 4 + Math.floor(Math.random() * 3);
            for (let y = 0; y < treeHeight; y++) {
                addBlockToChunk(trunkX, startY + y, trunkZ, BLOCK_TYPES.WOOD, chunkBlocks);
                // 树干记入 treeBlocks：不碰撞，玩家/怪物不能站在树顶
                const tk = `${trunkX},${startY + y},${trunkZ}`;
                if (blocksMap.has(tk)) treeBlocks.add(tk);
            }
            const leafTop = startY + treeHeight;
            for (let lx = -2; lx <= 2; lx++) {
                for (let lz = -2; lz <= 2; lz++) {
                    for (let ly = -2; ly <= 0; ly++) {
                        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                        addBlockToChunk(trunkX + lx, leafTop + ly, trunkZ + lz, BLOCK_TYPES.LEAVES, chunkBlocks);
                        // 树叶记入 treeBlocks：不碰撞，不能站在树顶
                        const lk = `${trunkX + lx},${leafTop + ly},${trunkZ + lz}`;
                        if (blocksMap.has(lk)) treeBlocks.add(lk);
                    }
                }
            }
        }

        function generateChunk(cx, cz) {
            const key = chunkKey(cx, cz);
            if (generatedChunks.has(key)) return;
            const blocksInChunk = new Set();
            const x0 = cx * CHUNK_SIZE;
            const z0 = cz * CHUNK_SIZE;
            suppressBlockChanges = true; // 地形生成不记录到 blockChanges（只保存玩家手动修改）
            try {
                for (let x = x0; x < x0 + CHUNK_SIZE; x++) {
                    for (let z = z0; z < z0 + CHUNK_SIZE; z++) {
                        generateColumn(x, z, blocksInChunk);
                    }
                }
            } finally {
                suppressBlockChanges = false;
            }
            generatedChunks.set(key, blocksInChunk);
            applyBlockChangesForChunk(cx, cz, blocksInChunk); // 重新应用存档中记录的方块修改
        }

        // 将存档中的方块修改应用到指定 chunk（挖掘的方块移除，放置的方块添加）
        function applyBlockChangesForChunk(cx, cz, blocksInChunk) {
            if (blockChanges.size === 0) return;
            const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
            const x1 = x0 + CHUNK_SIZE, z1 = z0 + CHUNK_SIZE;
            const typeById = {};
            for (const [k, v] of Object.entries(BLOCK_TYPES)) typeById[v.id] = v;
            for (const [key, typeId] of blockChanges) {
                const parts = key.split(',');
                const x = parseInt(parts[0], 10);
                const z = parseInt(parts[2], 10);
                if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
                if (typeId === -1) {
                    forceRemoveBlock(key);
                    blocksInChunk.delete(key);
                } else if (!blocksMap.has(key)) {
                    const bt = typeById[typeId];
                    if (bt) {
                        addBlock(x, parseInt(parts[1], 10), z, bt);
                        blocksInChunk.add(key);
                    }
                }
            }
        }

        function unloadChunk(cx, cz) {
            const key = chunkKey(cx, cz);
            const blocks = generatedChunks.get(key);
            if (!blocks) return;
            for (const bk of blocks) forceRemoveBlock(bk);
            generatedChunks.delete(key);
        }

        function updateChunks() {
            const pos = getPlayerPos();
            const pcx = Math.floor(pos.x / CHUNK_SIZE);
            const pcz = Math.floor(pos.z / CHUNK_SIZE);

            // 生成附近 chunk
            for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
                for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
                    generateChunk(pcx + dx, pcz + dz);
                }
            }
            // 卸载远处 chunk
            for (const [key, blocks] of generatedChunks) {
                const parts = key.split(',');
                const cx = parseInt(parts[0], 10);
                const cz = parseInt(parts[1], 10);
                if (Math.abs(cx - pcx) > UNLOAD_DIST || Math.abs(cz - pcz) > UNLOAD_DIST) {
                    unloadChunk(cx, cz);
                }
            }
        }

        // 初始生成：玩家出生点周围
        async function generateTerrain() {
            generateChunk(0, 0);
            // 确保出生点周围有地形（分批生成 + 进度更新，避免主线程阻塞导致进度条卡死）
            const spawnCX = Math.floor(0 / CHUNK_SIZE);
            const spawnCZ = Math.floor(0 / CHUNK_SIZE);
            const sideLen = RENDER_DIST * 2 + 1;
            const totalChunks = sideLen * sideLen;
            let chunkCount = 0;
            for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
                for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
                    generateChunk(spawnCX + dx, spawnCZ + dz);
                    chunkCount++;
                    // 每 5 个 chunk 让出主线程一次，更新进度条
                    if (chunkCount % 5 === 0) {
                        const pct = 35 + Math.round(chunkCount / totalChunks * 25);
                        updateProgress(pct, `生成地形... ${chunkCount}/${totalChunks}`);
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }
            // 设置玩家出生点（搜索最近的陆地，确保不出生在海里）
            spawnX = 0; spawnZ = 0;
            let spawnH = getTerrainHeight(0, 0);
            let foundLand = spawnH > WATER_LEVEL;
            for (let r = 1; r <= 60 && !foundLand; r++) {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dz = -r; dz <= r; dz++) {
                        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                        const h = getTerrainHeight(dx, dz);
                        if (h > WATER_LEVEL + 1) {
                            spawnX = dx; spawnZ = dz; spawnH = h;
                            foundLand = true;
                            break;
                        }
                    }
                    if (foundLand) break;
                }
            }
            const spawnGroundY = getGroundY(spawnX, spawnZ);
            controls.getObject().position.set(spawnX, spawnGroundY + PLAYER_HEIGHT, spawnZ);
            if (playerModel) {
                playerModel.position.set(spawnX, spawnGroundY, spawnZ);
                // 初始第三人称相机位置（玩家身后）
                camera.position.set(spawnX, spawnGroundY + 2.5, spawnZ + 5);
                camera.lookAt(spawnX, spawnGroundY + 1.5, spawnZ);
                // 隐藏第一人称手臂
                if (playerArm) playerArm.visible = false;
            }
            // 生成怪物（减少数量避免阻塞主线程）
            await new Promise(r => setTimeout(r, 0));
            spawnMobs();
            // 在出生点附近生成平坦陆地，确保奶奶爷爷有地方站
            // 范围 ±12 格（减少填充量避免卡死），避免走出平坦区时地面高度突变
            updateProgress(60, '平整出生点...');
            await new Promise(r => setTimeout(r, 0));
            const flatY = Math.max(spawnGroundY, WATER_LEVEL + 2);
            let flatCount = 0;
            const flatTotal = 25 * 25;
            for (let dx = -12; dx <= 12; dx++) {
                for (let dz = -12; dz <= 12; dz++) {
                    const x = spawnX + dx, z = spawnZ + dz;
                    const h = getTerrainHeight(x, z);
                    if (h < flatY) {
                        // 填充到平坦高度，但最多填5格（避免深水区大量填充导致卡死）
                        const fillStart = Math.max(h + 1, flatY - 5);
                        for (let y = fillStart; y <= flatY; y++) {
                            addBlock(x, y, z, y === flatY ? BLOCK_TYPES.GRASS : (y < flatY - 1 ? BLOCK_TYPES.STONE : BLOCK_TYPES.DIRT));
                        }
                    }
                    flatCount++;
                    // 每 50 格让出主线程一次，更新进度条
                    if (flatCount % 50 === 0) {
                        const pct = 60 + Math.round(flatCount / flatTotal * 10);
                        updateProgress(pct, `平整出生点... ${Math.min(flatCount, flatTotal)}/${flatTotal}`);
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }
            // 更新出生点地面高度
            const finalSpawnGroundY = getGroundY(spawnX, spawnZ);
            
            // 副本传送门和城市传送点由 initDungeonEntrances() 创建



            // 尝试加载存档（在地形生成后，确保位置有效）
            loadGame();
        }

        // 生成树木（树木方块不碰撞，不能跳上去）
        function createTree(trunkX, startY, trunkZ) {
            const treeHeight = 4 + Math.floor(Math.random() * 2);
            for (let y = 0; y < treeHeight; y++) {
                const key = `${trunkX},${startY + y},${trunkZ}`;
                addBlock(trunkX, startY + y, trunkZ, BLOCK_TYPES.WOOD);
                treeBlocks.add(key);
            }
            const leafTop = startY + treeHeight;
            for (let lx = -2; lx <= 2; lx++) {
                for (let lz = -2; lz <= 2; lz++) {
                    for (let ly = -2; ly <= 0; ly++) {
                        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                        const px = trunkX + lx;
                        const py = leafTop + ly;
                        const pz = trunkZ + lz;
                        const key = `${px},${py},${pz}`;
                        if (!blocksMap.has(key)) {
                            addBlock(px, py, pz, BLOCK_TYPES.LEAVES);
                            treeBlocks.add(key);
                        }
                    }
                }
            }
        }

        // 创建怪物头顶血条（Canvas 纹理 Sprite）
        function createHealthBar(maxHp) {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 16;
            const ctx = canvas.getContext('2d');
            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(1.0, 0.125, 1);
            sprite.renderOrder = 999;
            sprite.userData = { canvas, ctx, tex, maxHp };
            return sprite;
        }

        // 更新血条显示
        function updateHealthBar(sprite, currentHp) {
            const { canvas, ctx, tex, maxHp } = sprite.userData;
            const w = canvas.width;
            const h = canvas.height;
            const pct = Math.max(0, currentHp / maxHp);
            ctx.clearRect(0, 0, w, h);
            // 背景（黑色边框）
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            // 红色背景（失去的血量）
            ctx.fillStyle = '#400';
            ctx.fillRect(2, 2, w - 4, h - 4);
            // 绿色前景（当前血量）
            ctx.fillStyle = '#0f0';
            ctx.fillRect(2, 2, Math.floor((w - 4) * pct), h - 4);
            tex.needsUpdate = true;
        }

        // 5. 创建怪物模型（支持缩放、多腿、翅膀）—— 每种怪物外观独特逼真
        function createMobMesh(mobType) {
            const group = new THREE.Group();
            const s = mobType.scale || 1.0;
            const texKey = mobType.textureKey;
            const mobTex = texKey ? mobTextures[texKey] : null;
            // 使用纹理材质（如果有纹理）
            const mat = mobTex
                ? new THREE.MeshLambertMaterial({ map: mobTex })
                : new THREE.MeshLambertMaterial({ color: mobType.bodyColor });
            const headMat = mobTex
                ? new THREE.MeshLambertMaterial({ map: mobTex })
                : new THREE.MeshLambertMaterial({ color: mobType.headColor });
            const nameKey = mobType.textureKey || '';

            // ===== 鸡 CHICKEN：圆身体、红鸡冠、橙喙、黄细腿、翅膀 =====
            if (nameKey === 'CHICKEN') {
                // 圆身体
                const bodyGeo = new THREE.SphereGeometry(0.32 * s, 8, 6);
                const body = new THREE.Mesh(bodyGeo, headMat);
                body.position.y = 0.35 * s;
                body.scale.set(1, 0.8, 1);
                group.add(body);
                // 头部
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 8, 6), headMat);
                head.position.set(0, 0.68 * s, 0.15 * s);
                group.add(head);
                // 红色鸡冠
                const combMat = new THREE.MeshLambertMaterial({ color: 0xdd2222 });
                const comb1 = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.12 * s, 0.04 * s), combMat);
                comb1.position.set(0, 0.85 * s, 0.15 * s);
                comb1.rotation.z = 0.2;
                group.add(comb1);
                const comb2 = comb1.clone();
                comb2.position.x = 0.06 * s;
                comb2.rotation.z = -0.1;
                group.add(comb2);
                const comb3 = comb1.clone();
                comb3.position.x = -0.06 * s;
                comb3.rotation.z = 0.1;
                group.add(comb3);
                // 橙色喙
                const beakMat = new THREE.MeshLambertMaterial({ color: 0xffaa33 });
                const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04 * s, 0.1 * s, 4), beakMat);
                beak.rotation.x = Math.PI / 2;
                beak.position.set(0, 0.65 * s, 0.28 * s);
                group.add(beak);
                // 红色肉垂
                const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.08 * s, 0.03 * s), combMat);
                wattle.position.set(0, 0.58 * s, 0.25 * s);
                group.add(wattle);
                // 眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.06 * s, 0.7 * s, 0.22 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.06 * s;
                group.add(eyeR);
                // 黄色细腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0xddaa33 });
                const legGeo = new THREE.BoxGeometry(0.04 * s, 0.2 * s, 0.04 * s);
                const legL = new THREE.Mesh(legGeo, legMat);
                legL.position.set(-0.08 * s, 0.1 * s, 0);
                group.add(legL);
                const legR = legL.clone();
                legR.position.x = 0.08 * s;
                group.add(legR);
                // 脚爪
                const clawMat = new THREE.MeshLambertMaterial({ color: 0xddaa33 });
                for (const lx of [-0.08, 0.08]) {
                    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.02 * s, 0.06 * s), clawMat);
                    claw.position.set(lx * s, 0.01 * s, 0.02 * s);
                    group.add(claw);
                }
                // 翅膀
                const wingMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                const wingGeo = new THREE.BoxGeometry(0.05 * s, 0.2 * s, 0.25 * s);
                const wingL = new THREE.Mesh(wingGeo, wingMat);
                wingL.position.set(-0.3 * s, 0.35 * s, 0);
                wingL.rotation.z = -0.3;
                group.add(wingL);
                const wingR = wingL.clone();
                wingR.position.x = 0.3 * s;
                wingR.rotation.z = 0.3;
                group.add(wingR);
                // 尾巴羽毛
                const tailMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
                const tailFeather = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.1 * s, 0.15 * s), tailMat);
                tailFeather.position.set(0, 0.4 * s, -0.25 * s);
                tailFeather.rotation.x = 0.5;
                group.add(tailFeather);
                // 标签
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 1.0 * s;
                group.add(label);
                return group;
            }

            // ===== 蝙蝠 BAT：无腿、大翅膀、小身体、尖耳 =====
            if (nameKey === 'BAT') {
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 8, 6), mat);
                body.position.y = 0.3 * s;
                body.scale.set(1, 0.8, 1.2);
                group.add(body);
                // 大翅膀
                const wingMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
                const wingGeo = new THREE.BoxGeometry(0.45 * s, 0.02 * s, 0.3 * s);
                const wingL = new THREE.Mesh(wingGeo, wingMat);
                wingL.position.set(-0.3 * s, 0.35 * s, 0);
                wingL.rotation.z = 0.2;
                group.add(wingL);
                const wingR = wingL.clone();
                wingR.position.x = 0.3 * s;
                wingR.rotation.z = -0.2;
                group.add(wingR);
                // 头部
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 6), headMat);
                head.position.set(0, 0.45 * s, 0.1 * s);
                group.add(head);
                // 尖耳朵
                const earMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
                const earGeo = new THREE.ConeGeometry(0.04 * s, 0.1 * s, 4);
                const earL = new THREE.Mesh(earGeo, earMat);
                earL.position.set(-0.06 * s, 0.55 * s, 0.08 * s);
                earL.rotation.z = 0.2;
                group.add(earL);
                const earR = earL.clone();
                earR.position.x = 0.06 * s;
                earR.rotation.z = -0.2;
                group.add(earR);
                // 红色眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.04 * s, 0.47 * s, 0.16 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.04 * s;
                group.add(eyeR);
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 0.8 * s;
                group.add(label);
                return group;
            }

            // ===== 牛 COW：大身体、角、乳房、四腿、尾 =====
            if (nameKey === 'COW') {
                // 大身体
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.5 * s, 0.8 * s), bodyMat);
                body.position.y = 0.55 * s;
                group.add(body);
                // 白色斑块
                const whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                for (let i = 0; i < 5; i++) {
                    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.52 * s, 0.15 * s), whiteMat);
                    patch.position.set((Math.random() - 0.5) * 0.3 * s, 0.55 * s, (Math.random() - 0.5) * 0.5 * s);
                    group.add(patch);
                }
                // 头部
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.3 * s, 0.3 * s), bodyMat);
                head.position.set(0, 0.85 * s, 0.45 * s);
                group.add(head);
                // 角
                const hornMat = new THREE.MeshLambertMaterial({ color: 0xffeeaa });
                const hornGeo = new THREE.ConeGeometry(0.04 * s, 0.15 * s, 4);
                const hornL = new THREE.Mesh(hornGeo, hornMat);
                hornL.position.set(-0.12 * s, 1.0 * s, 0.45 * s);
                hornL.rotation.z = 0.3;
                group.add(hornL);
                const hornR = hornL.clone();
                hornR.position.x = 0.12 * s;
                hornR.rotation.z = -0.3;
                group.add(hornR);
                // 耳朵
                const earMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const earL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.1 * s, 0.04 * s), earMat);
                earL.position.set(-0.15 * s, 0.9 * s, 0.45 * s);
                earL.rotation.z = 0.5;
                group.add(earL);
                const earR = earL.clone();
                earR.position.x = 0.15 * s;
                earR.rotation.z = -0.5;
                group.add(earR);
                // 眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.06 * s, 0.88 * s, 0.6 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.06 * s;
                group.add(eyeR);
                // 鼻头
                const noseMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.1 * s, 0.05 * s), noseMat);
                nose.position.set(0, 0.78 * s, 0.62 * s);
                group.add(nose);
                // 四腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
                const legGeo = new THREE.BoxGeometry(0.1 * s, 0.4 * s, 0.1 * s);
                for (const [lx, lz] of [[-0.18, 0.25], [0.18, 0.25], [-0.18, -0.25], [0.18, -0.25]]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx * s, 0.2 * s, lz * s);
                    group.add(leg);
                }
                // 蹄子
                const hoofMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                for (const [lx, lz] of [[-0.18, 0.25], [0.18, 0.25], [-0.18, -0.25], [0.18, -0.25]]) {
                    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.05 * s, 0.1 * s), hoofMat);
                    hoof.position.set(lx * s, 0.025 * s, lz * s);
                    group.add(hoof);
                }
                // 尾巴
                const tailMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
                const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.3 * s, 0.04 * s), tailMat);
                tail.position.set(0, 0.6 * s, -0.4 * s);
                tail.rotation.x = 0.3;
                group.add(tail);
                // 尾巴末梢
                const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 6, 6), new THREE.MeshLambertMaterial({ color: 0x332211 }));
                tailTuft.position.set(0, 0.45 * s, -0.5 * s);
                group.add(tailTuft);
                // 乳房
                const udder = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 6, 6), whiteMat);
                udder.position.set(0, 0.3 * s, -0.1 * s);
                group.add(udder);
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 1.3 * s;
                group.add(label);
                return group;
            }

            // ===== 羊 SHEEP：羊毛身体、深色脸、四腿 =====
            if (nameKey === 'SHEEP') {
                // 羊毛身体（多层叠加模拟蓬松感）
                const woolMat = mat;
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.6 * s), woolMat);
                body.position.y = 0.5 * s;
                group.add(body);
                // 羊毛细节（小方块叠加）
                for (let i = 0; i < 12; i++) {
                    const wool = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.12 * s), woolMat);
                    wool.position.set((Math.random() - 0.5) * 0.3 * s, 0.75 * s + Math.random() * 0.1 * s, (Math.random() - 0.5) * 0.4 * s);
                    group.add(wool);
                }
                // 深色头部
                const faceMat = headMat;
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.25 * s, 0.2 * s), faceMat);
                head.position.set(0, 0.7 * s, 0.4 * s);
                group.add(head);
                // 耳朵
                const earMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
                const earL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.1 * s, 0.03 * s), earMat);
                earL.position.set(-0.12 * s, 0.75 * s, 0.38 * s);
                earL.rotation.z = 0.6;
                group.add(earL);
                const earR = earL.clone();
                earR.position.x = 0.12 * s;
                earR.rotation.z = -0.6;
                group.add(earR);
                // 眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.05 * s, 0.72 * s, 0.5 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.05 * s;
                group.add(eyeR);
                // 鼻子
                const noseMat = new THREE.MeshLambertMaterial({ color: 0x886644 });
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.06 * s, 0.03 * s), noseMat);
                nose.position.set(0, 0.65 * s, 0.52 * s);
                group.add(nose);
                // 四腿（深色）
                const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
                const legGeo = new THREE.BoxGeometry(0.08 * s, 0.35 * s, 0.08 * s);
                for (const [lx, lz] of [[-0.15, 0.18], [0.15, 0.18], [-0.15, -0.18], [0.15, -0.18]]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx * s, 0.175 * s, lz * s);
                    group.add(leg);
                }
                // 蹄子
                const hoofMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                for (const [lx, lz] of [[-0.15, 0.18], [0.15, 0.18], [-0.15, -0.18], [0.15, -0.18]]) {
                    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.04 * s, 0.08 * s), hoofMat);
                    hoof.position.set(lx * s, 0.02 * s, lz * s);
                    group.add(hoof);
                }
                // 尾巴（小羊毛球）
                const tailWool = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 6, 6), woolMat);
                tailWool.position.set(0, 0.55 * s, -0.35 * s);
                group.add(tailWool);
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 1.1 * s;
                group.add(label);
                return group;
            }

            // ===== 猪 PIG：粉色身体、鼻子、卷尾、四腿 =====
            if (nameKey === 'PIG') {
                // 粉色圆身体
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.4 * s, 0.6 * s), bodyMat);
                body.position.y = 0.4 * s;
                group.add(body);
                // 头部
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.25 * s, 0.25 * s), bodyMat);
                head.position.set(0, 0.6 * s, 0.35 * s);
                group.add(head);
                // 鼻子（突出的粉色球）
                const noseMat = new THREE.MeshLambertMaterial({ color: 0xff99aa });
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.1 * s, 0.08 * s), noseMat);
                nose.position.set(0, 0.55 * s, 0.5 * s);
                group.add(nose);
                // 鼻孔
                const nostrilMat = new THREE.MeshLambertMaterial({ color: 0xdd7788 });
                const nostrilL = new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.03 * s, 0.02 * s), nostrilMat);
                nostrilL.position.set(-0.03 * s, 0.55 * s, 0.55 * s);
                group.add(nostrilL);
                const nostrilR = nostrilL.clone();
                nostrilR.position.x = 0.03 * s;
                group.add(nostrilR);
                // 耳朵（尖）
                const earMat = new THREE.MeshLambertMaterial({ color: 0xffb6c1 });
                const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.1 * s, 4), earMat);
                earL.position.set(-0.1 * s, 0.72 * s, 0.35 * s);
                earL.rotation.z = 0.3;
                group.add(earL);
                const earR = earL.clone();
                earR.position.x = 0.1 * s;
                earR.rotation.z = -0.3;
                group.add(earR);
                // 眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.06 * s, 0.62 * s, 0.45 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.06 * s;
                group.add(eyeR);
                // 四腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0xffb6c1 });
                const legGeo = new THREE.BoxGeometry(0.08 * s, 0.25 * s, 0.08 * s);
                for (const [lx, lz] of [[-0.15, 0.18], [0.15, 0.18], [-0.15, -0.18], [0.15, -0.18]]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx * s, 0.125 * s, lz * s);
                    group.add(leg);
                }
                // 蹄子
                const hoofMat = new THREE.MeshLambertMaterial({ color: 0xdd8899 });
                for (const [lx, lz] of [[-0.15, 0.18], [0.15, 0.18], [-0.15, -0.18], [0.15, -0.18]]) {
                    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.04 * s, 0.08 * s), hoofMat);
                    hoof.position.set(lx * s, 0.02 * s, lz * s);
                    group.add(hoof);
                }
                // 卷尾巴
                const tailMat = new THREE.MeshLambertMaterial({ color: 0xffb6c1 });
                const tailSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.08 * s, 0.03 * s), tailMat);
                tailSeg1.position.set(0, 0.45 * s, -0.32 * s);
                tailSeg1.rotation.x = 0.5;
                group.add(tailSeg1);
                const tailSeg2 = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 6, 6), tailMat);
                tailSeg2.position.set(0, 0.4 * s, -0.38 * s);
                group.add(tailSeg2);
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 1.0 * s;
                group.add(label);
                return group;
            }

            // ===== 狼 WOLF：灰色身体、尖耳、长鼻、尾 =====
            if (nameKey === 'SHUAISHU') {
                // 身体
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.35 * s, 0.7 * s), bodyMat);
                body.position.y = 0.45 * s;
                group.add(body);
                // 头部（长）
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.2 * s, 0.3 * s), bodyMat);
                head.position.set(0, 0.6 * s, 0.5 * s);
                group.add(head);
                // 长鼻
                const snoutMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
                const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.15 * s), snoutMat);
                snout.position.set(0, 0.55 * s, 0.65 * s);
                group.add(snout);
                // 鼻头
                const noseMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.04 * s, 0.04 * s), noseMat);
                nose.position.set(0, 0.57 * s, 0.72 * s);
                group.add(nose);
                // 尖耳朵
                const earMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
                const earL = new THREE.Mesh(new THREE.ConeGeometry(0.04 * s, 0.12 * s, 4), earMat);
                earL.position.set(-0.08 * s, 0.72 * s, 0.45 * s);
                earL.rotation.z = 0.2;
                group.add(earL);
                const earR = earL.clone();
                earR.position.x = 0.08 * s;
                earR.rotation.z = -0.2;
                group.add(earR);
                // 眼睛（黄色）
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.05 * s, 0.62 * s, 0.6 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.05 * s;
                group.add(eyeR);
                // 四腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
                const legGeo = new THREE.BoxGeometry(0.07 * s, 0.3 * s, 0.07 * s);
                for (const [lx, lz] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx * s, 0.15 * s, lz * s);
                    group.add(leg);
                }
                // 爪
                const clawMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
                for (const [lx, lz] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]]) {
                    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.03 * s, 0.07 * s), clawMat);
                    claw.position.set(lx * s, 0.015 * s, lz * s);
                    group.add(claw);
                }
                // 尾巴（蓬松）
                const tailMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
                const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.3 * s), tailMat);
                tail.position.set(0, 0.5 * s, -0.45 * s);
                tail.rotation.x = 0.3;
                group.add(tail);
                // 尾巴尖
                const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 6, 6), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
                tailTip.position.set(0, 0.48 * s, -0.55 * s);
                group.add(tailTip);
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 1.0 * s;
                group.add(label);
                return group;
            }

            // ===== 兔子 RABBIT：小圆身体、长耳、蓬松尾巴 =====
            if (nameKey === 'RABBIT') {
                // 圆身体
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.25 * s, 8, 6), bodyMat);
                body.position.y = 0.25 * s;
                body.scale.set(1, 0.9, 1.1);
                group.add(body);
                // 头部
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 8, 6), bodyMat);
                head.position.set(0, 0.5 * s, 0.15 * s);
                group.add(head);
                // 长耳朵
                const earMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                const earGeo = new THREE.BoxGeometry(0.05 * s, 0.35 * s, 0.04 * s);
                const earL = new THREE.Mesh(earGeo, earMat);
                earL.position.set(-0.08 * s, 0.75 * s, 0.12 * s);
                earL.rotation.z = 0.1;
                group.add(earL);
                const earR = earL.clone();
                earR.position.x = 0.08 * s;
                earR.rotation.z = -0.1;
                group.add(earR);
                // 耳朵内侧（粉色）
                const earInnerMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
                const earInnerGeo = new THREE.BoxGeometry(0.03 * s, 0.3 * s, 0.02 * s);
                const earInnerL = new THREE.Mesh(earInnerGeo, earInnerMat);
                earInnerL.position.set(-0.08 * s, 0.72 * s, 0.16 * s);
                group.add(earInnerL);
                const earInnerR = earInnerL.clone();
                earInnerR.position.x = 0.08 * s;
                group.add(earInnerR);
                // 眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.05 * s, 0.52 * s, 0.25 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.05 * s;
                group.add(eyeR);
                // 鼻子
                const noseMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.03 * s, 0.02 * s), noseMat);
                nose.position.set(0, 0.48 * s, 0.28 * s);
                group.add(nose);
                // 四短腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                const legGeo = new THREE.BoxGeometry(0.06 * s, 0.15 * s, 0.06 * s);
                for (const [lx, lz] of [[-0.1, 0.1], [0.1, 0.1], [-0.1, -0.1], [0.1, -0.1]]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx * s, 0.075 * s, lz * s);
                    group.add(leg);
                }
                // 蓬松尾巴
                const tailMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
                const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 6, 6), tailMat);
                tail.position.set(0, 0.28 * s, -0.25 * s);
                group.add(tail);
                const label = makeNameTag(mobType.name, '#55ff55', mobType.pinyin, texKey);
                label.position.y = 1.0 * s;
                group.add(label);
                return group;
            }

            // ===== 蜘蛛 SPIDER：圆身体、八条腿、红眼 =====
            if (nameKey === 'AUNT') {
                // 圆身体
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), bodyMat);
                body.position.y = 0.25 * s;
                body.scale.set(1.2, 0.8, 1);
                group.add(body);
                // 腹部（更大）
                const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.25 * s, 8, 6), mat);
                abdomen.position.set(0, 0.25 * s, -0.1 * s);
                abdomen.scale.set(1, 0.8, 1);
                group.add(abdomen);
                // 头胸部
                const cephalothorax = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 8, 6), bodyMat);
                cephalothorax.position.set(0, 0.3 * s, 0.15 * s);
                group.add(cephalothorax);
                // 八条腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                for (let i = 0; i < 4; i++) {
                    const angle = (i - 1.5) * 0.5;
                    for (const side of [-1, 1]) {
                        const leg = new THREE.Group();
                        // 大腿
                        const upperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.2 * s, 0.04 * s), legMat);
                        upperLeg.position.y = 0.1 * s;
                        upperLeg.rotation.x = side * 0.8;
                        leg.add(upperLeg);
                        // 小腿
                        const lowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.2 * s, 0.03 * s), legMat);
                        lowerLeg.position.set(side * 0.1 * s, -0.05 * s, 0);
                        lowerLeg.rotation.x = -side * 0.6;
                        leg.add(lowerLeg);
                        leg.position.set(side * 0.15 * s, 0.25 * s, Math.cos(angle) * 0.15 * s);
                        leg.rotation.y = angle;
                        group.add(leg);
                    }
                }
                // 红色眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
                const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 6), eyeMat);
                eyeL.position.set(-0.05 * s, 0.35 * s, 0.25 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.05 * s;
                group.add(eyeR);
                // 螯肢
                const cheliceraMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
                const cheliceraL = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.08 * s, 0.03 * s), cheliceraMat);
                cheliceraL.position.set(-0.04 * s, 0.22 * s, 0.25 * s);
                group.add(cheliceraL);
                const cheliceraR = cheliceraL.clone();
                cheliceraR.position.x = 0.04 * s;
                group.add(cheliceraR);
                const label = makeNameTag(mobType.name, '#ff5555', mobType.pinyin, texKey);
                label.position.y = 0.8 * s;
                group.add(label);
                return group;
            }

            // ===== 苦力怕 CREEPER：绿色、脸纹、四短腿 =====
            if (nameKey === 'DAD') {
                // 身体
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.5 * s, 0.25 * s), bodyMat);
                body.position.y = 0.5 * s;
                group.add(body);
                // 头部
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.4 * s, 0.4 * s), bodyMat);
                head.position.y = 1.0 * s;
                group.add(head);
                // 苦力怕脸（黑色像素图案）
                const faceMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                // 眼睛
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.02 * s), faceMat);
                eyeL.position.set(-0.08 * s, 1.05 * s, 0.21 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.08 * s;
                group.add(eyeR);
                // 嘴（M形）
                const mouthTop = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.04 * s, 0.02 * s), faceMat);
                mouthTop.position.set(0, 0.92 * s, 0.21 * s);
                group.add(mouthTop);
                const mouthBL = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.1 * s, 0.02 * s), faceMat);
                mouthBL.position.set(-0.05 * s, 0.86 * s, 0.21 * s);
                group.add(mouthBL);
                const mouthBR = mouthBL.clone();
                mouthBR.position.x = 0.05 * s;
                group.add(mouthBR);
                // 四短腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0x448833 });
                const legGeo = new THREE.BoxGeometry(0.15 * s, 0.25 * s, 0.15 * s);
                for (const [lx, lz] of [[-0.12, 0.1], [0.12, 0.1], [-0.12, -0.1], [0.12, -0.1]]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx * s, 0.125 * s, lz * s);
                    group.add(leg);
                }
                const label = makeNameTag(mobType.name, '#ff5555', mobType.pinyin, texKey);
                label.position.y = 1.4 * s;
                group.add(label);
                return group;
            }

            // ===== 僵尸 ZOMBIE：绿皮肤、深色衣服、伸臂 =====
            if (nameKey === 'MOM') {
                // 头部
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.4 * s, 0.4 * s), headMat);
                head.position.y = 1.2 * s;
                group.add(head);
                // 红眼
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.02 * s), eyeMat);
                eyeL.position.set(-0.08 * s, 1.22 * s, 0.21 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.08 * s;
                group.add(eyeR);
                // 身体（深色衣服）
                const bodyMat = mat;
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.5 * s, 0.25 * s), bodyMat);
                body.position.y = 0.65 * s;
                group.add(body);
                // 破烂下摆
                const tatterMat = new THREE.MeshLambertMaterial({ color: 0x224422 });
                const tatter = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.1 * s, 0.27 * s), tatterMat);
                tatter.position.y = 0.4 * s;
                group.add(tatter);
                // 手臂（前伸）
                const armMat = new THREE.MeshLambertMaterial({ color: mobType.bodyColor });
                const armGeo = new THREE.BoxGeometry(0.12 * s, 0.4 * s, 0.12 * s);
                const armL = new THREE.Mesh(armGeo, armMat);
                armL.position.set(-0.3 * s, 0.65 * s, 0.1 * s);
                armL.rotation.x = -0.5;
                group.add(armL);
                const armR = armL.clone();
                armR.position.x = 0.3 * s;
                group.add(armR);
                // 腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0x335533 });
                const legGeo = new THREE.BoxGeometry(0.15 * s, 0.4 * s, 0.15 * s);
                const legL = new THREE.Mesh(legGeo, legMat);
                legL.position.set(-0.12 * s, 0.2 * s, 0);
                group.add(legL);
                const legR = legL.clone();
                legR.position.x = 0.12 * s;
                group.add(legR);
                // 脚
                const footMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                const footGeo = new THREE.BoxGeometry(0.14 * s, 0.08 * s, 0.18 * s);
                const footL = new THREE.Mesh(footGeo, footMat);
                footL.position.set(-0.12 * s, 0.04 * s, 0.02 * s);
                group.add(footL);
                const footR = footL.clone();
                footR.position.x = 0.12 * s;
                group.add(footR);
                const label = makeNameTag(mobType.name, '#ff5555', mobType.pinyin, texKey);
                label.position.y = 1.6 * s;
                group.add(label);
                return group;
            }

            // ===== 骷髅 SKELETON：白骨、肋骨、头骨 =====
            if (nameKey === 'RUYI') {
                // 头骨
                const boneMat = headMat;
                const skull = new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.35 * s, 0.3 * s), boneMat);
                skull.position.y = 1.2 * s;
                group.add(skull);
                // 眼窝
                const socketMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const socketL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.02 * s), socketMat);
                socketL.position.set(-0.07 * s, 1.22 * s, 0.16 * s);
                group.add(socketL);
                const socketR = socketL.clone();
                socketR.position.x = 0.07 * s;
                group.add(socketR);
                // 牙齿
                const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.04 * s, 0.02 * s), boneMat);
                teeth.position.set(0, 1.1 * s, 0.16 * s);
                group.add(teeth);
                // 肋骨
                const ribMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
                for (let i = 0; i < 3; i++) {
                    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s - i * 0.02, 0.04 * s, 0.2 * s), ribMat);
                    rib.position.y = 0.85 * s - i * 0.1 * s;
                    group.add(rib);
                }
                // 脊椎
                const spine = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.4 * s, 0.06 * s), boneMat);
                spine.position.y = 0.7 * s;
                group.add(spine);
                // 手臂（细长骨）
                const armMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
                const armGeo = new THREE.BoxGeometry(0.06 * s, 0.4 * s, 0.06 * s);
                const armL = new THREE.Mesh(armGeo, armMat);
                armL.position.set(-0.25 * s, 0.7 * s, 0);
                group.add(armL);
                const armR = armL.clone();
                armR.position.x = 0.25 * s;
                group.add(armR);
                // 前臂
                const forearmL = new THREE.Mesh(armGeo, armMat);
                forearmL.position.set(-0.25 * s, 0.3 * s, 0.1 * s);
                forearmL.rotation.x = -0.3;
                group.add(forearmL);
                const forearmR = forearmL.clone();
                forearmR.position.x = 0.25 * s;
                group.add(forearmR);
                // 腿
                const legMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
                const legGeo = new THREE.BoxGeometry(0.08 * s, 0.4 * s, 0.08 * s);
                const legL = new THREE.Mesh(legGeo, legMat);
                legL.position.set(-0.1 * s, 0.2 * s, 0);
                group.add(legL);
                const legR = legL.clone();
                legR.position.x = 0.1 * s;
                group.add(legR);
                const label = makeNameTag(mobType.name, '#ff5555', mobType.pinyin, texKey);
                label.position.y = 1.6 * s;
                group.add(label);
                return group;
            }

            // ===== 末影人 ENDERMAN：高大瘦长、黑色身体、白色眼睛、漂浮 =====
            if (nameKey === 'UNCLE') {
                // 头部（瘦长）- 使用纹理材质
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.4 * s, 0.25 * s), headMat);
                head.position.y = 1.5 * s;
                group.add(head);
                // 白色眼睛（发光）
                const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff00ff });
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.04 * s, 0.02 * s), eyeMat);
                eyeL.position.set(-0.06 * s, 1.5 * s, 0.13 * s);
                group.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = 0.06 * s;
                group.add(eyeR);
                // 身体（瘦长）- 使用纹理材质
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.6 * s, 0.15 * s), mat);
                body.position.y = 0.8 * s;
                group.add(body);
                // 手臂（细长）- 使用纹理材质
                const armGeo = new THREE.BoxGeometry(0.06 * s, 0.7 * s, 0.06 * s);
                const armL = new THREE.Mesh(armGeo, mat);
                armL.position.set(-0.22 * s, 0.8 * s, 0);
                group.add(armL);
                const armR = armL.clone();
                armR.position.x = 0.22 * s;
                group.add(armR);
                // 腿（细长）- 使用纹理材质
                const legGeo = new THREE.BoxGeometry(0.08 * s, 0.6 * s, 0.08 * s);
                const legL = new THREE.Mesh(legGeo, mat);
                legL.position.set(-0.1 * s, 0.2 * s, 0);
                group.add(legL);
                const legR = legL.clone();
                legR.position.x = 0.1 * s;
                group.add(legR);
                // 粒子效果（紫色粒子）
                const particleMat = new THREE.MeshLambertMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5 });
                for (let i = 0; i < 5; i++) {
                    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 4, 4), particleMat);
                    particle.position.set((Math.random() - 0.5) * 0.5 * s, Math.random() * 2 * s, (Math.random() - 0.5) * 0.5 * s);
                    group.add(particle);
                }
                const label = makeNameTag(mobType.name, '#ff5555', mobType.pinyin, texKey);
                label.position.y = 2.0 * s;
                group.add(label);
                return group;
            }

            // ===== 保护神 GRANDPA/GRANDMA：高大、有脸 =====
            if (mobType.guardian) {
                const bodyMat = mat;
                // 头部
                const hs = 0.5 * s;
                const head = new THREE.Mesh(new THREE.BoxGeometry(hs, hs, hs), headMat);
                head.position.y = 1.3 * s;
                group.add(head);
                // 眼睛
                const eyeMat = new THREE.MeshLambertMaterial({ color: mobType.eyeColor || 0x000000 });
                const eyeSize = hs * 0.15;
                const eyeGeo = new THREE.BoxGeometry(eyeSize, eyeSize, eyeSize * 0.5);
                const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
                eyeL.position.set(-hs * 0.2, hs * 0.1, hs * 0.5);
                head.add(eyeL);
                const eyeR = eyeL.clone();
                eyeR.position.x = hs * 0.2;
                head.add(eyeR);
                // 嘴巴
                const mouthMat = new THREE.MeshLambertMaterial({ color: 0x440000 });
                const mouth = new THREE.Mesh(new THREE.BoxGeometry(hs * 0.4, hs * 0.08, hs * 0.05), mouthMat);
                mouth.position.set(0, -hs * 0.2, hs * 0.5);
                head.add(mouth);
                // 头发/帽子（爷爷蓝帽，奶奶白发）
                if (nameKey === 'GRANDPA') {
                    const hatMat = new THREE.MeshLambertMaterial({ color: 0x224488 });
                    const hat = new THREE.Mesh(new THREE.BoxGeometry(hs * 1.1, hs * 0.15, hs * 1.1), hatMat);
                    hat.position.y = hs * 0.6;
                    head.add(hat);
                } else if (nameKey === 'GRANDMA') {
                    const hairMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                    const hair = new THREE.Mesh(new THREE.BoxGeometry(hs * 1.1, hs * 0.3, hs * 1.1), hairMat);
                    hair.position.y = hs * 0.5;
                    head.add(hair);
                    // 头发两侧
                    const hairL = new THREE.Mesh(new THREE.BoxGeometry(hs * 0.15, hs * 0.4, hs * 0.15), hairMat);
                    hairL.position.set(-hs * 0.5, hs * 0.2, 0);
                    head.add(hairL);
                    const hairR = hairL.clone();
                    hairR.position.x = hs * 0.5;
                    head.add(hairR);
                }
                // 身体
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.7 * s, 0.35 * s), bodyMat);
                body.position.y = 0.65 * s;
                group.add(body);
                // 腿
                const legGeo = new THREE.BoxGeometry(0.18 * s, 0.5 * s, 0.18 * s);
                const legL = new THREE.Mesh(legGeo, bodyMat);
                legL.position.set(-0.12 * s, 0.25 * s, 0);
                group.add(legL);
                const legR = legL.clone();
                legR.position.x = 0.12 * s;
                group.add(legR);
                // 脚
                const footMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                const footGeo = new THREE.BoxGeometry(0.16 * s, 0.1 * s, 0.2 * s);
                const footL = new THREE.Mesh(footGeo, footMat);
                footL.position.set(-0.12 * s, 0.05 * s, 0.02 * s);
                group.add(footL);
                const footR = footL.clone();
                footR.position.x = 0.12 * s;
                group.add(footR);
                // 手臂
                const armMat = new THREE.MeshLambertMaterial({ color: mobType.bodyColor });
                const armGeo = new THREE.BoxGeometry(0.15 * s, 0.45 * s, 0.15 * s);
                const armL = new THREE.Mesh(armGeo, armMat);
                armL.position.set(-0.35 * s, 0.6 * s, 0);
                group.add(armL);
                const armR = armL.clone();
                armR.position.x = 0.35 * s;
                group.add(armR);
                // 手
                const handGeo = new THREE.BoxGeometry(0.14 * s, 0.14 * s, 0.14 * s);
                const handL = new THREE.Mesh(handGeo, armMat);
                handL.position.set(-0.35 * s, 0.38 * s, 0);
                group.add(handL);
                const handR = handL.clone();
                handR.position.x = 0.35 * s;
                group.add(handR);
                // 标签
                const label = makeNameTag(mobType.name, '#ffcc00', mobType.pinyin, texKey);
                label.position.y = 2.0 * s;
                label.scale.set(4.0, 1.28, 1);
                group.add(label);
                return group;
            }

            // ===== 通用模型（后备） =====
            // 头部
            const hs = 0.5 * s;
            const head = new THREE.Mesh(new THREE.BoxGeometry(hs, hs, hs), headMat);
            head.position.y = 1.3 * s;
            group.add(head);

            // 兔子长耳朵
            if (mobType.ears) {
                const earMat = new THREE.MeshLambertMaterial({ color: mobType.headColor });
                const earGeo = new THREE.BoxGeometry(hs * 0.12, hs * 1.8, hs * 0.12);
                const earL = new THREE.Mesh(earGeo, earMat);
                earL.position.set(-hs * 0.25, hs * 1.1, 0);
                earL.rotation.z = 0.1;
                head.add(earL);
                const earR = earL.clone();
                earR.position.x = hs * 0.25;
                earR.rotation.z = -0.1;
                head.add(earR);
            }

            // 身体
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.7 * s, 0.35 * s), mat);
            body.position.y = 0.65 * s;
            group.add(body);

            // 腿
            const lc = (mobType.legs !== undefined) ? mobType.legs : 2;
            if (lc === 2) {
                const legGeo = new THREE.BoxGeometry(0.18 * s, 0.5 * s, 0.18 * s);
                const legL = new THREE.Mesh(legGeo, mat);
                legL.position.set(-0.12 * s, 0.25 * s, 0);
                const legR = legL.clone();
                legR.position.x = 0.12 * s;
                group.add(legL, legR);
                // 手臂
                const armMat = new THREE.MeshLambertMaterial({ color: mobType.headColor || mobType.bodyColor });
                const armGeo = new THREE.BoxGeometry(0.15 * s, 0.45 * s, 0.15 * s);
                const armL = new THREE.Mesh(armGeo, armMat);
                armL.position.set(-0.35 * s, 0.6 * s, 0);
                group.add(armL);
                const armR = armL.clone();
                armR.position.x = 0.35 * s;
                group.add(armR);
            } else if (lc === 4) {
                const legGeo = new THREE.BoxGeometry(0.18 * s, 0.45 * s, 0.18 * s);
                const legFL = new THREE.Mesh(legGeo, mat);
                legFL.position.set(-0.14 * s, 0.225 * s, 0.12 * s);
                const legFR = legFL.clone();
                legFR.position.x = 0.14 * s;
                const legBL = legFL.clone();
                legBL.position.z = -0.12 * s;
                const legBR = legFL.clone();
                legBR.position.set(0.14 * s, 0.225 * s, -0.12 * s);
                group.add(legFL, legFR, legBL, legBR);
            } else if (lc === 8) {
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.35 * s, 0.07 * s), mat);
                    leg.position.set(Math.cos(a) * 0.22 * s, 0.18 * s, Math.sin(a) * 0.22 * s);
                    leg.rotation.y = a;
                    group.add(leg);
                }
            }

            // 翅膀
            if (mobType.wings) {
                const wingGeo = new THREE.BoxGeometry(0.55 * s, 0.03 * s, 0.18 * s);
                const wingL = new THREE.Mesh(wingGeo, mat);
                wingL.position.set(-0.4 * s, 0.7 * s, 0);
                group.add(wingL);
                const wingR = wingL.clone();
                wingR.position.x = 0.4 * s;
                group.add(wingR);
            }

            // 名字标签
            const label = makeNameTag(mobType.name, mobType.hostile ? '#ff5555' : '#55ff55', mobType.pinyin, mobType.textureKey);
            label.position.y = 1.8 * s;
            group.add(label);

            return group;
        }

        // 5.1 在地图上生成怪物与动物
        // 判断位置是否在禁止怪物生成的区域（出生点 + 城市传送点）
        function isInNoMobZone(x, z) {
            // 出生点周围60格（确保出生地安全）
            if (Math.abs(x - spawnX) < 60 && Math.abs(z - spawnZ) < 60) return true;
            // 城市传送点周围20格（城市周围无怪物）
            if (typeof CITY_TELEPORTS !== 'undefined') {
                for (const city of CITY_TELEPORTS) {
                    if (Math.abs(x - city.x) < 20 && Math.abs(z - city.z) < 20) return true;
                }
            }
            // 副本入口周围25格
            if (typeof dungeonEntrances !== 'undefined' && dungeonEntrances) {
                for (const entrance of dungeonEntrances) {
                    if (Math.abs(x - entrance.x) < 25 && Math.abs(z - entrance.z) < 25) return true;
                }
            }
            return false;
        }

        function spawnMobs() {
            const half = Math.floor(WORLD_SIZE / 2) - 2;
            
            // 怪物类型定义（随机分布在各城市附近野外）
            const MOB_PLANS = [
                { type: MOB_TYPES.CREEPER,   count: 30, hp: 10 },
                { type: MOB_TYPES.ZOMBIE,    count: 30, hp: 12 },
                { type: MOB_TYPES.SKELETON,  count: 30, hp: 8 },
                { type: MOB_TYPES.SPIDER,    count: 30, hp: 10 },
                { type: MOB_TYPES.ENDERMAN,  count: 30, hp: 20 },
                { type: MOB_TYPES.PIG,       count: 30, hp: 10 },
                { type: MOB_TYPES.WOLF,      count: 30, hp: 8 },
                { type: MOB_TYPES.COW,       count: 30, hp: 10 },
                { type: MOB_TYPES.SHEEP,     count: 30, hp: 8 },
                { type: MOB_TYPES.CHICKEN,   count: 30, hp: 4 },
                { type: MOB_TYPES.RABBIT,    count: 30, hp: 3 },
                { type: MOB_TYPES.BAT,       count: 30, hp: 2 },
            ];
            
            const spawnedPositions = [];
            const MIN_DIST = 8;
            
            // 城市列表（用于分布怪物）
            const cities = CITY_TELEPORTS || [];
            const numCities = Math.max(1, cities.length);
            const perCity = Math.ceil(30 / numCities); // 每种怪物每个城市生成数量
            
            // 城市附近的生成范围
            const CITY_SPREAD_MIN = 25;  // 城市外25格开始生成
            const CITY_SPREAD_MAX = 80;  // 最远80格
            
            // 出生点附近保留少量怪物（出生点外75-200格）
            const SPAWN_SPREAD_MIN = 75;
            const SPAWN_SPREAD_MAX = 200;
            
            MOB_PLANS.forEach((plan) => {
                // 为每个城市生成候选位置
                cities.forEach((city, cityIdx) => {
                    const targetCount = Math.min(perCity, plan.count);
                    const candidates = [];
                    let sampled = 0;
                    const maxSamples = 200;
                    
                    while (candidates.length < targetCount * 3 && sampled < maxSamples) {
                        sampled++;
                        // 极坐标随机：角度0-360，距离在CITY_SPREAD_MIN到CITY_SPREAD_MAX之间
                        const angle = Math.random() * Math.PI * 2;
                        const dist = CITY_SPREAD_MIN + Math.random() * (CITY_SPREAD_MAX - CITY_SPREAD_MIN);
                        const x = Math.floor(city.x + Math.cos(angle) * dist);
                        const z = Math.floor(city.z + Math.sin(angle) * dist);
                        
                        // 排除安全区域（出生点、城市、副本入口）
                        if (isInNoMobZone(x, z)) continue;
                        
                        const h = getTerrainHeight(x, z);
                        if (h <= WATER_LEVEL + 1) continue;
                        
                        // 检查水方块
                        let inWater = false;
                        for (let wy = Math.floor(h) - 1; wy <= Math.floor(h) + 2; wy++) {
                            const waterKey = `${x},${wy},${z}`;
                            if (blocksMap.has(waterKey) && blocksMap.get(waterKey).typeId === BLOCK_TYPES.WATER.id) {
                                inWater = true;
                                break;
                            }
                        }
                        if (inWater) continue;
                        
                        // 检查树顶（上方4格内有树叶或原木则不生成）
                        let onTreeTop = false;
                        for (let ty = Math.floor(h) + 1; ty <= Math.floor(h) + 4; ty++) {
                            const leafKey = `${x},${ty},${z}`;
                            if (blocksMap.has(leafKey)) {
                                const bt = blocksMap.get(leafKey).typeId;
                                if (bt === BLOCK_TYPES.LEAVES.id || bt === BLOCK_TYPES.WOOD.id) {
                                    onTreeTop = true;
                                    break;
                                }
                            }
                        }
                        if (onTreeTop) continue;
                        
                        candidates.push({ x, z, h });
                    }
                    
                    // 随机打乱
                    for (let i = candidates.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                    }
                    
                    // 选取最佳位置（距离其他怪物最远）
                    for (let i = 0; i < targetCount && i < candidates.length; i++) {
                        let bestSpot = null;
                        let bestMinDist = -1;
                        
                        for (const candidate of candidates) {
                            let minD = 999;
                            for (const sp of spawnedPositions) {
                                const d = Math.hypot(candidate.x - sp.x, candidate.z - sp.z);
                                if (d < minD) minD = d;
                            }
                            if (minD > bestMinDist) {
                                bestMinDist = minD;
                                bestSpot = candidate;
                            }
                        }
                        
                        if (!bestSpot) continue;
                        spawnedPositions.push({ x: bestSpot.x, z: bestSpot.z });
                        
                        const mesh = createMobMesh(plan.type);
                        mesh.position.set(bestSpot.x + 0.5, bestSpot.h + 1, bestSpot.z + 0.5);
                        
                        // 敌对怪物添加血条
                        let healthBar = null;
                        if (plan.type.hostile) {
                            healthBar = createHealthBar(plan.hp);
                            healthBar.position.y = 2.0 * (plan.type.scale || 1.0);
                            mesh.add(healthBar);
                        }
                        
                        scene.add(mesh);
                        mobs.push({
                            type: plan.type,
                            mesh: mesh,
                            hp: plan.hp,
                            maxHp: plan.hp,
                            healthBar: healthBar,
                            wanderTimer: Math.random() * 2,
                            wanderDirX: Math.random() - 0.5,
                            wanderDirZ: Math.random() - 0.5,
                            idleTimer: Math.random() * 3,
                            prevX: mesh.position.x,
                            prevZ: mesh.position.z,
                            alive: true,
                            // 每个怪物以自己的出生点为领地中心，半径35
                            territoryCenter: { x: bestSpot.x, z: bestSpot.z },
                            territoryRadius: 35,
                            territoryName: '野外'
                        });
                    }
                });
                
                // 出生点附近补充少量怪物（确保有怪物在出生点附近）
                const spawnCandidates = [];
                let spawnSampled = 0;
                const spawnMaxSamples = 100;
                while (spawnCandidates.length < 3 && spawnSampled < spawnMaxSamples) {
                    spawnSampled++;
                    const angle = Math.random() * Math.PI * 2;
                    const dist = SPAWN_SPREAD_MIN + Math.random() * (SPAWN_SPREAD_MAX - SPAWN_SPREAD_MIN);
                    const x = Math.floor(spawnX + Math.cos(angle) * dist);
                    const z = Math.floor(spawnZ + Math.sin(angle) * dist);
                    
                    if (isInNoMobZone(x, z)) continue;
                    
                    const h = getTerrainHeight(x, z);
                    if (h <= WATER_LEVEL + 1) continue;
                    
                    let inWater = false;
                    for (let wy = Math.floor(h) - 1; wy <= Math.floor(h) + 2; wy++) {
                        const waterKey = `${x},${wy},${z}`;
                        if (blocksMap.has(waterKey) && blocksMap.get(waterKey).typeId === BLOCK_TYPES.WATER.id) {
                            inWater = true;
                            break;
                        }
                    }
                    if (inWater) continue;
                    
                    let onTreeTop = false;
                    for (let ty = Math.floor(h) + 1; ty <= Math.floor(h) + 4; ty++) {
                        const leafKey = `${x},${ty},${z}`;
                        if (blocksMap.has(leafKey)) {
                            const bt = blocksMap.get(leafKey).typeId;
                            if (bt === BLOCK_TYPES.LEAVES.id || bt === BLOCK_TYPES.WOOD.id) {
                                onTreeTop = true;
                                break;
                            }
                        }
                    }
                    if (onTreeTop) continue;
                    
                    spawnCandidates.push({ x, z, h });
                }
                
                for (let i = 0; i < spawnCandidates.length; i++) {
                    const spot = spawnCandidates[i];
                    spawnedPositions.push({ x: spot.x, z: spot.z });
                    
                    const mesh = createMobMesh(plan.type);
                    mesh.position.set(spot.x + 0.5, spot.h + 1, spot.z + 0.5);
                    
                    let healthBar = null;
                    if (plan.type.hostile) {
                        healthBar = createHealthBar(plan.hp);
                        healthBar.position.y = 2.0 * (plan.type.scale || 1.0);
                        mesh.add(healthBar);
                    }
                    
                    scene.add(mesh);
                    mobs.push({
                        type: plan.type,
                        mesh: mesh,
                        hp: plan.hp,
                        maxHp: plan.hp,
                        healthBar: healthBar,
                        wanderTimer: Math.random() * 2,
                        wanderDirX: Math.random() - 0.5,
                        wanderDirZ: Math.random() - 0.5,
                        idleTimer: Math.random() * 3,
                        prevX: mesh.position.x,
                        prevZ: mesh.position.z,
                        alive: true,
                        territoryCenter: { x: spot.x, z: spot.z },
                        territoryRadius: 35,
                        territoryName: '野外'
                    });
                }
            });

            // === 保护神：放在出生点附近的平坦陆地上 ===
            // 使用玩家出生点位置（确保有陆地）
            const baseX = spawnX;
            const baseZ = spawnZ;
            const baseH = getGroundY(baseX, baseZ);
            
            // 奶奶和爷爷分开摆放（12格距离，确保不重叠 - 保护神体型是10倍大！）
            const gmX = baseX - 12, gmZ = baseZ;
            const gpX = baseX + 12, gpZ = baseZ;
            
            // 在保护神位置生成一个平坦区域（40x40），确保周围没有水和障碍物
            // 保护神体型10倍大，碰撞半宽3格，需要足够大的平坦区域才能移动
            const flatY = Math.max(baseH, WATER_LEVEL + 2);
            for (let dx = -20; dx <= 20; dx++) {
                for (let dz = -20; dz <= 20; dz++) {
                    const x = baseX + dx, z = baseZ + dz;
                    // 检查当前地面高度（从blocksMap获取）
                    const currentGround = getGroundY(x, z);
                    if (currentGround <= WATER_LEVEL + 1) {
                        // 如果是水或低洼地，生成陆地（使用泥土，不用草地）
                        const y = Math.floor(flatY);
                        addBlock(x, y, z, BLOCK_TYPES.DIRT);
                        addBlock(x, y - 1, z, BLOCK_TYPES.DIRT);
                        addBlock(x, y - 2, z, BLOCK_TYPES.STONE);
                    }
                    // 清除保护神周围的树木和方块（防止卡住）
                    if (Math.abs(dx) < 18 && Math.abs(dz) < 18) {
                        // 清除该位置上方的树木方块
                        for (let ty = flatY + 1; ty < flatY + 8; ty++) {
                            const key = `${x},${ty},${z}`;
                            if (blocksMap.has(key)) {
                                forceRemoveBlock(key);
                            }
                        }
                    }
                }
            }
            
            // 重新获取奶奶和爷爷位置的地面高度
            const gmGroundY = getGroundY(gmX, gmZ);
            const gpGroundY = getGroundY(gpX, gpZ);
            
            // 确保保护神位置完全清空（向上16格，保护神高15.5格）
            for (const [gx, gz] of [[gmX, gmZ], [gpX, gpZ]]) {
                for (let ty = gmGroundY + 1; ty < gmGroundY + 18; ty++) {
                    const key = `${gx},${ty},${gz}`;
                    if (blocksMap.has(key)) {
                        forceRemoveBlock(key);
                    }
                }
            }
            
            const guardians = [
                { type: MOB_TYPES.GRANDMA, pos: { x: gmX, z: gmZ }, groundY: gmGroundY },
                { type: MOB_TYPES.GRANDPA, pos: { x: gpX, z: gpZ }, groundY: gpGroundY }
            ];
            guardians.forEach(g => {
                const mesh = createMobMesh(g.type);
                // 保护神体型10倍大，mesh原点已在脚底，直接放在地面高度
                mesh.position.set(g.pos.x + 0.5, g.groundY, g.pos.z + 0.5);
                scene.add(mesh);
                mobs.push({
                    type: g.type,
                    mesh: mesh,
                    guardian: true,
                    wanderTimer: 3 + Math.random() * 5,
                    wanderDirX: (Math.random() - 0.5) * 0.3,
                    wanderDirZ: (Math.random() - 0.5) * 0.3,
                    idleTimer: 0,
                    prevX: mesh.position.x,
                    prevZ: mesh.position.z,
                    alive: true,
                    speed: 1.2  // 保护神移动速度
                });
            });
        }

        // === 作物生长系统 ===
        let cropGrowthTimer = 0;
        function updateCrops(delta) {
            cropGrowthTimer += delta;
            if (cropGrowthTimer < CROP_GROWTH_INTERVAL) return;
            cropGrowthTimer = 0;
            
            // 遍历所有作物方块，推进生长阶段
            for (const [key, stage] of cropStages) {
                if (stage >= CROP_FULL_STAGE) continue; // 已成熟
                // 检查作物方块是否还在
                if (!blocksMap.has(key)) {
                    cropStages.delete(key);
                    continue;
                }
                const newStage = stage + 1;
                cropStages.set(key, newStage);
                // 更新作物方块颜色（根据生长阶段变色）
                updateCropVisual(key, newStage);
            }
        }
        
        function updateCropVisual(key, stage) {
            const rec = blocksMap.get(key);
            if (!rec) return;
            const id = rec.typeId;
            const instId = rec.instId;
            const im = instancedMeshes[id];
            if (!im) return;
            
            // 根据生长阶段设置不同颜色（从浅绿到深绿）
            const colors = [
                0x88cc44, // stage 0: 嫩芽
                0x66aa22, // stage 1
                0x44aa22, // stage 2
                0x33aa11, // stage 3
                0x22aa00, // stage 4
                0x22aa44, // stage 5
                0x22bb44, // stage 6
                0xffaa00, // stage 7: 成熟（金色）
            ];
            const color = colors[Math.min(stage, CROP_FULL_STAGE)];
            // InstancedMesh 不支持逐实例颜色，所以用整体材质颜色作为近似
            // 实际上作物方块统一显示绿色，成熟时通过 HUD 提示
        }

        // 5.2 怪物 AI：玩家靠近时追击 + 平时随机游荡
        // === 性能优化：距离LOD + 交替AI更新 ===
        let mobAIFrame = 0;
        const MOB_AI_INTERVAL = 3;      // 每个怪物每3帧更新一次AI（约20fps）
        const MOB_FAR_DIST = 100;       // 超过100格距离跳过AI
        const MOB_FAR_CULL = 150;       // 超过150格隐藏渲染（减少draw call）

        function updateMobs(delta) {
            const playerPos = playerModel ? playerModel.position : controls.getObject().position;
            mobAIFrame++;
            
            // === 护盾计时器（全局，每帧递减一次）===
            if (playerShieldTimer > 0) {
                playerShieldTimer -= delta;
                if (playerShieldTimer <= 0) {
                    playerShield = false;
                }
            }

            for (let i = mobs.length - 1; i >= 0; i--) {
                const mob = mobs[i];
                if (!mob.alive) {
                    scene.remove(mob.mesh);
                    mobs.splice(i, 1);
                    continue;
                }
                
                // === 距离LOD：远距离怪物冻结AI + 隐藏渲染 ===
                const pos = mob.mesh.position;
                const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
                
                if (distToPlayer > MOB_FAR_CULL) {
                    // 极远：隐藏渲染（减少draw call），不更新AI
                    if (mob.mesh.visible) mob.mesh.visible = false;
                    continue;
                } else if (!mob.mesh.visible) {
                    // 进入可见范围：恢复显示
                    mob.mesh.visible = true;
                }
                
                // 🐾 宠物行为：跟随玩家，跳过正常AI
                if (mob.pet) {
                    updatePetBehavior(mob, delta);
                    executeNightAbility(mob);
                    continue;
                }
                
                // === 交替AI更新：每3帧更新一次 ===
                if (mobAIFrame % MOB_AI_INTERVAL !== i % MOB_AI_INTERVAL) {
                    // 本帧不更新AI，但保持可见
                    // 执行夜晚技能（轻量操作）
                    executeNightAbility(mob);
                    continue;
                }
                
                // 远处怪物（>100格）只做轻量更新
                if (distToPlayer > MOB_FAR_DIST) {
                    executeNightAbility(mob);
                    continue;
                }
                
                // 确定移动方向和速度
                let dirX = 0, dirZ = 0, speed = 0;
                // 副本怪物始终追击（不受白天/黑夜影响）
                const isDungeonMob = mob.dungeonMob;
                
                // 激怒计时器倒计时
                if (mob.provokeTimer > 0) {
                    mob.provokeTimer -= delta;
                    if (mob.provokeTimer <= 0) {
                        mob.provoked = false;
                        mob.provokeTimer = 0;
                    }
                }
                
                // 判断是否在领地内（玩家位置相对于怪物领地中心）
                const distToTerritory = mob.territoryCenter 
                    ? Math.hypot(playerPos.x - mob.territoryCenter.x, playerPos.z - mob.territoryCenter.z) 
                    : 999;
                const inTerritory = distToTerritory < (mob.territoryRadius || 25) + 10;
                
                // 追击逻辑：
                // 1. 副本怪物：始终追击
                // 2. 被激怒的怪物：追击（15秒内，不限白天黑夜）
                // 3. 夜晚 + 领地内：追击（只有玩家进入领地才攻击）
                // 追击逻辑：
                // 1. 副本怪物：始终追击（不受昼夜影响）
                // 2. 夜晚 + (激怒或领地内) + 距离<30：追击
                // 3. 白天：不追击（即使被攻击也不追击，和平模式）
                const isProvoked = mob.provoked && mob.provokeTimer > 0;
                const isNight = !isDaytime();
                // 答题时或白天：所有怪物（含副本）都不追击玩家
                const isChasing = mob.type.hostile && !playerInvulnerable && (
                    (isDungeonMob && isNight) ||
                    (!isDungeonMob && isNight && (isProvoked || inTerritory) && distToPlayer < 30)
                );
                const isFleeing = mob.fleeing && mob.fleeTimer > 0;

                if (isFleeing) {
                    // 逃跑：远离玩家
                    mob.fleeTimer -= delta;
                    if (mob.fleeTimer <= 0) {
                        mob.fleeing = false;
                    } else {
                        const dir = new THREE.Vector3().subVectors(pos, playerPos).setY(0);
                        if (dir.length() > 0.01) dir.normalize();
                        dirX = dir.x;
                        dirZ = dir.z;
                        speed = (mob.speed || mob.type.speed) * 3.0;
                    }
                } else if (isChasing) {
                    // 夜晚追击玩家
                    const dir = new THREE.Vector3().subVectors(playerPos, pos).setY(0);
                    if (dir.length() > 0.01) dir.normalize();
                    dirX = dir.x;
                    dirZ = dir.z;
                    speed = (mob.speed || mob.type.speed) * 2.2;
                    mob.wanderTimer = 0;
                } else {
                    // 自由游荡：保持固定方向，定期更换
                    mob.wanderTimer -= delta;
                    if (mob.wanderTimer <= 0) {
                        const angle = Math.random() * Math.PI * 2;
                        mob.wanderDirX = Math.cos(angle);
                        mob.wanderDirZ = Math.sin(angle);
                        // 保护神更换方向频率更低，移动更稳定
                        if (mob.guardian) {
                            mob.wanderTimer = 4.0 + Math.random() * 6.0;
                        } else {
                            mob.wanderTimer = 1.5 + Math.random() * 3.5;
                        }
                    }
                    dirX = mob.wanderDirX;
                    dirZ = mob.wanderDirZ;
                    // 保护神移动更慢，避免抖动
                    if (mob.guardian) {
                        speed = (mob.speed || mob.type.speed) * 0.7;
                    } else {
                        speed = (mob.speed || mob.type.speed) * 0.9;
                    }
                }

                // 计算移动量（let：追击遇障碍/水时会重算方向）
                let moveX = dirX * speed * delta;
                let moveZ = dirZ * speed * delta;

                // 副本怪物边界限制（防止逃出房间）
                if (isDungeonMob) {
                    const dMinX = DUNGEON_ORIGIN_X - DUNGEON_HALF + 1;
                    const dMaxX = DUNGEON_ORIGIN_X + DUNGEON_HALF - 1;
                    const dMinZ = DUNGEON_ORIGIN_Z - DUNGEON_HALF + 1;
                    const dMaxZ = DUNGEON_ORIGIN_Z + DUNGEON_HALF - 1;
                    if (pos.x < dMinX) { pos.x = dMinX; mob.wanderDirX = Math.abs(mob.wanderDirX || 0.1); }
                    if (pos.x > dMaxX) { pos.x = dMaxX; mob.wanderDirX = -Math.abs(mob.wanderDirX || 0.1); }
                    if (pos.z < dMinZ) { pos.z = dMinZ; mob.wanderDirZ = Math.abs(mob.wanderDirZ || 0.1); }
                    if (pos.z > dMaxZ) { pos.z = dMaxZ; mob.wanderDirZ = -Math.abs(mob.wanderDirZ || 0.1); }
                }
                
                // 检查前方是否安全（水、悬崖、方块碰撞）——飞行生物跳过此检查
                if (!mob.type.flying) {
                    const mobHalfW = mob.guardian ? 1.5 : 0.3 * (mob.type.scale || 1.0);
                    const mobHeight = mob.guardian ? 16 : 1.4 * (mob.type.scale || 1.0);
                    
                    // 脱困检查：如果怪物当前位置在方块内部，向上推出
                    if (checkCollision(pos.x, pos.y, pos.z, mobHalfW, mobHeight)) {
                        for (let step = 0.1; step <= 3.0; step += 0.1) {
                            if (!checkCollision(pos.x, pos.y + step, pos.z, mobHalfW, mobHeight)) {
                                pos.y += step;
                                break;
                            }
                        }
                    }
                    
                    const nextX = Math.floor(pos.x + moveX);
                    const nextZ = Math.floor(pos.z + moveZ);
                    const nextH = getTerrainHeight(nextX, nextZ);
                    const currH = getTerrainHeight(Math.floor(pos.x), Math.floor(pos.z));
                    
                    // 检查是否进入水中（所有怪物都不能进入水中）
                    if (nextH <= WATER_LEVEL) {
                        if (!isChasing) {
                            mob.wanderDirX *= -1;
                            mob.wanderDirZ *= -1;
                            mob.wanderTimer = 1.0;
                        } else {
                            // 追击时也不能进入水中，反向移动
                            dirX = -dirX;
                            dirZ = -dirZ;
                            moveX = dirX * speed * delta;
                            moveZ = dirZ * speed * delta;
                            mob.wanderDirX *= -1;
                            mob.wanderDirZ *= -1;
                            mob.wanderTimer = 1.0;
                        }
                    } else if (nextH > currH + 2 && !isChasing) {
                        // 前方悬崖（落差>2格），反向
                        mob.wanderDirX *= -1;
                        mob.wanderDirZ *= -1;
                        mob.wanderTimer = 1.0;
                    } else {
                        // 检查方块碰撞
                        const newX = pos.x + moveX;
                        const newZ = pos.z + moveZ;
                        
                        if (checkCollision(newX, pos.y, newZ, mobHalfW, mobHeight)) {
                            // 碰撞方块 - 尝试自动上台阶
                            if (!checkCollision(newX, pos.y + 1.0, newZ, mobHalfW, mobHeight)) {
                                // 上台阶成功：抬腿 + 水平移动 + 吸附到台阶顶
                                pos.x = newX;
                                pos.z = newZ;
                                pos.y = pos.y + 1.0;
                            } else {
                                // 无法上台阶，反向移动
                                if (!isChasing) {
                                    mob.wanderDirX *= -1;
                                    mob.wanderDirZ *= -1;
                                    mob.wanderTimer = 1.0;
                                } else {
                                    dirX = -dirX;
                                    dirZ = -dirZ;
                                    moveX = dirX * speed * delta;
                                    moveZ = dirZ * speed * delta;
                                    mob.wanderDirX *= -1;
                                    mob.wanderDirZ *= -1;
                                    mob.wanderTimer = 1.0;
                                }
                            }
                        } else {
                            // 没有碰撞，正常移动
                            pos.x += moveX;
                            pos.z += moveZ;
                            // 保护神限制在出生点附近15格范围内（可移动）
                            if (mob.guardian) {
                                if (Math.abs(pos.x - spawnX) > 20) { pos.x = spawnX + Math.sign(pos.x - spawnX) * 20; mob.wanderDirX *= -1; }
                                if (Math.abs(pos.z - spawnZ) > 20) { pos.z = spawnZ + Math.sign(pos.z - spawnZ) * 20; mob.wanderDirZ *= -1; }
                            }
                            // 领地边界检查（非飞行、非保护神怪物）
                            if (mob.territoryCenter && !mob.type.flying && !mob.guardian) {
                                const tc = mob.territoryCenter;
                                const tr = mob.territoryRadius;
                                const distToCenter = Math.hypot(pos.x - tc.x, pos.z - tc.z);
                                if (distToCenter > tr) {
                                    // 超出领地，回到边界并反向
                                    const angle = Math.atan2(pos.z - tc.z, pos.x - tc.x);
                                    pos.x = tc.x + Math.cos(angle) * tr;
                                    pos.z = tc.z + Math.sin(angle) * tr;
                                    mob.wanderDirX *= -1;
                                    mob.wanderDirZ *= -1;
                                    mob.wanderTimer = 1.0;
                                }
                            }
                            // 出生点排斥：非保护神、非飞行怪物不能进入出生点附近
                            if (!mob.guardian && !mob.type.flying) {
                                const distToSpawn = Math.hypot(pos.x - spawnX, pos.z - spawnZ);
                                if (distToSpawn < 60) {
                                    const angle = Math.atan2(pos.z - spawnZ, pos.x - spawnX);
                                    pos.x = spawnX + Math.cos(angle) * 60;
                                    pos.z = spawnZ + Math.sin(angle) * 60;
                                    mob.wanderDirX *= -1;
                                    mob.wanderDirZ *= -1;
                                    mob.wanderTimer = 2.0;
                                }
                            }
                        }
                    }
                } else {
                    // 飞行生物直接移动
                    pos.x += moveX;
                    pos.z += moveZ;
                }

                // 防卡地形：如果怪物长时间未移动，自动脱困
                if (!mob.type.flying && !mob._unstuckTimer) mob._unstuckTimer = 0;
                const movedDist = Math.hypot(pos.x - (mob._prevUnstuckX ?? pos.x), pos.z - (mob._prevUnstuckZ ?? pos.z));
                if (movedDist < 0.01) {
                    mob._unstuckTimer += delta;
                    if (mob._unstuckTimer > 2.0) {
                        // 尝试在附近寻找安全位置
                        const px = Math.floor(pos.x), pz = Math.floor(pos.z);
                        let safePos = null;
                        for (let r = 1; r <= 5 && !safePos; r++) {
                            for (let dx = -r; dx <= r && !safePos; dx++) {
                                for (let dz = -r; dz <= r && !safePos; dz++) {
                                    if (dx === 0 && dz === 0) continue;
                                    const nx = px + dx, nz = pz + dz;
                                    const h = getTerrainHeight(nx, nz);
                                    if (h > WATER_LEVEL + 1) {
                                        // 检查不是树顶
                                        let onTree = false;
                                        for (let ty = Math.floor(h) + 1; ty <= Math.floor(h) + 4; ty++) {
                                            if (blocksMap.has(`${nx},${ty},${nz}`)) {
                                                const bt = blocksMap.get(`${nx},${ty},${nz}`).typeId;
                                                if (bt === BLOCK_TYPES.LEAVES.id || bt === BLOCK_TYPES.WOOD.id) { onTree = true; break; }
                                            }
                                        }
                                        if (!onTree) safePos = { x: nx + 0.5, z: nz + 0.5, h };
                                    }
                                }
                            }
                        }
                        if (safePos) {
                            pos.x = safePos.x;
                            pos.z = safePos.z;
                            pos.y = safePos.h + 1;
                            mob._unstuckTimer = 0;
                            mob._prevUnstuckX = pos.x;
                            mob._prevUnstuckZ = pos.z;
                            // 随机方向，避免继续卡住
                            const angle = Math.random() * Math.PI * 2;
                            mob.wanderDirX = Math.cos(angle);
                            mob.wanderDirZ = Math.sin(angle);
                            mob.wanderTimer = 2.0;
                        } else {
                            mob._unstuckTimer = 0; // 找不到安全位置，重置避免重复搜索
                        }
                    }
                } else {
                    mob._unstuckTimer = 0;
                }
                mob._prevUnstuckX = pos.x;
                mob._prevUnstuckZ = pos.z;

                // 副本怪物接触伤害
                if (isDungeonMob && mob.type.hostile && distToPlayer < 1.8 && !playerInvulnerable) {
                    if (!mob._lastDamageTime || gameTime - mob._lastDamageTime > 1.0) {
                        const contactDmg = 3 + Math.floor(Math.random() * 3);
                        takeDamage(contactDmg);
                        mob._lastDamageTime = gameTime;
                        showStatus(`🔥 ${mob.type.name}攻击了你！`);
                        playHitSound();
                        // 受击击退
                        const knockbackDir = new THREE.Vector3().subVectors(playerPos, pos).setY(0);
                        if (knockbackDir.length() > 0.01) knockbackDir.normalize();
                        playerPos.x += knockbackDir.x * 0.5;
                        playerPos.z += knockbackDir.z * 0.5;
                    }
                }
                
                // 高度跟随
                if (mob.type.flying) {
                    // 飞行生物：悬停在固定高度，上下浮动
                    const groundY = getTerrainHeight(Math.floor(pos.x), Math.floor(pos.z));
                    const targetY = groundY + 3.5 + Math.sin(gameTime * 2 + i) * 0.5;
                    pos.y += (targetY - pos.y) * Math.min(1, 4 * delta);
                } else {
                    // 地面生物：平滑贴地
                    const scale = mob.type.scale || 1.0;
                    const feetOffset = (0.7 * scale) / 2;
                    
                    // 保护神体型大，使用更大的范围检测地面高度，避免抖动
                    let groundY;
                    if (mob.guardian) {
                        // 保护神：取周围多个点的地面高度平均值（用 getGroundY 获取方块顶面）
                        const gx = Math.floor(pos.x), gz = Math.floor(pos.z);
                        let heights = [];
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dz = -1; dz <= 1; dz++) {
                                heights.push(getGroundY(gx + dx, gz + dz));
                            }
                        }
                        groundY = heights.reduce((a, b) => a + b, 0) / heights.length;
                    } else {
                        groundY = getGroundY(pos.x, pos.z);
                    }
                    
                    // mesh原点已在脚底，targetY直接等于地面高度（无需额外偏移）
                    const targetY = groundY;
                    
                    // 保护神使用更慢的插值系数，避免抖动
                    if (mob.guardian) {
                        if (pos.y > targetY + 0.05) {
                            pos.y -= Math.min(2.0 * delta, pos.y - targetY);  // 防止过冲导致反弹
                        } else if (pos.y < targetY - 0.02) {
                            pos.y += (targetY - pos.y) * Math.min(1, 3.0 * delta);
                        }
                    } else {
                        if (pos.y > targetY + 0.1) {
                            pos.y -= 9.8 * delta * 2;
                        } else if (pos.y < targetY - 0.05) {
                            pos.y += (targetY - pos.y) * Math.min(1, 8 * delta);
                        }
                    }
                }

                // 让怪物面向移动方向
                if (Math.abs(moveX) > 0.0005 || Math.abs(moveZ) > 0.0005) {
                    mob.mesh.lookAt(pos.x + dirX, pos.y, pos.z + dirZ);
                }

                // 攻击逻辑：追击中的怪物 + 近距离 + 非飞行 = 攻击
                // 白天：只有被激怒才攻击
                // 夜晚：领地内才攻击
                // 副本：始终攻击
                if (mob.type.hostile && isChasing && !flying && distToPlayer < 1.0) {
                    const dir = new THREE.Vector3().subVectors(pos, playerPos).setY(0).normalize();
                    velocity.x -= dir.x * 8;
                    velocity.z -= dir.z * 8;
                    velocity.y += 4;
                    // 对玩家造成伤害（1秒冷却）
                    if (!mob.lastAttackTime || gameTime - mob.lastAttackTime > 1.0) {
                        takeDamage(2);
                        mob.lastAttackTime = gameTime;
                        showStatus(`⚠️ ${mob.type.name} 攻击了你！`);
                    }
                }
            }
        }

        // 5.3 第一人称手臂模型（挂在相机上，始终可见）
        function createPlayerArm() {
            const armGroup = new THREE.Group();

            const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8b78a });

            // 上臂
            const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.15), skinMat);
            upperArm.position.y = -0.15;
            armGroup.add(upperArm);

            // 前臂
            const foreArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), skinMat);
            foreArm.position.y = -0.45;
            armGroup.add(foreArm);

            // 拳头（手）
            const fist = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), skinMat);
            fist.position.y = -0.65;
            armGroup.add(fist);

            // 武器容器（挂在拳头/手上，武器向前指）
            const weaponGroup = new THREE.Group();
            weaponGroup.position.y = -0.68;
            weaponGroup.rotation.x = -(Math.PI / 2) + 0.2;  // 补偿手臂倾斜，武器指向正前方(-Z)
            armGroup.add(weaponGroup);
            handItemMesh = weaponGroup;

            armGroup.position.set(0.25, -0.2, -0.35);
            armGroup.rotation.x = -0.2;
            camera.add(armGroup);
            playerArm = armGroup;
        }

        // 第三人称玩家模型
        function createPlayerModel() {
            const group = new THREE.Group();

            // 🌟 玩家随身光源：确保夜晚玩家始终可见
            const playerLight = new THREE.PointLight(0xffeedd, 0.4, 5, 2);
            playerLight.position.set(0, 1.2, 0);
            group.add(playerLight);

            const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8b78a });
            const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3366cc });
            const pantsMat = new THREE.MeshLambertMaterial({ color: 0x333366 });

            // 身体
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), shirtMat);
            body.position.y = 1.0;
            group.add(body);

            // 头（使用浩宇图片纹理）
            const headMat = playerTexture
                ? new THREE.MeshLambertMaterial({ map: playerTexture })
                : new THREE.MeshLambertMaterial({ color: 0xe8b78a });
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
            head.position.y = 1.6;
            group.add(head);

            // 腿
            const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), pantsMat);
            legL.position.set(-0.15, 0.3, 0);
            group.add(legL);
            playerLegL = legL;
            const legR = legL.clone();
            legR.position.x = 0.15;
            group.add(legR);
            playerLegR = legR;

            // 脚（鞋子）
            const footMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
            const footGeo = new THREE.BoxGeometry(0.22, 0.12, 0.3);
            const footL = new THREE.Mesh(footGeo, footMat);
            footL.position.set(-0.15, 0.06, 0.02);
            group.add(footL);
            const footR = footL.clone();
            footR.position.x = 0.15;
            group.add(footR);

            // 手臂
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), skinMat);
            armL.position.set(-0.4, 1.0, 0);
            group.add(armL);
            playerArmL = armL;
            const armR = armL.clone();
            armR.position.x = 0.4;
            group.add(armR);
            playerArmR = armR;

            // 手（拳头）
            const handL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), skinMat);
            handL.position.set(-0.4, 0.65, 0);
            group.add(handL);
            playerHandL = handL;
            const handR = handL.clone();
            handR.position.x = 0.4;
            group.add(handR);
            playerHandR = handR;

            // 名字标签
            const label = makeNameTag('浩宇', '#55ff55', 'hào yǔ');
            label.position.y = 2.1;
            group.add(label);

            // 手持物品容器（武器/工具，挂在右手拳头，武器向前指）
            const handGroup = new THREE.Group();
            handGroup.position.set(0.4, 0.65, -0.1);
            handGroup.rotation.x = -(Math.PI / 2);  // 武器指向正前方(-Z)
            handItemMesh = handGroup;
            group.add(handGroup);

            // 筋斗云（飞行时显示）
            const cloudGroup = new THREE.Group();
            const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
            // 云朵主体（多个球体组合）
            const cloudPuffs = [
                { x: 0, y: 0, z: 0, size: 0.5 },
                { x: -0.4, y: -0.1, z: 0, size: 0.4 },
                { x: 0.4, y: -0.1, z: 0, size: 0.4 },
                { x: -0.2, y: 0.1, z: 0.3, size: 0.35 },
                { x: 0.2, y: 0.1, z: -0.3, size: 0.35 },
                { x: 0, y: -0.2, z: 0.4, size: 0.3 },
                { x: 0, y: -0.2, z: -0.4, size: 0.3 },
            ];
            cloudPuffs.forEach(p => {
                const puff = new THREE.Mesh(new THREE.SphereGeometry(p.size, 8, 8), cloudMat);
                puff.position.set(p.x, p.y, p.z);
                cloudGroup.add(puff);
            });
            // 云朵放在脚下方
            cloudGroup.position.y = -0.3;
            cloudGroup.visible = false; // 默认隐藏
            cloudGroup.userData = { isCloud: true };
            group.add(cloudGroup);
            cloudMesh = cloudGroup; // 保存引用

            scene.add(group);
            return group;
        }

        // 创建锄头模型
        function createHoeMesh() {
            const group = new THREE.Group();
            const handle = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.6, 0.05),
                new THREE.MeshLambertMaterial({ color: 0x674a27 })
            );
            handle.position.y = 0.3;
            group.add(handle);
            const blade = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.1, 0.05),
                new THREE.MeshLambertMaterial({ color: 0xc0a040 })
            );
            blade.position.set(0.1, 0.55, 0);
            group.add(blade);
            return group;
        }

        // 更新手持物品显示
        function updateHandItem() {
            if (!handItemMesh) return;
            while (handItemMesh.children.length > 0) {
                handItemMesh.remove(handItemMesh.children[0]);
            }
            const item = hotbarItems[selectedBlockIndex];
            
            // 清除旧盾牌
            if (shieldMesh) { if (shieldMesh.parent) shieldMesh.parent.remove(shieldMesh); shieldMesh = null; }
            if (shieldInFirstPerson) { if (shieldInFirstPerson.parent) shieldInFirstPerson.parent.remove(shieldInFirstPerson); shieldInFirstPerson = null; }
            shieldVisible = false;
            
            if (item && (item.type === 'weapon' || item.type === 'tool' || item.type === 'vehicle')) {
                // 盾牌特殊处理：竖举在身前
                if (item.name && item.name.indexOf('盾') >= 0) {
                    shieldVisible = true;
                    shieldMesh = createToolMesh(item);
                    // 盾牌在 XY 平面，正面朝 Z 轴正方向
                    // 第三人称：挂在左臂前方，举在身前
                    if (playerArmL && playerModel) {
                        const shieldHolder = new THREE.Group();
                        shieldHolder.position.set(-0.35, 1.0, -0.35); // 左臂前方
                        shieldHolder.rotation.y = 0; // 正面朝前
                        shieldHolder.scale.set(0.8, 0.8, 0.8);
                        shieldHolder.add(shieldMesh);
                        playerModel.add(shieldHolder);
                        shieldMesh.userData.holder = shieldHolder;
                    }
                    // 第一人称：显示在摄像头左侧前方
                    if (playerArm) {
                        const fpShield = createToolMesh(item);
                        fpShield.position.set(-0.4, -0.15, -0.6);
                        fpShield.rotation.x = -0.1;
                        fpShield.rotation.y = 0.15;
                        fpShield.scale.set(1.0, 1.0, 1.0);
                        camera.add(fpShield);
                        shieldInFirstPerson = fpShield;
                    }
                    return; // 盾牌不放入 handItemMesh
                }
                handItem = createToolMesh(item);
                handItemMesh.add(handItem);
            }
        }

        // 创建工具模型（手持武器）—— 按武器名称渲染出各不相同的形状，材质颜色取自 item.color
        function createToolMesh(item) {
            const group = new THREE.Group();
            const bladeMat  = new THREE.MeshLambertMaterial({ color: item.color });
            const handleMat = new THREE.MeshLambertMaterial({ color: 0x674a27 });
            const ironMat   = new THREE.MeshLambertMaterial({ color: 0xdddddd });
            const woodMat   = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
            const name = item.name || '';

            // 木柄（共用）
            function addHandle(h, y) {
                const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), handleMat);
                m.position.y = y;
                group.add(m);
                return m;
            }

            if (name.indexOf('剑') >= 0) {
                // === 剑 === 细长刀刃 + 十字护手 + 木柄（高耸的细长轮廓）
                addHandle(0.24, 0.06);
                const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.08), ironMat);
                guard.position.y = 0.19;
                group.add(guard);
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.03), bladeMat);
                blade.position.y = 0.56;
                group.add(blade);
                const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.03), bladeMat);
                tip.position.y = 0.96;
                group.add(tip);
            } else if (name.indexOf('镐') >= 0) {
                // === 镐 === 对称V形双头（两端外张）+ 长木柄（与斧的单侧刃区分）
                addHandle(0.62, 0.3);
                const hub = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), bladeMat);
                hub.position.y = 0.62;
                group.add(hub);
                const armL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.09), bladeMat);
                armL.position.set(-0.17, 0.6, 0);
                armL.rotation.z = 0.5;
                group.add(armL);
                const armR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.09), bladeMat);
                armR.position.set(0.17, 0.6, 0);
                armR.rotation.z = -0.5;
                group.add(armR);
            } else if (name.indexOf('斧') >= 0) {
                // === 斧 === 单侧斧刃（只装在柄的一侧，带锋利刃口），木柄+材质色斧头
                addHandle(0.62, 0.3);
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.1), bladeMat);
                head.position.set(0.15, 0.62, 0);
                group.add(head);
                const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.11), bladeMat);
                edge.position.set(0.3, 0.62, 0);
                group.add(edge);
            } else if (name.indexOf('锄') >= 0) {
                // === 锄 === L形：垂直木柄 + 顶端单侧扁平锄刃（薄刃，与斧的厚楔形区分）
                addHandle(0.64, 0.3);
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.09), bladeMat);
                blade.position.set(0.1, 0.63, 0);
                group.add(blade);
            } else if (name.indexOf('盾') >= 0) {
                // === 盾牌 === 大号盾形护盾：彩色面板 + 木质边框 + 铁质盾徽（比原方块大得多）
                function makeShieldShape(s) {
                    const sh = new THREE.Shape();
                    sh.moveTo(-0.31 * s, 0.9 * s);
                    sh.lineTo(0.31 * s, 0.9 * s);
                    sh.lineTo(0.31 * s, 0.26 * s);
                    sh.lineTo(0, 0.0 * s);
                    sh.lineTo(-0.31 * s, 0.26 * s);
                    sh.closePath();
                    return sh;
                }
                // 木质边框（略大一圈，置于后面形成包边）
                const frame = new THREE.Mesh(
                    new THREE.ExtrudeGeometry(makeShieldShape(1.08), { depth: 0.07, bevelEnabled: false }),
                    woodMat
                );
                frame.position.z = -0.03;
                group.add(frame);
                // 彩色面板
                const panel = new THREE.Mesh(
                    new THREE.ExtrudeGeometry(makeShieldShape(1.0), { depth: 0.08, bevelEnabled: false }),
                    bladeMat
                );
                panel.position.z = 0.005;
                group.add(panel);
                // 铁质盾徽 + 金色徽记
                const boss = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.08), ironMat);
                boss.position.set(0, 0.56, 0.09);
                group.add(boss);
                const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshLambertMaterial({ color: 0xffdd00 }));
                emblem.position.set(0, 0.56, 0.1);
                group.add(emblem);
            } else if (name.indexOf('火把') >= 0) {
                // === 火把 === 木棍 + 双层火焰
                const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), handleMat);
                stick.position.y = 0.2;
                group.add(stick);
                const flame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
                flame.position.y = 0.52;
                group.add(flame);
                const flameTop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), new THREE.MeshBasicMaterial({ color: 0xffff88 }));
                flameTop.position.y = 0.6;
                group.add(flameTop);
            } else if (name.indexOf('狙击') >= 0) {
                // === 狙击枪 === 超长枪管 + 瞄准镜 + 枪托 + 两脚架（最长的枪）
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.08), handleMat);
                stock.position.set(-0.2, 0.3, 0);
                group.add(stock);
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.1), bladeMat);
                body.position.set(-0.02, 0.3, 0);
                group.add(body);
                const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), bladeMat);
                barrel.position.set(0.25, 0.3, 0);
                group.add(barrel);
                const scope = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: 0x222222 }));
                scope.position.set(-0.02, 0.4, 0);
                group.add(scope);
                const lens = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0x44ffcc }));
                lens.position.set(0.07, 0.4, 0);
                group.add(lens);
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), handleMat);
                grip.position.set(-0.08, 0.2, 0);
                group.add(grip);
                const legL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), handleMat);
                legL.position.set(0.15, 0.15, 0.05);
                group.add(legL);
                const legR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), handleMat);
                legR.position.set(0.15, 0.15, -0.05);
                group.add(legR);
            } else if (name.indexOf('步枪') >= 0) {
                // === 步枪 === 枪托 + 枪身 + 长枪管 + 弹匣（中等长度）
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.08), handleMat);
                stock.position.set(-0.15, 0.3, 0);
                group.add(stock);
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), bladeMat);
                body.position.set(0.0, 0.3, 0);
                group.add(body);
                const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), bladeMat);
                barrel.position.set(0.25, 0.3, 0);
                group.add(barrel);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), bladeMat);
                mag.position.set(0.0, 0.2, 0);
                group.add(mag);
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), handleMat);
                grip.position.set(-0.05, 0.2, 0);
                group.add(grip);
            } else if (name.indexOf('手枪') >= 0) {
                // === 手枪 === 紧凑：握把 + 枪身 + 短枪管
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), handleMat);
                grip.position.set(0, 0.05, 0);
                group.add(grip);
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), bladeMat);
                body.position.set(0.05, 0.16, 0);
                group.add(body);
                const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.05), bladeMat);
                barrel.position.set(0.18, 0.16, 0);
                group.add(barrel);
                const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.04), handleMat);
                trigger.position.set(0.0, 0.1, 0);
                group.add(trigger);
            } else if (name.indexOf('坦克') >= 0) {
                // === 坦克 === 缩小版军事坦克模型（手持时显示，右键召唤真坦克）
                const hullMat = new THREE.MeshLambertMaterial({ color: 0x3a4a2a });
                const hullDark = new THREE.MeshLambertMaterial({ color: 0x2a3a1a });
                const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
                const barrelMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
                const trackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                // 车身
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.35), hullMat);
                body.position.set(0, 0.32, 0);
                group.add(body);
                // 倾斜前装甲
                const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.12), hullDark);
                frontPlate.position.set(0, 0.38, -0.15);
                frontPlate.rotation.x = -0.3;
                group.add(frontPlate);
                // 炮塔
                const turret = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), hullMat);
                turret.position.set(0, 0.42, 0);
                group.add(turret);
                // 炮塔顶
                const turretTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), hullDark);
                turretTop.position.set(0, 0.47, 0);
                group.add(turretTop);
                // 炮管
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 6), barrelMat);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.set(0, 0.42, -0.22);
                group.add(barrel);
                // 炮口制退器
                const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), metalMat);
                muzzleBrake.position.set(0, 0.42, -0.37);
                group.add(muzzleBrake);
                // 履带
                const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.36), trackMat);
                trackL.position.set(-0.16, 0.28, 0);
                group.add(trackL);
                const trackR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.36), trackMat);
                trackR.position.set(0.16, 0.28, 0);
                group.add(trackR);
                // 履带轮（每侧3个）
                for (const wz of [-0.12, 0, 0.12]) {
                    const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
                    wheelL.rotation.z = Math.PI / 2;
                    wheelL.position.set(-0.16, 0.26, wz);
                    group.add(wheelL);
                    const wheelR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
                    wheelR.rotation.z = Math.PI / 2;
                    wheelR.position.set(0.16, 0.26, wz);
                    group.add(wheelR);
                }
                // 排烟口
                const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 4), metalMat);
                smokestack.position.set(0.06, 0.40, 0.12);
                group.add(smokestack);
                // 天线
                const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 3), metalMat);
                antenna.position.set(-0.10, 0.48, 0.10);
                group.add(antenna);
                // 把手（手持用）
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.04), handleMat);
                handle.position.set(0, 0.1, 0);
                group.add(handle);
            }
            return group;
        }

        // 创建名字标签（Canvas 纹理 → Sprite）
        function makeNameTag(text, color, pinyin, textureKey) {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 80;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, 320, 80);
            if (pinyin) {
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillText(pinyin, 160, 18);
            }
            ctx.font = 'bold 26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color || '#fff';
            const textureName = textureKey ? (TEXTURE_NAMES[textureKey] || textureKey) : null;
            if (textureName) {
                ctx.fillText(`${text} [${textureName}]`, 160, 52);
            } else {
                ctx.fillText(text, 160, 52);
            }
            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(2.0, 0.5, 1);
            sprite.renderOrder = 999;
            return sprite;
        }

        // === 教育标牌专用多行文字标签 ===
        // 支持换行符，自动调整 canvas 高度和字号
        function makeSignLabel(text, color) {
            const lines = text.split('\n');
            const lineHeight = 28;
            const padding = 14;
            const canvasWidth = 512;
            const canvasHeight = Math.max(64, lines.length * lineHeight + padding * 2);
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            // 半透明深色背景
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            // 边框
            ctx.strokeStyle = color || '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, canvasWidth - 4, canvasHeight - 4);
            // 绘制多行文字
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color || '#fff';
            for (let i = 0; i < lines.length; i++) {
                const lineY = padding + lineHeight * (i + 0.5);
                ctx.fillText(lines[i], padding, lineY);
            }
            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
            const sprite = new THREE.Sprite(mat);
            const aspect = canvasHeight / canvasWidth;
            const spriteW = 2.5;
            sprite.scale.set(spriteW, spriteW * aspect, 1);
            sprite.renderOrder = 999;
            return sprite;
        }

        // 4. 按键处理
        function onKeyDown(event) {
            switch (event.code) {
                case 'KeyW': moveForward = true; break;
                case 'KeyA': moveLeft = true; break;
                case 'KeyS': moveBackward = true; break;
                case 'KeyD': moveRight = true; break;
                case 'Space':
                    if (event.repeat) return;
                    jumpHeld = true;
                    if (canJump === true) velocity.y = JUMP_SPEED;
                    canJump = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    sprintHeld = true;
                    break;
                case 'KeyQ':
                    flyDownHeld = true; // 飞行下降
                    break;
                case 'KeyR':
                    // 重置俯仰角，避免卡在朝天方向看不回地面
                    {
                        const e = new THREE.Euler(0, 0, 0, 'YXZ');
                        e.setFromQuaternion(camera.quaternion);
                        e.x = 0;
                        camera.quaternion.setFromEuler(e);
                    }
                    break;
                case 'Digit1': selectSlot(0); break;
                case 'Digit2': selectSlot(1); break;
                case 'Digit3': selectSlot(2); break;
                case 'Digit4': selectSlot(3); break;
                case 'Digit5': selectSlot(4); break;
                case 'Digit6': selectSlot(5); break;
                case 'Digit7': selectSlot(6); break;
                case 'Digit8': selectSlot(7); break;
                case 'Digit9': selectSlot(8); break;
                case 'Digit0': selectSlot(9); break;
                case 'KeyE':
                    if (event.repeat) return;
                    // 走近爷爷/奶奶/泽宇按E → 开始课文朗读
                    if (nearGuardian || nearZeyu) {
                        startGuardianReading();
                        break;
                    }
                    toggleCrafting();
                    break;
                case 'KeyV': togglePerspective(); break;
                case 'KeyF':
                    if (event.repeat) return;
                    // 坦克驾驶：退出
                    if (tankDriving) {
                        exitTank();
                        break;
                    }
                    // 坦克驾驶：进入（走近坦克按F）
                    let nearTank = null;
                    const pPos = getPlayerPos();
                    for (const t of tanks) {
                        if (t.driverIn) continue;
                        const dx = pPos.x - t.mesh.position.x;
                        const dz = pPos.z - t.mesh.position.z;
                        if (Math.sqrt(dx*dx + dz*dz) < 5.0) {
                            nearTank = t;
                            break;
                        }
                    }
                    if (nearTank) {
                        enterTank(nearTank);
                        break;
                    }
                    flying = !flying;
                    if (flying) {
                        velocity.y = 0;
                        canJump = false;
                        if (cloudMesh) cloudMesh.visible = true; // 显示筋斗云
                        // 进入飞行模式时向上传送，避免卡在方块里
                        if (playerModel) {
                            const groundY = getGroundY(playerModel.position.x, playerModel.position.z);
                            playerModel.position.y = groundY + 3;
                        }
                        showStatus('☁️ 飞行模式开启 (F关闭) - 筋斗云已就位！可穿过地形和守护神！');
                    } else {
                        if (cloudMesh) cloudMesh.visible = false; // 隐藏筋斗云
                        // 退出飞行模式：强制生成周围地形，防止掉入未加载区域
                        updateChunks();
                        // 将玩家传送到地面（无条件，避免卡在地形内部）
                        if (playerModel) {
                            const pos = playerModel.position;
                            const groundY = getGroundY(pos.x, pos.z);
                            // 无条件设为地面高度（无论玩家在地面之上还是之下）
                            pos.y = groundY;
                            velocity.set(0, 0, 0);
                            canJump = false;
                            // 传送后脱困检查：如果仍在方块内，继续向上推
                            for (let step = 0.5; step <= 15.0; step += 0.5) {
                                if (!checkCollision(pos.x, pos.y + step, pos.z, 0.3, PLAYER_HEIGHT)) {
                                    pos.y += step;
                                    break;
                                }
                            }
                        }
                        showStatus('飞行模式关闭 - 已降落');
                    }
                    break;
                case 'KeyC':
                    if (event.repeat) return;
                    kowtow();
                    break;
                case 'KeyG':
                    // 脱困模式：向上传送脱困
                    if (event.repeat) return;
                    if (playerModel) {
                        const groundY = getGroundY(playerModel.position.x, playerModel.position.z);
                        playerModel.position.y = groundY + 2;
                        velocity.set(0, 0, 0);
                        showStatus('🆘 脱困模式：已向上传送2格！');
                    }
                    break;
                case 'KeyT':
                    // 每日任务面板
                    if (event.repeat) return;
                    toggleDailyTaskPanel();
                    break;
                case 'KeyY':
                    // 成就徽章面板
                    if (event.repeat) return;
                    toggleBadgePanel();
                    break;
                case 'KeyJ':
                    // 场景图鉴面板
                    if (event.repeat) return;
                    toggleBiomePanel();
                    break;
            }
        }

        // 第一人称/第三人称视角切换
        // 显示状态提示
        function showStatus(text) {
            const statusEl = document.getElementById('status-val');
            if (statusEl) {
                // 用 innerHTML 以支持拼音标注
                statusEl.innerHTML = withPinyin(text);
                setTimeout(() => { statusEl.innerHTML = ''; }, 2000);
            }
        }

        // 磕头恢复生命和饥饿值（需在奶奶/爷爷附近）
        let kowtowing = false;
        function kowtow() {
            if (!nearGuardian) {
                showStatus('❌ 请走到奶奶或爷爷面前才能磕头');
                return;
            }
            if (kowtowing) return;
            kowtowing = true;

            // 找到最近的保护神
            const playerPos = getPlayerPos();
            let nearestGuardian = null;
            let minDist = Infinity;
            for (const mob of mobs) {
                if (mob.guardian && mob.mesh.visible) {
                    const dx = playerPos.x - mob.mesh.position.x;
                    const dz = playerPos.z - mob.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestGuardian = mob;
                    }
                }
            }

            if (!nearestGuardian) {
                showStatus('❌ 找不到保护神');
                kowtowing = false;
                return;
            }

            // 保存原始状态
            const origRotY = playerModel.rotation.y;
            const origLegLRot = playerLegL ? playerLegL.rotation.x : 0;
            const origLegRRot = playerLegR ? playerLegR.rotation.x : 0;
            const origBodyY = playerModel.children[0] ? playerModel.children[0].position.y : 1.0;
            const origHeadY = playerModel.children[1] ? playerModel.children[1].position.y : 1.6;
            const origHeadRotX = playerModel.children[1] ? playerModel.children[1].rotation.x : 0;

            // 面向保护神
            const dx = nearestGuardian.mesh.position.x - playerPos.x;
            const dz = nearestGuardian.mesh.position.z - playerPos.z;
            const targetRotY = Math.atan2(dx, dz);
            playerModel.rotation.y = targetRotY;

            // 动画阶段1：下跪（腿弯曲，身体降低）
            setTimeout(() => {
                // 腿弯曲90度
                if (playerLegL) playerLegL.rotation.x = -1.5;
                if (playerLegR) playerLegR.rotation.x = -1.5;
                // 身体降低
                if (playerModel.children[0]) playerModel.children[0].position.y = 0.6;
                if (playerModel.children[1]) playerModel.children[1].position.y = 1.2;
            }, 300);

            // 动画阶段2：磕头（低头）
            setTimeout(() => {
                if (playerModel.children[1]) playerModel.children[1].rotation.x = 0.8;
            }, 600);

            // 动画阶段3：抬头并恢复
            setTimeout(() => {
                // 恢复所有状态
                if (playerModel.children[1]) {
                    playerModel.children[1].rotation.x = origHeadRotX;
                    playerModel.children[1].position.y = origHeadY;
                }
                if (playerModel.children[0]) {
                    playerModel.children[0].position.y = origBodyY;
                }
                if (playerLegL) playerLegL.rotation.x = origLegLRot;
                if (playerLegR) playerLegR.rotation.x = origLegRRot;
                playerModel.rotation.y = origRotY;

                // 恢复生命和饥饿值
                const heal = 8;
                const feed = 8;
                health = Math.min(maxHealth, health + heal);
                hunger = Math.min(maxHunger, hunger + feed);
                showStatus(`🙇 磕头！生命+${heal} 饥饿+${feed}`);
                updateVitalsUI();
                kowtowing = false;
            }, 1500);
        }

        // 更新生命/饥饿值 UI
        function updateVitalsUI() {
            const hBar = document.getElementById('health-bar');
            const hNum = document.getElementById('health-num');
            const huBar = document.getElementById('hunger-bar');
            const huNum = document.getElementById('hunger-num');
            if (hBar) hBar.style.width = (health / maxHealth * 100) + '%';
            if (hNum) hNum.textContent = Math.floor(health);
            if (huBar) huBar.style.width = (hunger / maxHunger * 100) + '%';
            if (huNum) huNum.textContent = Math.floor(hunger);
        }

        function togglePerspective() {
            thirdPerson = !thirdPerson;
            if (playerModel) {
                playerModel.visible = thirdPerson;
            }
            if (playerArm) {
                playerArm.visible = !thirdPerson;
            }
            // 盾牌可见性切换
            if (shieldMesh && shieldMesh.userData.holder) {
                shieldMesh.userData.holder.visible = thirdPerson;
            }
            if (shieldInFirstPerson) {
                shieldInFirstPerson.visible = !thirdPerson;
            }
            // 切换到第一人称：相机继承玩家朝向
            if (!thirdPerson && playerModel) {
                const euler = new THREE.Euler(0, playerModel.rotation.y, 0, 'YXZ');
                camera.quaternion.setFromEuler(euler);
            }
            // 显示提示
            const statusEl = document.getElementById('status-val');
            if (statusEl) {
                statusEl.textContent = thirdPerson ? '第三人称' : '第一人称';
                setTimeout(() => { statusEl.textContent = ''; }, 1500);
            }
        }

        function onKeyUp(event) {
            switch (event.code) {
                case 'KeyW': moveForward = false; break;
                case 'KeyA': moveLeft = false; break;
                case 'KeyS': moveBackward = false; break;
                case 'KeyD': moveRight = false; break;
                case 'Space': jumpHeld = false; break;
                case 'ShiftLeft':
                case 'ShiftRight': sprintHeld = false; break;
                case 'KeyQ': flyDownHeld = false; break;
            }
        }

        // 鼠标左键破坏/右键放置
        function onMouseDown(event) {
            if (!gameActive) return;
            // 坦克驾驶模式：左键开火
            if (tankDriving && event.button === 0 && currentTank) {
                currentTank.fireTimer = 0;
                const camDir = new THREE.Vector3();
                camera.getWorldDirection(camDir);
                const muzzleWorldPos = new THREE.Vector3();
                currentTank.muzzle.getWorldPosition(muzzleWorldPos);
                const bullet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
                bullet.position.copy(muzzleWorldPos);
                const dir = camDir.clone().normalize();
                bullet.userData = { velocity: dir.multiplyScalar(25), damage: 25, life: 4 };
                scene.add(bullet);
                tankBullets.push(bullet);
                playHitSound();
                currentTank.muzzle.material.color.setHex(0xffff00);
                const mz = currentTank.muzzle;
                setTimeout(() => { if (mz.material) mz.material.color.setHex(0x333333); }, 100);
                return;
            }
            // 兜底模式下由 mouseup 决定是否当成"点击"（区分点击与拖拽），
            // 所以这里的 document mousedown 直接返回，避免按住拖拽视角时误破坏方块
            // 但如果 event 是合成事件（从 mouseup 调用），则不返回
            if (fallbackMode && event.clientX !== undefined) return;

            raycaster.setFromCamera(mouse, camera);
            const playerPos = getPlayerPos();
            const maxReachSq = MAX_REACH * MAX_REACH;
            
            // 飞行时不能攻击怪物
            if (flying && event.button === 0) {
                const mobMeshes = mobs.filter(m => m.mesh && m.mesh.visible).map(m => m.mesh);
                const mobIntersects = raycaster.intersectObjects(mobMeshes, true);
                if (mobIntersects.length > 0) {
                    showStatus('❌ 飞行中无法攻击怪物！');
                    return;
                }
            }
            
            // 检查是否点击了怪物
            const mobMeshes = mobs.filter(m => m.mesh && m.mesh.visible).map(m => m.mesh);
            const mobIntersects = raycaster.intersectObjects(mobMeshes, true);
            // 🐾 右键点击动物 → 驯服 / 守护神 → 对话
            if (mobIntersects.length > 0 && event.button === 2) {
                const hitMesh = mobIntersects[0].object;
                for (const mob of mobs) {
                    if (mob.mesh === hitMesh || (hitMesh.parent && mob.mesh === hitMesh.parent)) {
                        tryTameMob(mob);
                        return;
                    }
                }
            }
            if (mobIntersects.length > 0 && event.button === 0) {
                const hitMesh = mobIntersects[0].object;
                // 找到被点击的怪物
                for (const mob of mobs) {
                    if (mob.mesh === hitMesh || (hitMesh.parent && mob.mesh === hitMesh.parent)) {
                        // 检查是否手持武器
                        const currentItem = hotbarItems[selectedBlockIndex];
                        if (!currentItem || currentItem.type !== 'weapon') {
                            showStatus('❌ 需要装备武器才能攻击怪物！（选择剑/镐/斧/枪）');
                            return;
                        }
                        const weaponDamage = currentItem.damage || 1;
                        // 判断是否是枪械（远程弹道射击）
                        const isGun = currentItem.name === '手枪' || currentItem.name === '步枪' || currentItem.name === '狙击枪';
                        // 检查距离（枪械射程更远）
                        const dx = playerPos.x - mob.mesh.position.x;
                        const dz = playerPos.z - mob.mesh.position.z;
                        const distSq = dx * dx + dz * dz;
                        const gunReach = currentItem.name === '狙击枪' ? 50 : (currentItem.name === '步枪' ? 25 : 15);
                        const reachSq = isGun ? gunReach * gunReach : maxReachSq;
                        if (distSq > reachSq) {
                            showStatus('❌ 距离太远，无法攻击！');
                            return;
                        }
                        if (mob.guardian) {
                            showStatus('🛡️ 保护神无法被攻击！');
                            return;
                        }
                        if (mob.type.hostile) {
                            // 触发攻击动画
                            attackTimer = 0.3;
                            if (playerArm) {
                                const origRot = playerArm.rotation.x;
                                playerArm.rotation.x = -1.0;
                                setTimeout(() => { if (playerArm) playerArm.rotation.x = origRot; }, 200);
                            }
                            // 枪械：发射远程弹道
                            if (isGun) {
                                fireGunProjectile(currentItem, mob.mesh.position);
                                showStatus(`🔫 ${currentItem.name} 射击 ${mob.type.name}!`);
                                return;
                            }
                            // 近战：即时伤害
                            mob.hp = (mob.hp || 10) - weaponDamage;
                            if (mob.healthBar) updateHealthBar(mob.healthBar, mob.hp);
                            playHitSound();
                            // 攻击特效：红色血雾粒子
                            createHitParticles(mob.mesh.position, 0xff3333, 10);
                            // 标记怪物被激怒（白天也会追击玩家）
                            if (mob.type.hostile) {
                                mob.provoked = true;
                                mob.provokeTimer = 15; // 激怒持续时间15秒
                            }
                            showStatus(`⚔️ ${currentItem.name} 攻击${mob.type.name} (-${weaponDamage} HP, 剩余${mob.hp})`);
                            if (mob.hp <= 0) {
                                scene.remove(mob.mesh);
                                mob.alive = false;
                                showStatus(`💀 ${mob.type.name} 被击败了！`);
                                onMobDefeated(mob);
                            } else {
                                // 怪物反攻！
                                const counterDmg = 3 + Math.floor(Math.random() * 3);
                                takeDamage(counterDmg);
                                showStatus(`🔥 ${mob.type.name} 反击！`);
                                // 低血量逃跑
                                if (mob.hp < mob.maxHp * 0.3) {
                                    mob.fleeing = true;
                                    mob.fleeTimer = 3 + Math.random() * 2;
                                    showStatus(`🏃 ${mob.type.name} 受惊逃跑了！`);
                                }
                            }
                        }
                        return;
                    }
                }
            }

            const blockMeshes = Object.values(instancedMeshes);
            const intersects = raycaster.intersectObjects(blockMeshes, false);

            if (intersects.length > 0) {
                const intersect = intersects[0];
                const im = intersect.object;
                const typeId = im.userData.typeId;
                const instId = intersect.instanceId;
                if (instId === undefined) return;

                // 通过实例 ID 找到方块坐标
                const key = instToKey[typeId][instId];
                if (!key || !blocksMap.has(key)) return;
                const parts = key.split(',');
                const bx = parseInt(parts[0], 10);
                const by = parseInt(parts[1], 10);
                const bz = parseInt(parts[2], 10);

                // 检查距离
                const dx = playerPos.x - (bx + 0.5);
                const dy = playerPos.y - by;
                const dz = playerPos.z - (bz + 0.5);
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > maxReachSq) {
                    showStatus('❌ 距离太远，无法采集/放置！');
                    return;
                }

                // 副本内方块不可被采集（除副本宝箱外）
                if (dungeonState.active) {
                    const dMinX = DUNGEON_ORIGIN_X - DUNGEON_HALF;
                    const dMaxX = DUNGEON_ORIGIN_X + DUNGEON_HALF;
                    const dMinZ = DUNGEON_ORIGIN_Z - DUNGEON_HALF;
                    const dMaxZ = DUNGEON_ORIGIN_Z + DUNGEON_HALF;
                    if (bx >= dMinX && bx <= dMaxX && bz >= dMinZ && bz <= dMaxZ) {
                        if (typeId !== BLOCK_TYPES.DUNGEON_CHEST.id) {
                            showStatus('🔒 副本内的方块不可被采集！');
                            return;
                        }
                    }
                }

                // 副本宝箱挖掘奖励
                if (typeId === BLOCK_TYPES.DUNGEON_CHEST.id) {
                    removeBlock(key);
                    playBreakSound();
                    playCraftSound();
                    const chestRewards = DUNGEON_CHEST_REWARDS[dungeonState.currentDungeon];
                    const floorReward = chestRewards ? chestRewards[dungeonState.currentFloor] : null;
                    if (floorReward) {
                        const rewardNames = [];
                        for (const [itemKey, itemCount] of Object.entries(floorReward.items)) {
                            inventory[itemKey] = (inventory[itemKey] || 0) + itemCount;
                            rewardNames.push(`${itemKey}×${itemCount}`);
                        }
                        showStatus(`🎁 ${floorReward.name}：${rewardNames.join(', ')}！`);
                    } else {
                        showStatus('🎁 打开了副本宝箱！');
                    }
                    // 移除宝箱标签
                    if (dungeonState.chestLabel) {
                        scene.remove(dungeonState.chestLabel);
                        dungeonState.chestLabel = null;
                    }
                    return;
                }

                // 飞行时不能采集
                if (flying && event.button === 0) {
                    showStatus('❌ 飞行中无法采集方块！');
                    return;
                }

                if (event.button === 0) {
                    // 左键 - 破坏/采集
                    const item = hotbarItems[selectedBlockIndex];
                    // 播放挖掘音效 + 挥臂动画（第一人称 + 第三人称都可见）
                    playMiningSound();
                    // 第三人称：触发攻击计时器，由动画循环挥动 playerArmR/L
                    attackTimer = Math.max(attackTimer, 0.2);
                    // 第一人称：直接挥动 playerArm
                    if (playerArm) {
                        const origRot = playerArm.rotation.x;
                        playerArm.rotation.x = -0.8;
                        setTimeout(() => { if (playerArm) playerArm.rotation.x = origRot; }, 150);
                    }
                    
                    // 检查是否有工具（镐、斧、锄等）
                    const hasTool = item.icon === '⛏️' || item.icon === '🪓' || item.icon === '⚔️' || item.icon === '🛡️';
                    
                    // 宝箱方块：采集后直接获得宝箱奖励（不能获得宝箱本身）
                    if (typeId === BLOCK_TYPES.CHEST_B.id ||
                        typeId === BLOCK_TYPES.CHEST_S.id ||
                        typeId === BLOCK_TYPES.CHEST_G.id) {
                        const chestType = (typeId === BLOCK_TYPES.CHEST_B.id) ? 'bronze'
                            : (typeId === BLOCK_TYPES.CHEST_S.id) ? 'silver' : 'gold';
                        removeBlock(key);
                        playBreakSound();
                        giveChestReward(chestType);
                        return;
                    }
                    
                    // 除基岩和花岗岩外的所有方块都可以采集
                    if (typeId !== BLOCK_TYPES.BEDROCK.id && typeId !== BLOCK_TYPES.GRANITE.id) {
                        removeBlock(key);
                        playBreakSound();
                        
                        // 根据方块类型给予对应材料
                        const blockKey = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k].id === typeId);
                        const blockName = BLOCK_TYPES[blockKey]?.name || '方块';
                        
                        if (typeId === BLOCK_TYPES.GRASS.id) {
                            inventory.dirt = (inventory.dirt || 0) + 1;
                            totalCollected++;
                            // 30% 几率掉落种子
                            if (Math.random() < 0.3) {
                                inventory.seeds = (inventory.seeds || 0) + 1;
                                showStatus(`🌱 采集了 ${blockName} → +1 泥土, +1 种子 (库存: ${inventory.seeds})`);
                            } else {
                                showStatus(`🌱 采集了 ${blockName} → +1 泥土 (库存: ${inventory.dirt})`);
                            }
                        } else if (typeId === BLOCK_TYPES.CROP.id) {
                            // 收割作物：先读取生长阶段，再移除方块
                            const cropStage = getBlockCropStage(key);
                            removeBlock(key);
                            playBreakSound();
                            if (cropStage >= 7) {
                                inventory.wheat = (inventory.wheat || 0) + 1;
                                inventory.seeds = (inventory.seeds || 0) + 2;
                                totalCollected++;
                                showStatus(`🌾 收割了成熟作物 → +1 麦子, +2 种子`);
                            } else {
                                inventory.seeds = (inventory.seeds || 0) + 1;
                                totalCollected++;
                                showStatus(`🌱 收割了未成熟作物 → +1 种子`);
                            }
                            updateInventoryDisplay();
                            checkCollectionMilestones();
                            return;
                        } else if (typeId === BLOCK_TYPES.FARMLAND.id) {
                            inventory.dirt = (inventory.dirt || 0) + 1;
                            totalCollected++;
                            showStatus(`🟤 采集了耕地 → +1 泥土`);
                        } else if (typeId === BLOCK_TYPES.DIRT.id) {
                            inventory.dirt = (inventory.dirt || 0) + 1;
                            totalCollected++;
                            showStatus(`🟤 采集了 ${blockName} → +1 泥土 (库存: ${inventory.dirt})`);
                        } else if (typeId === BLOCK_TYPES.STONE.id) {
                            inventory.stone = (inventory.stone || 0) + 1;
                            totalCollected++;
                            // 检查附近是否有矿石
                            let nearOre = false;
                            const px = Math.floor(playerPos.x), pz = Math.floor(playerPos.z), py = Math.floor(playerPos.y);
                            for (let dx = -3; dx <= 3; dx++) {
                                for (let dz = -3; dz <= 3; dz++) {
                                    for (let dy = -3; dy <= 3; dy++) {
                                        const key = `${px+dx},${py+dy},${pz+dz}`;
                                        if (blocksMap.has(key)) {
                                            const b = blocksMap.get(key);
                                            if (b.typeId === BLOCK_TYPES.IRONORE.id || b.typeId === BLOCK_TYPES.COAL.id) {
                                                nearOre = true;
                                            }
                                        }
                                    }
                                }
                            }
                            if (nearOre) {
                                showStatus(`🪨 采集了 ${blockName} → +1 石头 (库存: ${inventory.stone}) ⚡ 附近有矿石！`);
                            } else {
                                showStatus(`🪨 采集了 ${blockName} → +1 石头 (库存: ${inventory.stone})`);
                            }
                        } else if (typeId === BLOCK_TYPES.WOOD.id) {
                            inventory.wood = (inventory.wood || 0) + 1;
                            showStatus(`🪵 采集了 ${blockName} → +1 木头 (库存: ${inventory.wood})`);
                        } else if (typeId === BLOCK_TYPES.PLANKS.id) {
                            inventory.planks = (inventory.planks || 0) + 1;
                            totalCollected++;
                            showStatus(`🟫 采集了 ${blockName} → +1 木板 (库存: ${inventory.planks})`);
                        } else if (typeId === BLOCK_TYPES.LEAVES.id) {
                            showStatus(`🍃 采集了 ${blockName} (树叶不获得材料)`);
                        } else if (typeId === BLOCK_TYPES.SAND.id) {
                            inventory.sand = (inventory.sand || 0) + 1;
                            totalCollected++;
                            showStatus(`🟨 采集了 ${blockName} → +1 沙子 (库存: ${inventory.sand})`);
                        } else if (typeId === BLOCK_TYPES.IRONORE.id) {
                            if (totalCollected < 100) {
                                // 未达到100块材料：铁矿石当作普通石头掉落
                                inventory.stone = (inventory.stone || 0) + 1;
                                totalCollected++;
                                showStatus(`🪨 采集了 ${blockName} → +1 石头 (库存: ${inventory.stone}) [铁/煤矿未解锁：需累计采集 ${100 - totalCollected} 块材料]`);
                            } else {
                                inventory.iron = (inventory.iron || 0) + 1;
                                totalCollected++;
                                showStatus(`⛏️ 采集了铁矿石 → +1 铁 (库存: ${inventory.iron})`);
                            }
                        } else if (typeId === BLOCK_TYPES.COAL.id) {
                            if (totalCollected < 100) {
                                // 未达到100块材料：煤矿当作普通石头掉落
                                inventory.stone = (inventory.stone || 0) + 1;
                                totalCollected++;
                                showStatus(`🪨 采集了 ${blockName} → +1 石头 (库存: ${inventory.stone}) [铁/煤矿未解锁：需累计采集 ${100 - totalCollected} 块材料]`);
                            } else {
                                inventory.coal = (inventory.coal || 0) + 1;
                                totalCollected++;
                                showStatus(`⛏️ 采集了煤矿石 → +1 煤 (库存: ${inventory.coal})`);
                            }
                        } else if (typeId === BLOCK_TYPES.COBBLE.id) {
                            inventory.cobble = (inventory.cobble || 0) + 1;
                            totalCollected++;
                            showStatus(`🪨 采集了 ${blockName} → +1 圆石 (库存: ${inventory.cobble})`);
                        } else if (typeId === BLOCK_TYPES.SBRICK.id) {
                            inventory.sbrick = (inventory.sbrick || 0) + 1;
                            totalCollected++;
                            showStatus(`🧱 采集了 ${blockName} → +1 石砖 (库存: ${inventory.sbrick})`);
                        } else if (typeId === BLOCK_TYPES.BRICK.id) {
                            inventory.brick = (inventory.brick || 0) + 1;
                            totalCollected++;
                            showStatus(`🧱 采集了 ${blockName} → +1 红砖 (库存: ${inventory.brick})`);
                        } else if (typeId === BLOCK_TYPES.GLASS.id) {
                            inventory.glass = (inventory.glass || 0) + 1;
                            totalCollected++;
                            showStatus(`🔲 采集了 ${blockName} → +1 玻璃 (库存: ${inventory.glass})`);
                        } else if (typeId === BLOCK_TYPES.GLOW.id) {
                            showStatus(`💡 采集了 ${blockName} (发光石不获得材料)`);
                        } else if (typeId === BLOCK_TYPES.OBSIDIAN.id) {
                            inventory.obsidian = (inventory.obsidian || 0) + 1;
                            totalCollected++;
                            showStatus(`⚫ 采集了 ${blockName} → +1 黑曜石 (库存: ${inventory.obsidian})`);
                        } else if (typeId === BLOCK_TYPES.SNOW.id) {
                            inventory.snow = (inventory.snow || 0) + 1;
                            totalCollected++;
                            showStatus(`❄️ 采集了 ${blockName} → +1 雪 (库存: ${inventory.snow})`);
                        } else if (typeId === BLOCK_TYPES.TABLE.id) {
                            inventory.table = (inventory.table || 0) + 1;
                            totalCollected++;
                            showStatus(`📋 采集了 ${blockName} → +1 工作台 (库存: ${inventory.table})`);
                        } else if (typeId === BLOCK_TYPES.TORCH.id) {
                            inventory.torch = (inventory.torch || 0) + 1;
                            totalCollected++;
                            showStatus(`🔥 采集了 ${blockName} → +1 火把 (库存: ${inventory.torch})`);
                        } else if (typeId === BLOCK_TYPES.WATER.id) {
                            showStatus(`💧 采集了水 (水不获得材料)`);
                        } else {
                            showStatus(`⛏️ 采集了 ${blockName}`);
                        }
                        
                        // 更新库存显示
                        updateInventoryDisplay();
                        
                        // 检查采集里程碑（50块解锁答题、100块解锁矿石、200块解锁金箍棒）
                        checkCollectionMilestones();
                        
                        // 🎮 金币奖励 + 挖矿特效 + 每日任务
                        const parts = key.split(',');
                        const bx = +parts[0], by = +parts[1], bz = +parts[2];
                        const blockColor = (BLOCK_TYPES[blockKey] && BLOCK_TYPES[blockKey].color) ? BLOCK_TYPES[blockKey].color : 0xffff88;
                        spawnCollectEffect(bx, by, bz, blockColor);
                        blocksMinedToday++;
                        updateDailyTask('mine', 1);
                        if (totalCollected % 5 === 0) {  // 每5块给1金币（不弹窗避免抖动）
                            coins++;
                            totalCoinsEarned++;
                            _coinsDirty = true;
                            updateCoinsUI();
                        }
                        // 徽章检查：仅在关键节点触发（50/100/200/500块）
                        if ([50,100,200,500].includes(totalCollected)) checkBadges();
                        
                        // 采集方块时随机朗读教材内容
                        maybeReadOnCollect();
                        
                        // 采集方块时随机触发迷你游戏挑战（需累计采集 ≥ 50 块材料）
                        maybeStartMiniGame();
                    } else {
                        showStatus('❌ 基岩无法采集！');
                    }
                } else if (event.button === 2) {
                    // 右键 - 放置
                    const item = hotbarItems[selectedBlockIndex];
                    // 右键点击工作台方块 → 打开合成界面（不论手持什么物品）
                    if (typeId === BLOCK_TYPES.TABLE.id) {
                        if (!craftingOpen) toggleCrafting();
                        return;
                    }
                    // 手持工作台物品 → 放置
                    if (item.id === BLOCK_TYPES.TABLE.id) {
                        if (inventory.table > 0) {
                            inventory.table--;
                            const normal = intersect.face ? intersect.face.normal : null;
                            if (!normal) return;
                            const targetX = bx + normal.x;
                            const targetY = by + normal.y;
                            const targetZ = bz + normal.z;
                            const playerPos = getPlayerPos();
                            const dist = Math.hypot(playerPos.x - targetX, playerPos.z - targetZ);
                            if (dist < 0.6 && Math.abs(playerPos.y - targetY) < 1.5) return;
                            addBlock(targetX, targetY, targetZ, BLOCK_TYPES.TABLE);
                            playPlaceSound();
                            showStatus(`📋 放置了工作台 (剩余: ${inventory.table})`);
                            return;
                        } else {
                            showStatus('❌ 没有工作台！先合成一个（4木板→工作台）');
                            return;
                        }
                    } else if (item.icon) {
                        // 坦克：右键召唤载具
                        if (item.name === '坦克') {
                            spawnTank();
                            return;
                        }
                        // 锄头：右键点击泥土/草地 → 转化为耕地
                        if (item.name === '锄头' && (typeId === BLOCK_TYPES.DIRT.id || typeId === BLOCK_TYPES.GRASS.id)) {
                            removeBlock(key);
                            addBlock(bx, by, bz, BLOCK_TYPES.FARMLAND);
                            playPlaceSound();
                            showStatus('🌱 耕地已准备好，用种子播种！');
                            return;
                        }
                        // 工具不能放置
                        return;
                    }
                    // 普通方块放置
                    const normal = intersect.face ? intersect.face.normal : null;
                    if (!normal) return;
                    const targetX = bx + normal.x;
                    const targetY = by + normal.y;
                    const targetZ = bz + normal.z;
                    const playerPos = getPlayerPos();
                    const dist = Math.hypot(playerPos.x - targetX, playerPos.z - targetZ);
                    if (dist < 0.6 && Math.abs(playerPos.y - targetY) < 1.5) {
                        return;
                    }
                    // 农业：右键点击耕地时自动播种（消耗1种子）
                    if (typeId === BLOCK_TYPES.FARMLAND.id && inventory.seeds > 0) {
                        inventory.seeds--;
                        addBlock(targetX, targetY, targetZ, BLOCK_TYPES.CROP);
                        setBlockCropStage(`${targetX},${targetY},${targetZ}`, 0);
                        playPlaceSound();
                        showStatus(`🌱 播种了作物！(剩余种子: ${inventory.seeds})`);
                        updateInventoryDisplay();
                        return;
                    }
                    addBlock(targetX, targetY, targetZ, item);
                    playPlaceSound();
                    // 🎮 放置方块任务 + 徽章
                    totalBlocksPlaced++;
                    updateDailyTask('place', 1);
                    checkBadges();
                }
            }
        }

        // 滚轮切换快捷栏物品
        function onWheel(event) {
            if (!gameActive) return;
            const direction = event.deltaY > 0 ? 1 : -1;
            let newIndex = selectedBlockIndex;
            const total = hotbarItems.length;
            // 循环切换所有可用物品（跳过未合成的工具/武器）
            for (let i = 0; i < total; i++) {
                newIndex = (newIndex + direction + total) % total;
                const item = hotbarItems[newIndex];
                if (item && isItemAvailable(item)) {
                    selectSlot(newIndex);
                    return;
                }
            }
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        // 简易物理与碰撞计算
        function updatePhysics(delta) {
            // 坦克驾驶模式：跳过玩家物理移动（坦克自带位置同步）
            if (tankDriving) return;
            
            // 统一使用 playerModel.position 作为玩家脚底位置（两种模式共用）
            const pos = playerModel.position;
            const halfW = 0.3;
            const height = PLAYER_HEIGHT;

            // 检测是否在水中（头/脚位置）
            const headKey = `${Math.round(pos.x)},${Math.floor(pos.y + height - 0.2)},${Math.round(pos.z)}`;
            const feetKey = `${Math.round(pos.x)},${Math.floor(pos.y + 0.1)},${Math.round(pos.z)}`;
            const inWater = (blocksMap.has(headKey) && blocksMap.get(headKey).typeId === BLOCK_TYPES.WATER.id) ||
                            (blocksMap.has(feetKey) && blocksMap.get(feetKey).typeId === BLOCK_TYPES.WATER.id);

            // 检测是否在熔岩中（火山口危险）
            const inLava = (blocksMap.has(feetKey) && blocksMap.get(feetKey).typeId === BLOCK_TYPES.LAVA.id) ||
                           (blocksMap.has(headKey) && blocksMap.get(headKey).typeId === BLOCK_TYPES.LAVA.id);
            if (inLava && !flying && !playerDead) {
                // 熔岩每秒造成伤害（用时间累加，避免每帧多次 takeDamage）
                lavaBurnAccum += delta;
                if (lavaBurnAccum >= 0.5) {
                    lavaBurnAccum = 0;
                    takeDamage(3);
                    showStatus('🌋 熙烫的熔岩！快离开火山口！');
                }
            } else {
                lavaBurnAccum = 0;
            }

            // 获取相机在世界空间的前进/右方向向量
            const camForward = new THREE.Vector3();
            camera.getWorldDirection(camForward);
            camForward.y = 0;
            camForward.normalize();
            const camRight = new THREE.Vector3();
            camRight.crossVectors(camForward, camera.up).normalize();

            // 计算移动方向
            direction.set(0, 0, 0);
            if (moveForward) direction.add(camForward);
            if (moveBackward) direction.sub(camForward);
            if (moveRight) direction.add(camRight);
            if (moveLeft) direction.sub(camRight);
            if (direction.lengthSq() > 0) direction.normalize();

            // 移动力（飞行最快，冲刺次之，水中最慢）
            // 飞行+Shift = 加速冲刺（筋斗云模式）
            const moveForce = flying 
                ? (sprintHeld ? 150.0 : 80.0)  // 飞行加速
                : (inWater ? 18.0 : (sprintHeld ? 60.0 : 40.0));
            velocity.x += direction.x * moveForce * delta;
            velocity.z += direction.z * moveForce * delta;

            // 水中浮力（飞行时跳过）
            if (inWater && !flying) {
                velocity.x -= velocity.x * 5.0 * delta;
                velocity.z -= velocity.z * 5.0 * delta;
                // 水中无重力，只有浮力 + 水阻力
                velocity.y -= velocity.y * 3.0 * delta;  // 水阻力（减速）
                if (jumpHeld) velocity.y += 30.0 * delta;   // 空格：向上游
                if (sprintHeld) velocity.y -= 20.0 * delta; // Shift：向下潜
                velocity.y += 12.0 * delta;                 // 净浮力（缓慢上浮）
                canJump = true;
            }

            // 摩擦力
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            if (flying) {
                // 飞行模式：Space 上升，Q 下降，Shift 加速，无重力
                if (jumpHeld) velocity.y += 40.0 * delta;
                if (flyDownHeld) velocity.y -= 40.0 * delta;
                velocity.y -= velocity.y * 5.0 * delta;
            } else if (!inWater) {
                // 重力（仅在非水中、非飞行时生效；水中由浮力接管）
                velocity.y -= 9.8 * 2.5 * delta;
            }
            if (velocity.y < -60) velocity.y = -60;
            if (velocity.y > MAX_RISE_SPEED) velocity.y = MAX_RISE_SPEED;

            // === 脱困检查：玩家卡在方块内时向上推出 ===
            if (!flying && checkCollision(pos.x, pos.y, pos.z, halfW, height)) {
                const groundY = dungeonState.active ? 0 : getGroundY(pos.x, pos.z);
                // 只要低于地面0.2以上就脱困（不要求速度为0）
                if (pos.y < groundY - 0.2) {
                    for (let step = 0.1; step <= 8.0; step += 0.1) {
                        if (!checkCollision(pos.x, pos.y + step, pos.z, halfW, height)) {
                            pos.y += step;
                            velocity.y = 0;
                            break;
                        }
                    }
                }
            }

            // X 轴移动 + 碰撞检测（飞行也检测碰撞，不能穿过地形）
            const newX = pos.x + velocity.x * delta;
            if (!checkCollision(newX, pos.y, pos.z, halfW, height)) {
                pos.x = newX;
            } else {
                // 尝试小幅度移动（防止卡住），但不自动上台阶
                const tinyStepX = velocity.x * delta * 0.05;
                if (!checkCollision(pos.x + tinyStepX, pos.y, pos.z, halfW, height)) {
                    pos.x += tinyStepX;
                } else {
                    velocity.x = 0;
                }
            }

            // Z 轴移动 + 碰撞检测（飞行也检测碰撞，不能穿过地形）
            const newZ = pos.z + velocity.z * delta;
            if (!checkCollision(pos.x, pos.y, newZ, halfW, height)) {
                pos.z = newZ;
            } else {
                // 尝试小幅度移动（防止卡住），但不自动上台阶
                const tinyStepZ = velocity.z * delta * 0.05;
                if (!checkCollision(pos.x, pos.y, pos.z + tinyStepZ, halfW, height)) {
                    pos.z += tinyStepZ;
                } else {
                    velocity.z = 0;
                }
            }

            // Y 轴移动 + 碰撞检测（飞行也检测碰撞，不能穿过地形）
            const newY = pos.y + velocity.y * delta;
            // 副本内使用副本地板高度（y=0），不使用地形高度
            const groundY = dungeonState.active ? 0 : getGroundY(pos.x, pos.z);
            
            if (velocity.y < 0) {
                // 向下移动（飞行下降或重力下落）
                if (newY <= groundY) {
                    // 到达或穿过地面高度，吸附到地面（加0.02缓冲防止卡入方块）
                    pos.y = groundY + 0.02;
                    velocity.y = 0;
                    canJump = true;
                } else if (!checkCollision(pos.x, newY, pos.z, halfW, height)) {
                    pos.y = newY;
                    if (!inWater && !flying) canJump = false;
                } else {
                    // 碰撞，吸附到地面（加0.02缓冲）
                    pos.y = groundY + 0.02;
                    velocity.y = 0;
                    canJump = true;
                }
            } else if (!checkCollision(pos.x, newY, pos.z, halfW, height)) {
                // 向上移动（飞行上升或跳跃）：无碰撞则移动
                pos.y = newY;
                if (!inWater && !flying) canJump = false;
            } else {
                // 向上碰撞（撞天花板）：停止
                velocity.y = 0;
            }
            
            // === 副本边界限制（防止玩家离开副本房间）===
            if (dungeonState.active) {
                const minX = DUNGEON_ORIGIN_X - DUNGEON_HALF + 0.5;
                const maxX = DUNGEON_ORIGIN_X + DUNGEON_HALF - 0.5;
                const minZ = DUNGEON_ORIGIN_Z - DUNGEON_HALF + 0.5;
                const maxZ = DUNGEON_ORIGIN_Z + DUNGEON_HALF - 0.5;
                if (pos.x < minX) { pos.x = minX; velocity.x = 0; }
                if (pos.x > maxX) { pos.x = maxX; velocity.x = 0; }
                if (pos.z < minZ) { pos.z = minZ; velocity.z = 0; }
                if (pos.z > maxZ) { pos.z = maxZ; velocity.z = 0; }
                // 防止掉出副本地板
                if (pos.y < 0.5) { pos.y = 0.5; velocity.y = 0; }
            }
            
            // 防卡住机制：如果玩家完全无法移动，尝试脱困
            const speedSq = velocity.x * velocity.x + velocity.z * velocity.z;
            if (speedSq < 0.01 && (moveForward || moveBackward || moveLeft || moveRight) && !flying) {
                // 记录卡住时间，超过0.8秒强制跳起脱困
                if (!pos._stuckTimer) pos._stuckTimer = 0;
                pos._stuckTimer += delta;
                if (canJump || pos._stuckTimer > 0.8) {
                    velocity.y = 14;  // 更高一点的跳跃力度
                    canJump = false;
                    pos._stuckTimer = 0;
                }
            } else {
                if (pos._stuckTimer) pos._stuckTimer = 0;
            }
            
            // 保护神碰撞检测（奶奶/爷爷不能被穿过）
            if (!flying && playerModel) {
                const pPos = playerModel.position;
                for (const mob of mobs) {
                    if (mob.guardian && mob.mesh && mob.mesh.visible) {
                        const gx = mob.mesh.position.x;
                        const gz = mob.mesh.position.z;
                        const gy = mob.mesh.position.y;
                        const gs = mob.type.scale || 1.0;
                        // 保护神碰撞箱：宽度0.7*scale，高度1.4*scale
                        const gHalfW = (0.7 * gs) / 2;
                        const gHeight = 1.4 * gs;
                        const gY0 = gy - gHeight / 2;
                        const gY1 = gy + gHeight / 2;
                        
                        // 检查玩家是否与保护神碰撞
                        const px0 = pPos.x - halfW, px1 = pPos.x + halfW;
                        const py0 = pPos.y, py1 = pPos.y + height;
                        const pz0 = pPos.z - halfW, pz1 = pPos.z + halfW;
                        const gx0 = gx - gHalfW, gx1 = gx + gHalfW;
                        const gz0 = gz - gHalfW, gz1 = gz + gHalfW;
                        
                        if (px0 < gx1 && px1 > gx0 && py0 < gY1 && py1 > gY0 && pz0 < gz1 && pz1 > gz0) {
                            // 碰撞！阻止玩家移动
                            velocity.x = 0;
                            velocity.z = 0;
                            // 将玩家推出保护神
                            const pushDir = new THREE.Vector3().subVectors(pPos, new THREE.Vector3(gx, gy, gz));
                            pushDir.y = 0;
                            pushDir.normalize();
                            if (pushDir.length() > 0) {
                                pos.x += pushDir.x * 0.5;
                                pos.z += pushDir.z * 0.5;
                            }
                            break;
                        }
                    }
                }
            }

            // 玩家模型面向移动方向
            if (Math.abs(velocity.x) > 0.01 || Math.abs(velocity.z) > 0.01) {
                playerModel.rotation.y = Math.atan2(velocity.x, velocity.z);
            }

            // 走路动画：腿部/手臂交替摆动
            if (playerLegL && playerLegR && playerArmL && playerArmR) {
                const hSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
                if (attackTimer > 0) {
                    // 攻击动画：手臂向前挥动
                    attackTimer -= delta;
                    const t = 1 - (attackTimer / 0.3); // 0到1的进度
                    const swing = Math.sin(t * Math.PI) * 1.2; // 攻击摆动幅度
                    playerArmR.rotation.x = -1.5 + swing; // 右手向前挥动
                    // 盾牌时左手保持举起状态
                    if (!shieldVisible) {
                        playerArmL.rotation.x = swing * 0.3; // 左手轻微摆动
                    }
                    // 攻击时腿部站稳
                    playerLegL.rotation.x = 0.2;
                    playerLegR.rotation.x = -0.2;
                } else if (hSpeed > 0.1 && !flying) {
                    walkPhase += hSpeed * delta * 5.0;
                    const swing = Math.sin(walkPhase) * 0.5;
                    playerLegL.rotation.x = swing;
                    playerLegR.rotation.x = -swing;
                    // 盾牌时左手举起挡在身前，不摆动
                    if (shieldVisible) {
                        playerArmL.rotation.x = -0.6; // 左手抬起
                        playerArmL.rotation.z = 0.2;
                    } else {
                        playerArmL.rotation.x = -swing * 0.8;
                        playerArmL.rotation.z = 0;
                    }
                    playerArmR.rotation.x = swing * 0.8;
                } else {
                    // 静止时缓慢回正
                    playerLegL.rotation.x *= 0.85;
                    playerLegR.rotation.x *= 0.85;
                    // 盾牌时左手保持举起
                    if (shieldVisible) {
                        playerArmL.rotation.x += (-0.6 - playerArmL.rotation.x) * 0.15;
                        playerArmL.rotation.z += (0.2 - playerArmL.rotation.z) * 0.15;
                    } else {
                        playerArmL.rotation.x *= 0.85;
                        playerArmL.rotation.z *= 0.85;
                    }
                    playerArmR.rotation.x *= 0.85;
                }
            }
            
            // 筋斗云动画（飞行时上下浮动）
            if (cloudMesh && flying) {
                cloudMesh.visible = true;
                const bobTime = gameTime * 3;
                cloudMesh.position.y = -0.3 + Math.sin(bobTime) * 0.15;
                // 云朵缓慢旋转
                cloudMesh.rotation.y += delta * 0.5;
                // 加速时云朵变大
                if (sprintHeld) {
                    cloudMesh.scale.set(1.3, 1.3, 1.3);
                } else {
                    cloudMesh.scale.set(1.0, 1.0, 1.0);
                }
            } else if (cloudMesh) {
                cloudMesh.visible = false;
                cloudMesh.scale.set(1.0, 1.0, 1.0);
            }

            // 相机定位
            if (thirdPerson) {
                // 第三人称：相机在玩家身后
                const camDir = new THREE.Vector3();
                camera.getWorldDirection(camDir);
                camDir.y = 0;
                camDir.normalize();
                camera.position.set(
                    pos.x - camDir.x * 5,
                    pos.y + 2.5,
                    pos.z - camDir.z * 5
                );
                camera.lookAt(pos.x, pos.y + 1.5, pos.z);
            } else {
                // 第一人称：相机在玩家眼睛位置，保持鼠标视角
                camera.position.set(pos.x, pos.y + 1.6, pos.z);
            }

            // 掉落重生（飞行模式不重生）
            if (!flying && pos.y < -10) {
                velocity.set(0, 0, 0);
                const respawnGroundY = getGroundY(0, 0);
                pos.set(0, Math.max(respawnGroundY, WATER_LEVEL_Y + 0.6), 0);
            }
            // 防穿地：如果玩家脚底低于地面高度，传送到地面（防止掉入未加载区域）
            if (!flying && pos.y < -2) {
                const groundY = getGroundY(pos.x, pos.z);
                if (pos.y < groundY - 0.5) {
                    pos.y = groundY;
                    velocity.y = 0;
                    canJump = true;
                }
            }
        }

        // 帧率与渲染循环
        let frameCount = 0;
        let lastFpsTime = performance.now();

        // === 坦克系统（可召唤载具，玩家可进入驾驶）===
        const tanks = [];
        const tankBullets = [];
        let tankDriving = false;
        let currentTank = null;

        function spawnTank() {
            if (tanks.length >= 3) {
                showStatus('❌ 最多同时召唤3辆坦克！');
                return;
            }
            const group = new THREE.Group();
            // === 配色 ===
            const hullMat = new THREE.MeshLambertMaterial({ color: 0x3a4a2a });
            const hullDark = new THREE.MeshLambertMaterial({ color: 0x2a3a1a });
            const trackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
            const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
            const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const barrelMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });

            // === 车身（HULL）===
            // 主车身
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 3.2), hullMat);
            body.position.y = 0.5;
            group.add(body);
            // 倾斜前装甲
            const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.8), hullDark);
            frontPlate.position.set(0, 0.7, -1.6);
            frontPlate.rotation.x = -0.3;
            group.add(frontPlate);
            // 前保险杠
            const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 0.4), hullDark);
            bumper.position.set(0, 0.3, -1.7);
            group.add(bumper);
            // 后引擎盖
            const engineCover = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.0), hullDark);
            engineCover.position.set(0, 0.9, 1.2);
            group.add(engineCover);
            // 排烟口
            const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), barrelMat);
            smokestack.position.set(0.6, 1.2, 1.2);
            group.add(smokestack);
            // 天线
            const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4), metalMat);
            antenna.position.set(-0.8, 1.6, 1.0);
            group.add(antenna);
            // 车灯
            const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), lightMat);
            lightL.position.set(-0.8, 0.3, -1.6);
            group.add(lightL);
            const lightR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), lightMat);
            lightR.position.set(0.8, 0.3, -1.6);
            group.add(lightR);

            // === 炮塔组（TURRET - 可旋转瞄准）===
            const turretGroup = new THREE.Group();
            turretGroup.position.y = 1.0;
            group.add(turretGroup);
            // 炮塔底座
            const turretBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.8), hullMat);
            turretBase.position.y = 0.15;
            turretGroup.add(turretBase);
            // 炮塔主体
            const turretBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), hullMat);
            turretBody.position.y = 0.5;
            turretGroup.add(turretBody);
            // 炮塔顶部
            const turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.0), hullDark);
            turretTop.position.y = 0.85;
            turretGroup.add(turretTop);
            // 舱盖
            const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), hullDark);
            hatch.position.set(0.3, 0.95, 0.2);
            turretGroup.add(hatch);
            // 瞄准镜
            const sight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.4), metalMat);
            sight.position.set(-0.3, 0.7, -0.6);
            turretGroup.add(sight);

            // === 炮管组（BARREL - 跟随炮塔旋转）===
            const barrelGroup = new THREE.Group();
            barrelGroup.position.set(0, 0.5, 0);
            turretGroup.add(barrelGroup);
            // 炮尾
            const breech = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.7), metalMat);
            breech.position.z = -0.3;
            barrelGroup.add(breech);
            // 主炮管
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.5, 8), barrelMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = -1.4;
            barrelGroup.add(barrel);
            // 炮口制退器
            const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), metalMat);
            muzzleBrake.position.z = -2.7;
            barrelGroup.add(muzzleBrake);
            // 炮口（弹丸发射点）
            const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0x333333 }));
            muzzle.position.z = -2.9;
            barrelGroup.add(muzzle);

            // === 履带系统（TRACKS）===
            // 左侧履带框架
            const trackFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 3.0), trackMat);
            trackFrameL.position.set(-1.2, 0.35, 0);
            group.add(trackFrameL);
            // 右侧履带框架
            const trackFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 3.0), trackMat);
            trackFrameR.position.set(1.2, 0.35, 0);
            group.add(trackFrameR);
            // 履带轮（每侧6个圆柱轮）
            const wheelPositions = [-1.4, -0.9, -0.4, 0.1, 0.6, 1.1];
            for (const wz of wheelPositions) {
                const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.35, 8), wheelMat);
                wheelL.rotation.z = Math.PI / 2;
                wheelL.position.set(-1.2, 0.25, wz);
                group.add(wheelL);
                const wheelR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.35, 8), wheelMat);
                wheelR.rotation.z = Math.PI / 2;
                wheelR.position.set(1.2, 0.25, wz);
                group.add(wheelR);
            }
            // 履带板面
            const trackPlateL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 3.0), trackMat);
            trackPlateL.position.set(-1.2, 0.65, 0);
            group.add(trackPlateL);
            const trackPlateR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 3.0), trackMat);
            trackPlateR.position.set(1.2, 0.65, 0);
            group.add(trackPlateR);

            // === 名字标签 ===
            const label = makeNameTag('坦克', '#ffcc00', 'tǎn kè');
            label.position.y = 2.0;
            group.add(label);

            // 放在玩家前方
            const playerPos = getPlayerPos();
            group.position.set(playerPos.x, playerPos.y, playerPos.z);
            scene.add(group);

            tanks.push({
                mesh: group,
                turret: turretGroup,
                barrelGroup: barrelGroup,
                barrel: barrel,
                muzzle: muzzle,
                fireTimer: 0.5,
                lifetime: 9999,
                driverIn: false,
                speed: 0
            });
            showStatus('⚙️ 坦克已部署！走近按 F 进入驾驶');
        }

        // 进入坦克驾驶
        function enterTank(tank) {
            if (tankDriving || !tank) return;
            tankDriving = true;
            currentTank = tank;
            tank.driverIn = true;
            // 隐藏玩家模型
            if (playerModel) playerModel.visible = false;
            if (playerArm) playerArm.visible = false;
            // 锁定鼠标
            controls.lock();
            showStatus('🎮 进入坦克！WASD驾驶 鼠标瞄准 F退出');
        }

        // 退出坦克驾驶
        function exitTank() {
            if (!tankDriving || !currentTank) return;
            currentTank.driverIn = false;
            currentTank = null;
            tankDriving = false;
            // 显示玩家模型
            if (playerModel) playerModel.visible = true;
            if (playerArm) playerArm.visible = !thirdPerson;
            showStatus('🎮 已退出坦克');
        }

        function updateTanks(delta) {
            for (let i = tanks.length - 1; i >= 0; i--) {
                const tank = tanks[i];
                // 耐久耗尽
                tank.lifetime -= delta;
                if (tank.lifetime <= 0) {
                    if (tankDriving && currentTank === tank) exitTank();
                    scene.remove(tank.mesh);
                    tanks.splice(i, 1);
                    showStatus('⚙️ 坦克已回收（耐久耗尽）');
                    continue;
                }

                if (tank.driverIn && tankDriving) {
                    // === 驾驶模式：玩家操控 ===
                    const pos = tank.mesh.position;
                    // WASD 驱动
                    let dirX = 0, dirZ = 0;
                    if (moveForward) dirZ = -1;
                    if (moveBackward) dirZ = 1;
                    if (moveLeft) dirX = -1;
                    if (moveRight) dirX = 1;
                    // 转向
                    if (dirX !== 0) {
                        tank.mesh.rotation.y += dirX * 1.5 * delta;
                    }
                    // 前/后移动
                    const speed = sprintHeld ? 8.0 : 5.0;
                    if (dirZ !== 0) {
                        const moveX = Math.sin(tank.mesh.rotation.y) * dirZ * speed * delta;
                        const moveZ = -Math.cos(tank.mesh.rotation.y) * dirZ * speed * delta;
                        tank.mesh.position.x += moveX;
                        tank.mesh.position.z += moveZ;
                    }
                    // 贴合地面
                    tank.mesh.position.y = getGroundY(pos.x, pos.z);
                    // 跟随坦克同步玩家位置
                    const pp = getPlayerPos();
                    pp.x = tank.mesh.position.x;
                    pp.z = tank.mesh.position.z;
                    pp.y = tank.mesh.position.y;

                    // === 炮塔瞄准（鼠标）===
                    if (mouseDeltaX !== 0) {
                        tank.turret.rotation.y -= mouseDeltaX * 0.003;
                    }
                    mouseDeltaX = 0;
                    mouseDeltaY = 0;

                    // === 相机在炮塔后方 ===
                    const camOffset = new THREE.Vector3(0, 3.5, 4.0);
                    camOffset.applyEuler(new THREE.Euler(0, tank.turret.rotation.y, 0));
                    camera.position.set(
                        tank.mesh.position.x + camOffset.x,
                        tank.mesh.position.y + camOffset.y,
                        tank.mesh.position.z + camOffset.z
                    );
                    camera.lookAt(
                        tank.mesh.position.x,
                        tank.mesh.position.y + 1.0,
                        tank.mesh.position.z
                    );
                } else {
                    // === 自动驾驶模式 ===
                    const pp = getPlayerPos();
                    tank.mesh.rotation.y = Math.atan2(pp.x - tank.mesh.position.x, pp.z - tank.mesh.position.z);
                    // 跟随玩家
                    const dx = pp.x - tank.mesh.position.x;
                    const dz = pp.z - tank.mesh.position.z;
                    const dist = Math.hypot(dx, dz);
                    if (dist > 8) {
                        const moveX = (dx / dist) * 6.0 * delta;
                        const moveZ = (dz / dist) * 6.0 * delta;
                        tank.mesh.position.x += moveX;
                        tank.mesh.position.z += moveZ;
                    }
                    tank.mesh.position.y = getGroundY(tank.mesh.position.x, tank.mesh.position.z);

                    // 自动炮击
                    tank.fireTimer -= delta;
                    if (tank.fireTimer <= 0) {
                        tank.fireTimer = 2.5;
                        let nearest = null, nd = 30;
                        for (const mob of mobs) {
                            if (!mob.alive || !mob.type.hostile) continue;
                            const d = Math.hypot(mob.mesh.position.x - tank.mesh.position.x, mob.mesh.position.z - tank.mesh.position.z);
                            if (d < nd) { nd = d; nearest = mob; }
                        }
                        if (nearest) {
                            fireTankShot(tank, nearest);
                        }
                    }
                }
            }

            // 更新炮弹
            for (let i = tankBullets.length - 1; i >= 0; i--) {
                const b = tankBullets[i];
                b.userData.life -= delta;
                if (b.userData.life <= 0) { scene.remove(b); tankBullets.splice(i, 1); continue; }
                b.position.add(b.userData.velocity.clone().multiplyScalar(delta));
                let hit = false;
                for (const mob of mobs) {
                    if (!mob.alive || !mob.type.hostile) continue;
                    const dx = mob.mesh.position.x - b.position.x, dy = mob.mesh.position.y - b.position.y, dz = mob.mesh.position.z - b.position.z;
                    if (dx*dx + dy*dy + dz*dz < 1.5) {
                        mob.hp -= b.userData.damage;
                        if (mob.healthBar) updateHealthBar(mob.healthBar, mob.hp);
                        createExplosionParticles(mob.mesh.position, 0xffaa00, 20);
                        mob.provoked = true;
                        mob.provokeTimer = 15;
                        showStatus(`💥 坦克炮击 ${mob.type.name} (-${b.userData.damage}, 剩${Math.max(0,Math.ceil(mob.hp))})`);
                        if (mob.hp <= 0) { scene.remove(mob.mesh); mob.alive = false; showStatus(`💀 ${mob.type.name} 被坦克击毁！`); onMobDefeated(mob); }
                        hit = true;
                        break;
                    }
                }
                if (hit) { scene.remove(b); tankBullets.splice(i, 1); }
            }
        }

        // 坦克开火
        function fireTankShot(tank, target) {
            const bullet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
            // 从炮口位置发射
            const muzzleWorldPos = new THREE.Vector3();
            tank.muzzle.getWorldPosition(muzzleWorldPos);
            bullet.position.copy(muzzleWorldPos);
            const dir = new THREE.Vector3().subVectors(target.mesh.position, muzzleWorldPos).normalize();
            bullet.userData = { velocity: dir.multiplyScalar(25), damage: 25, life: 4 };
            scene.add(bullet);
            tankBullets.push(bullet);
            playHitSound();
            // 炮口闪光
            tank.muzzle.material.color.setHex(0xffff00);
            const mz = tank.muzzle;
            setTimeout(() => { if (mz.material) mz.material.color.setHex(0x333333); }, 100);
        }

        // === 攻击特效粒子系统 ===
        const attackParticles = [];
        
        function createHitParticles(pos, color, count) {
            count = count || 8;
            for (let i = 0; i < count; i++) {
                const size = 0.1 + Math.random() * 0.15;
                const geo = new THREE.BoxGeometry(size, size, size);
                const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 });
                const particle = new THREE.Mesh(geo, mat);
                particle.position.copy(pos);
                particle.position.x += (Math.random() - 0.5) * 0.5;
                particle.position.y += (Math.random() - 0.5) * 0.5;
                particle.position.z += (Math.random() - 0.5) * 0.5;
                
                // 随机飞出方向
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 4;
                particle.userData = {
                    vx: Math.cos(angle) * speed,
                    vy: 2 + Math.random() * 3,
                    vz: Math.sin(angle) * speed,
                    life: 0.4 + Math.random() * 0.3,
                    maxLife: 0.4 + Math.random() * 0.3,
                };
                particle.userData.maxLife = particle.userData.life;
                
                scene.add(particle);
                attackParticles.push(particle);
            }
        }
        
        function createExplosionParticles(pos, color, count) {
            count = count || 20;
            for (let i = 0; i < count; i++) {
                const size = 0.15 + Math.random() * 0.25;
                const geo = new THREE.BoxGeometry(size, size, size);
                const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 });
                const particle = new THREE.Mesh(geo, mat);
                particle.position.copy(pos);
                particle.position.x += (Math.random() - 0.5) * 0.8;
                particle.position.y += (Math.random() - 0.5) * 0.8;
                particle.position.z += (Math.random() - 0.5) * 0.8;
                
                const angle = Math.random() * Math.PI * 2;
                const speed = 3 + Math.random() * 6;
                particle.userData = {
                    vx: Math.cos(angle) * speed,
                    vy: 3 + Math.random() * 5,
                    vz: Math.sin(angle) * speed,
                    life: 0.6 + Math.random() * 0.4,
                    maxLife: 0.6 + Math.random() * 0.4,
                };
                particle.userData.maxLife = particle.userData.life;
                
                scene.add(particle);
                attackParticles.push(particle);
            }
        }
        
        function updateAttackParticles(delta) {
            for (let i = attackParticles.length - 1; i >= 0; i--) {
                const p = attackParticles[i];
                p.userData.life -= delta;
                if (p.userData.life <= 0) {
                    scene.remove(p);
                    p.geometry.dispose();
                    p.material.dispose();
                    attackParticles.splice(i, 1);
                    continue;
                }
                // 物理模拟
                p.userData.vy -= 9.8 * delta;
                p.position.x += p.userData.vx * delta;
                p.position.y += p.userData.vy * delta;
                p.position.z += p.userData.vz * delta;
                // 透明度衰减
                p.material.opacity = p.userData.life / p.userData.maxLife;
                // 旋转
                p.rotation.x += delta * 5;
                p.rotation.y += delta * 5;
            }
        }
        
        // === 枪械射击系统（远程弹道）===
        const gunBullets = [];

        function fireGunProjectile(item, targetPos) {
            const playerPos = getPlayerPos();
            const color = item.name === '狙击枪' ? 0x44ffcc : (item.name === '步枪' ? 0xffaa00 : 0xffff88);
            const bullet = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: color }));
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            bullet.position.set(playerPos.x + camDir.x * 0.5, playerPos.y + camDir.y * 0.3 + 0.3, playerPos.z + camDir.z * 0.5);
            const dir = new THREE.Vector3().subVectors(targetPos, bullet.position).normalize();
            const speed = item.name === '狙击枪' ? 60 : (item.name === '步枪' ? 45 : 35);
            bullet.userData = { velocity: dir.multiplyScalar(speed), damage: item.damage || 8, life: 3 };
            scene.add(bullet);
            gunBullets.push(bullet);
            playHitSound();
        }

        function updateGunBullets(delta) {
            for (let i = gunBullets.length - 1; i >= 0; i--) {
                const b = gunBullets[i];
                b.userData.life -= delta;
                if (b.userData.life <= 0) { scene.remove(b); gunBullets.splice(i, 1); continue; }
                b.position.add(b.userData.velocity.clone().multiplyScalar(delta));
                let hit = false;
                for (const mob of mobs) {
                    if (!mob.alive || !mob.type.hostile) continue;
                    const dx = mob.mesh.position.x - b.position.x, dy = mob.mesh.position.y - b.position.y, dz = mob.mesh.position.z - b.position.z;
                    if (dx*dx + dy*dy + dz*dz < 1.0) {
                        mob.hp -= b.userData.damage;
                        if (mob.healthBar) updateHealthBar(mob.healthBar, mob.hp);
                        // 枪击特效：黄色火花
                        createHitParticles(mob.mesh.position, 0xffff00, 6);
                        // 标记怪物被激怒
                        mob.provoked = true;
                        mob.provokeTimer = 15;
                        showStatus(`🔫 射击 ${mob.type.name} (-${b.userData.damage}, 剩${Math.max(0,Math.ceil(mob.hp))})`);
                        if (mob.hp <= 0) { scene.remove(mob.mesh); mob.alive = false; showStatus(`💀 ${mob.type.name} 被击毙！`); onMobDefeated(mob); }
                        hit = true;
                        break;
                    }
                }
                if (hit) { scene.remove(b); gunBullets.splice(i, 1); }
            }
        }

        function animate() {
            requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);

            // 昼夜循环
            gameTime += delta;
            const dayPhase = (gameTime % DAY_LENGTH) / DAY_LENGTH; // 0-1
            // 天空颜色：模拟地球——黎明粉紫→白天蓝→黄昏橙红→夜晚深蓝黑
            let skyColor, lightColor, lightIntensity, ambIntensity;
            if (dayPhase < 0.03) {
                const t = dayPhase / 0.03;
                skyColor = new THREE.Color().lerpColors(new THREE.Color(0x2a2a4a), new THREE.Color(0xff9966), t);
                lightColor = new THREE.Color(0xffaa66); lightIntensity = 0.3; ambIntensity = 0.25;
            } else if (dayPhase < 0.1) {
                const t = (dayPhase - 0.03) / 0.07;
                skyColor = new THREE.Color().lerpColors(new THREE.Color(0xff9966), new THREE.Color(0x87ceeb), t);
                lightColor = new THREE.Color().lerpColors(new THREE.Color(0xff8844), new THREE.Color(0xfff5e0), t);
                lightIntensity = 0.3 + t * 0.55; ambIntensity = 0.25 + t * 0.47;
            } else if (dayPhase < 0.4) {
                skyColor = new THREE.Color(0x87ceeb);
                lightColor = new THREE.Color(0xfff5e0); lightIntensity = 0.85; ambIntensity = 0.72;
            } else if (dayPhase < 0.5) {
                const t = (dayPhase - 0.4) / 0.1;
                skyColor = new THREE.Color().lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0xff6644), t);
                lightColor = new THREE.Color().lerpColors(new THREE.Color(0xfff5e0), new THREE.Color(0xff6622), t);
                lightIntensity = 0.85 - t * 0.55; ambIntensity = 0.72 - t * 0.47;
            } else if (dayPhase < 0.55) {
                const t = (dayPhase - 0.5) / 0.05;
                skyColor = new THREE.Color().lerpColors(new THREE.Color(0xff6644), new THREE.Color(0x0a0a2a), t);
                lightColor = new THREE.Color(0xff4400); lightIntensity = 0.3 - t * 0.22; ambIntensity = 0.25 - t * 0.07;
            } else if (dayPhase < 0.9) {
                skyColor = new THREE.Color(0x0a0a2a);
                lightColor = new THREE.Color(0x4466aa); lightIntensity = 0.08; ambIntensity = 0.18;
            } else {
                const t = (dayPhase - 0.9) / 0.1;
                skyColor = new THREE.Color().lerpColors(new THREE.Color(0x0a0a2a), new THREE.Color(0xff9966), t);
                lightColor = new THREE.Color().lerpColors(new THREE.Color(0x4466aa), new THREE.Color(0xffaa66), t);
                lightIntensity = 0.08 + t * 0.22; ambIntensity = 0.18 + t * 0.07;
            }
            // 天气影响：阴天/雨天天空变暗
            if (currentWeather === 'cloudy' || currentWeather === 'rain' || currentWeather === 'typhoon') {
                skyColor = skyColor.clone().multiplyScalar(0.6);
                lightIntensity *= 0.5;
                ambIntensity *= 0.8;
            }
            scene.background = skyColor;
            scene.fog.color = skyColor;
            if (_sunLight) { _sunLight.color = lightColor; _sunLight.intensity = lightIntensity; }
            if (_hemiLight) {
                _hemiLight.intensity = ambIntensity;
                if (isDaytime()) { _hemiLight.color.setHex(0x87ceeb); _hemiLight.groundColor.setHex(0x6b4423); }
                else { _hemiLight.color.setHex(0x2a3a5a); _hemiLight.groundColor.setHex(0x1a1a2a); }
            }

            // 太阳和月亮位置更新
            if (sunMesh) {
                const isDay = isDaytime();
                sunMesh.visible = isDay;
                if (isDay) {
                    const sunAngle = (dayPhase / 0.5) * Math.PI;
                    sunMesh.position.set(Math.cos(sunAngle) * 150, Math.sin(sunAngle) * 100 + 20, -80);
                    const sunH = Math.sin(sunAngle);
                    if (sunH < 0.2) sunMesh.material.color.setHex(0xff4400);
                    else if (sunH < 0.5) sunMesh.material.color.setHex(0xffaa44);
                    else sunMesh.material.color.setHex(0xfff7aa);
                    if (_sunGlow) _sunGlow.material.color.copy(sunMesh.material.color);
                }
            }
            if (moonMesh) {
                const isNight = !isDaytime();
                moonMesh.visible = isNight;
                if (isNight) {
                    const moonProgress = ((dayPhase - 0.5) + 1) % 1 / 0.5;
                    const moonAngle = moonProgress * Math.PI;
                    moonMesh.position.set(-Math.cos(moonAngle) * 150, Math.sin(moonAngle) * 80 + 30, -80);
                    const moonPhase = getMoonPhase();
                    let mb;
                    if (moonPhase < 0.1 || moonPhase > 0.9) mb = 0x2a2a2a;
                    else if (moonPhase < 0.25 || moonPhase > 0.75) mb = 0x6a6a5a;
                    else if (moonPhase < 0.4 || moonPhase > 0.6) mb = 0xa0a090;
                    else mb = 0xf0f0e0;
                    moonMesh.material.color.setHex(mb);
                    if (_moonGlow) _moonGlow.material.opacity = 0.05 + (moonPhase < 0.5 ? moonPhase : 1 - moonPhase) * 0.15;
                }
            }
            
            // 星空显示（夜晚显示）
            if (starField) {
                starField.visible = !isDaytime();
            }

            // 天气云朵显示（阴天/雨天/台风时显示）
            if (weatherCloudMesh) {
                weatherCloudMesh.visible = (currentWeather === 'cloudy' || currentWeather === 'rain' || currentWeather === 'typhoon');
                // 云朵缓慢移动
                weatherCloudMesh.position.x += 0.02 * delta * 60;
                if (weatherCloudMesh.position.x > 100) weatherCloudMesh.position.x = -100;
            }

            // 天气粒子更新
            if (weatherParticles) {
                updateWeatherParticles(delta);
            }

            // 🌸 环境粒子更新（萤火虫/花瓣/光点）
            updateEnvironmentParticles(delta);

            // 天气变化计时
            weatherTimer += delta;
            if (weatherTimer > 60 + Math.random() * 60) { // 每60-120秒换天气
                weatherTimer = 0;
                changeWeather();
            }

            // 怪物 AI 更新
            updateMobs(delta);
            // 攻击特效粒子更新
            updateAttackParticles(delta);
            // 作物生长更新
            updateCrops(delta);
            // 坦克载具更新
            updateTanks(delta);
            // 枪械弹道更新
            updateGunBullets(delta);

            // 传送门动画（旋转光效）
            if (dungeonPortals.length > 0) {
                dungeonPortals.forEach(p => {
                    p.group.children.forEach(child => {
                        if (child.userData && child.userData.isPortal) {
                            child.material.opacity = 0.5 + Math.sin(gameTime * 3) * 0.15;
                        }
                    });
                });
            }
            
            // 城市传送门动画
            if (cityTeleportMarkers.length > 0) {
                cityTeleportMarkers.forEach((cm, i) => {
                    cm.marker.children.forEach(child => {
                        // 底部光环旋转
                        if (child.type === 'Mesh' && child.geometry.type === 'RingGeometry') {
                            child.rotation.z += delta * 2;
                        }
                        // 传送门光效呼吸效果
                        if (child.userData && child.userData.isCityPortal) {
                            child.material.opacity = 0.4 + Math.sin(gameTime * 3 + i) * 0.15;
                        }
                        // 柱顶装饰球上下浮动
                        if (child.type === 'Mesh' && child.geometry.type === 'SphereGeometry') {
                            child.position.y += Math.sin(gameTime * 2 + i) * 0.005;
                        }
                    });
                });
            }
            
            // 传送门弹窗冷却计时器（每帧递减）
            if (cityPortalPromptTimer > 0) cityPortalPromptTimer -= delta;
            
            // 检测附近城市传送门（探索过即自动解锁，已解锁则弹出确认框）
            if (gameActive && playerModel && !cityPortalPromptActive && cityPortalPromptTimer <= 0) {
                const pos = getPlayerPos();
                for (const cm of cityTeleportMarkers) {
                    const dx = pos.x - cm.city.x;
                    const dz = pos.z - cm.city.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 6) {
                        if (!cityTeleportUnlocked.has(cm.city.name)) {
                            cityTeleportUnlocked.add(cm.city.name);
                            // 去抖：避免每帧重复提示
                            if (!cm._justUnlocked || (typeof performance !== 'undefined' ? performance.now() - (cm._justUnlocked || 0) > 3000 : Date.now() - (cm._justUnlocked || 0) > 3000)) {
                                showStatus(`🔓 已探索 ${cm.city.name}，传送门已开启！`);
                                cm._justUnlocked = typeof performance !== 'undefined' ? performance.now() : Date.now();
                            }
                        } else {
                            // 已解锁 → 弹出传送确认框
                            showCityPortalPrompt(cm.city);
                        }
                        break;
                    }
                }
            }
            
            // 检测附近副本传送门
            if (gameActive && playerModel) {
                const pos = getPlayerPos();
                for (const portal of dungeonPortals) {
                    const dx = pos.x - portal.entrance.x;
                    const dz = pos.z - portal.entrance.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 4) {
                        break;
                    }
                }
            }

            // 检测附近保护神（奶奶/爷爷）
            if (gameActive && playerModel) {
                const pos = getPlayerPos();
                nearGuardian = false;
                for (const mob of mobs) {
                    if (mob.type.guardian && mob.mesh.visible) {
                        const dx = pos.x - mob.mesh.position.x;
                        const dz = pos.z - mob.mesh.position.z;
                        if (Math.sqrt(dx * dx + dz * dz) < 8.0) {
                            nearGuardian = true;
                            break;
                        }
                    }
                }

                // 检测附近泽宇（兔子）
                nearZeyu = false;
                for (const mob of mobs) {
                    if (!mob.alive || !mob.mesh.visible) continue;
                    if (mob.type && mob.type.textureKey === 'RABBIT') {
                        const dx = pos.x - mob.mesh.position.x;
                        const dz = pos.z - mob.mesh.position.z;
                        if (Math.sqrt(dx * dx + dz * dz) < 8.0) {
                            nearZeyu = true;
                            break;
                        }
                    }
                }

                // 自动朗读：靠近爷爷/奶奶/泽宇时自动朗读课文
                if (nearGuardian || nearZeyu) {
                    guardianReadTimer += delta;
                    if (guardianReadTimer >= 8.0) {  // 每8秒自动朗读一次
                        guardianReadTimer = 0;
                        startGuardianReading();
                    }
                } else {
                    guardianReadTimer = 0;  // 离开后重置计时器
                }

                // 饥饿值随时间下降
                hungerTimer += delta;
                if (hungerTimer >= 5.0) { // 每 5 秒饥饿 -1
                    hungerTimer = 0;
                    if (hunger > 0) {
                        hunger = Math.max(0, hunger - 1);
                        // 饥饿为 0 时开始掉血
                        if (hunger <= 0) {
                            health = Math.max(0, health - 0.5);
                        }
                    }
                    updateVitalsUI();
                }

                // 自动存档检查
                checkAutoSave();
                
                // 教育标识牌检测
                checkEducationalSigns();

                // 死亡检测 - 出题复活
                if (health <= 0) {
                    health = 0;
                    playerDead = true; // 标记死亡，停止自动存档
                    showDeathQuestion();
                    updateVitalsUI();
                }
            }
            
            // 玩家死亡时暂停游戏更新
            if (gameActive && !playerDead) {
                updatePhysics(delta);
                updateChunks();
            
                const pos = getPlayerPos();
                document.getElementById('pos-val').innerText =
                    `X: ${pos.x.toFixed(1)}, Y: ${pos.y.toFixed(1)}, Z: ${pos.z.toFixed(1)}`;
                // 场景（生物群系）指示
                const biomeEl = document.getElementById('biome-val');
                if (biomeEl) {
                    const biome = getBiomeType(Math.floor(pos.x), Math.floor(pos.z));
                    const biomeName = BIOME_NAMES[biome] || biome;
                    if (biomeEl.textContent !== biomeName) biomeEl.textContent = biomeName;
                    // 自动发现新场景（加入图鉴）
                    discoverBiome(biome);
                }

                // ✨ 更新挖矿粒子特效
                updateCollectEffects(delta);

                // 每日任务步数统计（按移动距离）
                if (lastStepPos) {
                    const moved = Math.hypot(pos.x - lastStepPos.x, pos.z - lastStepPos.z);
                    if (moved > 0.5) {
                        stepAccum += moved;
                        if (stepAccum >= 1.0) {
                            const steps = Math.floor(stepAccum);
                            stepAccum -= steps;
                            updateDailyTask('walk', steps);
                        }
                        lastStepPos.x = pos.x; lastStepPos.z = pos.z;
                    }
                } else {
                    lastStepPos = { x: pos.x, z: pos.z };
                }
            }

            // 水面动画
            if (waterSurface) {
                waterSurface.material.uniforms.time.value = time * 0.001;
                const pos = getPlayerPos();
                waterSurface.position.x = Math.round(pos.x / 2) * 2;
                waterSurface.position.z = Math.round(pos.z / 2) * 2;
            }

            // 状态指示（便于判断当前处于哪个模式）
            const statusEl = document.getElementById('status-val');
            let statusText;
            if (!gameActive) statusText = '未开始（请点击开始游戏）';
            else if (flying) statusText = sprintHeld ? '☁️ 筋斗云加速模式 (Shift加速 Q↓ Space↑ F关闭)' : '✈️ 飞行模式 (Space↑ Q↓ Shift加速 F关闭)';
            else if (fallbackMode) statusText = '拖拽模式（按住鼠标拖动转视角）';
            else if (nearGuardian || nearZeyu) statusText = '📖 自动朗读中... | 按 C 磕头恢复';
            else if (controls.isLocked) statusText = '鼠标锁定模式';
            else statusText = '游戏运行中';
            if (statusEl.textContent !== statusText) statusEl.textContent = statusText;
            frameCount++;
            if (time - lastFpsTime >= 1000) {
                document.getElementById('fps-val').innerText = frameCount;
                frameCount = 0;
                lastFpsTime = time;
            }
            
            // 更新小地图（每10帧更新一次）
            if (frameCount % 10 === 0) {
                updateMiniMap();
            }

            prevTime = time;
            renderer.render(scene, camera);
        }
        
        // 更新小地图
        function updateMiniMap() {
            const canvas = document.getElementById('mini-map-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            
            // 获取玩家位置
            const pos = getPlayerPos();
            const range = 100; // 显示范围100格
            
            // 清空画布
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, w, h);
            
            // 绘制网格
            ctx.strokeStyle = 'rgba(100,100,150,0.3)';
            ctx.lineWidth = 1;
            const gridSize = range / 10;
            for (let i = -5; i <= 5; i++) {
                const x = w / 2 + (i * gridSize);
                const y = h / 2 + (i * gridSize);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            
            // 绘制玩家位置（中心）
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            // 玩家方向指示
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(w / 2, h / 2);
            ctx.lineTo(w / 2, h / 2 - 12);
            ctx.stroke();
            
            // 绘制怪物位置 + 统计数量
            const mobColors = {
                'CREEPER': '#55aa44',
                'ZOMBIE': '#4a6b4a',
                'PIG': '#ffb6c1',
                'SKELETON': '#eeeeee',
                'SPIDER': '#222222',
                'ENDERMAN': '#6600cc',
                'WOLF': '#888888',
                'COW': '#664422',
                'SHEEP': '#eeeeee',
                'CHICKEN': '#eeeeee',
                'BAT': '#444444',
                'GRANDMA': '#ffcc66',
                'GRANDPA': '#88aaff',
                'RABBIT': '#dddddd',
            };
            const mobIcons = {
                'CREEPER': '👹', 'ZOMBIE': '🧟', 'PIG': '🐷', 'SKELETON': '💀',
                'SPIDER': '🕷️', 'ENDERMAN': '🌌', 'WOLF': '🐺', 'COW': '🐮',
                'SHEEP': '🐑', 'CHICKEN': '🐔', 'BAT': '🦇', 'GRANDMA': '👵',
                'GRANDPA': '👴', 'RABBIT': '🐰',
            };
            const mobCount = {};
            
            for (const mob of mobs) {
                if (!mob.mesh || !mob.mesh.visible) continue;
                const dx = (mob.mesh.position.x - pos.x) / range * (w / 2);
                const dz = (mob.mesh.position.z - pos.z) / range * (h / 2);
                const mx = w / 2 + dx;
                const my = h / 2 + dz;
                
                if (mx < 0 || mx > w || my < 0 || my > h) continue;
                
                // 统计数量
                const mobName = mob.type.name;
                mobCount[mobName] = (mobCount[mobName] || 0) + 1;
                
                const color = mobColors[mobName] || '#888888';
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(mx, my, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 更新小地图信息面板 - 玩家位置
            const posEl = document.getElementById('mini-map-pos');
            if (posEl) {
                posEl.innerHTML = `<div style="color:#0f0;font-size:8px;">📍 (${Math.round(pos.x)}, ${Math.round(pos.z)})</div>`;
            }
            
            // 更新小地图信息面板 - 怪物数量
            const mobsEl = document.getElementById('mini-map-mobs');
            if (mobsEl) {
                let mobHtml = '<div style="color:#aaa;font-size:7px;margin-bottom:1px;">怪物:</div>';
                const sortedMobs = Object.entries(mobCount).sort((a, b) => b[1] - a[1]);
                
                // 构建怪物名称到纹理名称的映射
                const nameToTextureName = {};
                Object.values(MOB_TYPES).forEach(mobType => {
                    const textureName = mobType.textureKey ? (TEXTURE_NAMES[mobType.textureKey] || '') : '';
                    nameToTextureName[mobType.name] = textureName;
                });
                
                for (const [name, count] of sortedMobs.slice(0, 6)) {
                    const icon = mobIcons[name] || '●';
                    const texName = nameToTextureName[name] || '';
                    const displayName = texName ? `${name}(${texName})` : name;
                    mobHtml += `<div style="color:${mobColors[name] || '#888'}">${icon}${displayName}×${count}</div>`;
                }
                if (sortedMobs.length === 0) mobHtml += '<div style="color:#555">无</div>';
                mobsEl.innerHTML = mobHtml;
            }
            
            // 绘制附近矿石（铁矿、煤矿）
            let ironCount = 0, coalCount = 0;
            const oreRange = 15; // 矿石检测范围
            const px = Math.floor(pos.x), pz = Math.floor(pos.z);
            for (let ox = -oreRange; ox <= oreRange; ox++) {
                for (let oz = -oreRange; oz <= oreRange; oz++) {
                    for (let oy = -5; oy <= 10; oy++) {
                        const key = `${px + ox},${oy},${pz + oz}`;
                        if (blocksMap.has(key)) {
                            const block = blocksMap.get(key);
                            if (block.typeId === BLOCK_TYPES.IRONORE.id) {
                                ironCount++;
                                const dx = (ox) / range * (w / 2);
                                const dz = (oz) / range * (h / 2);
                                const mx = w / 2 + dx;
                                const my = h / 2 + dz;
                                ctx.fillStyle = '#d4a373';
                                ctx.fillRect(mx - 2, my - 2, 4, 4);
                            } else if (block.typeId === BLOCK_TYPES.COAL.id) {
                                coalCount++;
                                const dx = (ox) / range * (w / 2);
                                const dz = (oz) / range * (h / 2);
                                const mx = w / 2 + dx;
                                const my = h / 2 + dz;
                                ctx.fillStyle = '#333333';
                                ctx.fillRect(mx - 2, my - 2, 4, 4);
                            }
                        }
                    }
                }
            }
            
            // 更新小地图信息面板 - 矿石数量
            const oresEl = document.getElementById('mini-map-ores');
            if (oresEl) {
                let oreHtml = '<div style="color:#aaa;font-size:7px;margin-bottom:1px;">矿石:</div>';
                if (ironCount > 0) oreHtml += `<div style="color:#d4a373">⛏️铁×${ironCount}</div>`;
                if (coalCount > 0) oreHtml += `<div style="color:#666">⛏️煤×${coalCount}</div>`;
                if (ironCount === 0 && coalCount === 0) oreHtml += '<div style="color:#555">无</div>';
                oresEl.innerHTML = oreHtml;
            }
            
            // 绘制城市位置
            if (typeof CITY_TELEPORTS !== 'undefined') {
                for (const city of CITY_TELEPORTS) {
                    const dx = (city.x - pos.x) / range * (w / 2);
                    const dz = (city.z - pos.z) / range * (h / 2);
                    const mx = w / 2 + dx;
                    const my = h / 2 + dz;
                    
                    if (mx < 0 || mx > w || my < 0 || my > h) continue;
                    
                    const unlocked = cityTeleportUnlocked.has(city.name);
                    ctx.fillStyle = unlocked ? city.color.toString(16).padStart(6, '0') : '#555555';
                    ctx.fillRect(mx - 4, my - 4, 8, 8);
                }
            }
            
            // 绘制副本入口
            if (dungeonEntrances && dungeonEntrances.length > 0) {
                for (const entrance of dungeonEntrances) {
                    const dx = (entrance.x - pos.x) / range * (w / 2);
                    const dz = (entrance.z - pos.z) / range * (h / 2);
                    const mx = w / 2 + dx;
                    const my = h / 2 + dz;
                    
                    if (mx < 0 || mx > w || my < 0 || my > h) continue;
                    
                    ctx.fillStyle = entrance.color ? '#' + entrance.color.toString(16).padStart(6, '0') : '#ff4488';
                    ctx.beginPath();
                    ctx.moveTo(mx, my - 5);
                    ctx.lineTo(mx + 5, my + 3);
                    ctx.lineTo(mx - 5, my + 3);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        // === 天气系统 ===
        function changeWeather() {
            const r = Math.random();
            let newWeather;
            if (r < 0.40) newWeather = 'sunny';
            else if (r < 0.60) newWeather = 'cloudy';
            else if (r < 0.80) newWeather = 'rain';
            else if (r < 0.85) newWeather = 'snow';
            else if (r < 0.95) newWeather = 'wind';
            else newWeather = 'typhoon';
            if (newWeather !== currentWeather) {
                if (weatherParticles) { scene.remove(weatherParticles); weatherParticles = null; }
                currentWeather = newWeather;
                const names = { sunny: '☀️ 晴朗', cloudy: '☁️ 阴天', rain: '🌧️ 下雨', snow: '❄️ 下雪', wind: '💨 刮风', typhoon: '🌀 台风' };
                showStatus('天气变化：' + names[newWeather]);
                if (['rain', 'snow', 'wind', 'typhoon'].includes(newWeather)) { createWeatherParticles(newWeather); }
            }
        }

        function createWeatherParticles(type) {
            const count = type === 'typhoon' ? 800 : (type === 'rain' ? 500 : 300);
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(count * 3);
            const vel = [];
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                pos[i3] = (Math.random() - 0.5) * 200;
                pos[i3+1] = Math.random() * 80 + 20;
                pos[i3+2] = (Math.random() - 0.5) * 200;
                let vx, vy, vz;
                if (type === 'rain' || type === 'typhoon') {
                    vx = type === 'typhoon' ? -5 : 0;
                    vy = -40 - Math.random() * 20;
                    vz = type === 'typhoon' ? -3 : 0;
                } else if (type === 'snow') {
                    vx = 1 + Math.random() * 2; vy = -3 - Math.random() * 2; vz = 0.5 + Math.random();
                } else {
                    vx = 8 + Math.random() * 4; vy = -2 - Math.random() * 3; vz = 0;
                }
                vel.push({vx, vy, vz});
            }
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            let color, size, opacity;
            if (type === 'rain') { color = 0xaaaaaa; size = 0.15; opacity = 0.6; }
            else if (type === 'snow') { color = 0xffffff; size = 0.3; opacity = 0.8; }
            else if (type === 'wind') { color = 0xdddddd; size = 0.2; opacity = 0.4; }
            else { color = 0x888888; size = 0.2; opacity = 0.5; }
            const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity });
            weatherParticles = new THREE.Points(geo, mat);
            weatherParticles.userData.velocities = vel;
            weatherParticles.userData.type = type;
            scene.add(weatherParticles);
        }

        function updateWeatherParticles(delta) {
            if (!weatherParticles) return;
            const attr = weatherParticles.geometry.attributes.position;
            const vel = weatherParticles.userData.velocities;
            const type = weatherParticles.userData.type;
            const pp = getPlayerPos();
            for (let i = 0; i < vel.length; i++) {
                const i3 = i * 3;
                let px = attr.array[i3], py = attr.array[i3+1], pz = attr.array[i3+2];
                const v = vel[i];
                if (type === 'typhoon') {
                    const a = 0.05 * delta;
                    const cx = px - pp.x, cz = pz - pp.z;
                    px = cx * Math.cos(a) - cz * Math.sin(a) + pp.x;
                    pz = cx * Math.sin(a) + cz * Math.cos(a) + pp.z;
                }
                px += v.vx * delta; py += v.vy * delta; pz += v.vz * delta;
                if (py < 0) {
                    px = pp.x + (Math.random() - 0.5) * 100;
                    py = 60 + Math.random() * 30;
                    pz = pp.z + (Math.random() - 0.5) * 100;
                }
                attr.array[i3] = px; attr.array[i3+1] = py; attr.array[i3+2] = pz;
            }
            attr.needsUpdate = true;
        }

        // === 游戏副本系统 (深圳市小学二年级上学期教材) ===
        // 副本空间参数（独立于主世界，放置在远端避免重叠）
        const DUNGEON_ORIGIN_X = 1000;
        const DUNGEON_ORIGIN_Z = 1000;
        const DUNGEON_HALF = 15; // 30x30 副本地板的一半

        // 副本怪物类型
        const DUNGEON_MOBS = {
            bookMonster: { name: '书本怪', bodyColor: 0x4466aa, headColor: 0x4466aa, speed: 1.2, hostile: true, scale: 1.0, legs: 2, hp: 10 },
            numberMonster: { name: '数字怪', bodyColor: 0xaa4444, headColor: 0xaa4444, speed: 1.5, hostile: true, scale: 1.0, legs: 2, hp: 12 },
            pinyinMonster: { name: '拼音怪', bodyColor: 0x44aa44, headColor: 0x44aa44, speed: 1.0, hostile: true, scale: 1.0, legs: 2, hp: 8 },
            calcMonster: { name: '计算怪', bodyColor: 0xaa8844, headColor: 0xaa8844, speed: 1.3, hostile: true, scale: 1.0, legs: 2, hp: 15 },
            bossMonster: { name: 'BOSS', bodyColor: 0xff00ff, headColor: 0xff00ff, speed: 1.0, hostile: true, scale: 2.0, legs: 2, hp: 50, boss: true },
        };

        // 副本数据（按照教材内容）
        const DUNGEONS = {
            chinese: {
                name: '📚 语文副本',
                title: '语文闯关 - 二年级上册',
                floors: 3,
                reward: { item: 'enchantedBook', name: '📖 魔法书', desc: '智慧之书，学习力+50%' },
                floors_data: [
                    {
                        name: '第1层：小蝌蚪找妈妈',
                        mobCount: 3,
                        mobTypes: ['pinyinMonster'],
                        questions: [
                            { q: '小蝌蚪先长出什么？', opts: ['两条后腿', '两条前腿', '尾巴变短', '尾巴消失'], answer: 0 },
                            { q: '小蝌蚪的妈妈是？', opts: ['鲤鱼', '乌龟', '青蛙', '鱼'], answer: 2 },
                            { q: '青蛙妈妈披着什么颜色的衣裳？', opts: ['碧绿', '雪白', '黑灰', '红色'], answer: 0 },
                            { q: '"教"的读音是？', opts: ['jiāo/jiào', 'jiáo/jiào', 'jiāo/jiáo', 'jiào/jiǎo'], answer: 0 },
                            { q: '小蝌蚪最后变成了？', opts: ['鱼', '乌龟', '青蛙', '蛇'], answer: 2 },
                            { q: '小蝌蚪长什么样子？', opts: ['大眼睛，黑身子，长尾巴', '小眼睛，白身子', '大眼睛，红身子', '没有眼睛'], answer: 0 },
                            { q: '小蝌蚪游啊游，过了几天长出什么？', opts: ['两条后腿', '两条前腿', '尾巴', '嘴巴'], answer: 0 },
                        ]
                    },
                    {
                        name: '第2层：植物妈妈有办法',
                        mobCount: 4,
                        mobTypes: ['bookMonster'],
                        questions: [
                            { q: '蒲公英妈妈用什么办法传播种子？', opts: ['风', '动物皮毛', '太阳', '水'], answer: 0 },
                            { q: '苍耳妈妈给孩子穿上什么？', opts: ['带刺的铠甲', '降落伞', '翅膀', '鞋子'], answer: 0 },
                            { q: '豌豆妈妈用什么办法传播种子？', opts: ['风', '太阳暴晒', '动物皮毛', '水'], answer: 1 },
                            { q: '"植物妈妈有办法"告诉我们什么？', opts: ['要仔细观察', '要保护植物', '要种树', '要浇水'], answer: 0 },
                            { q: '课文中提到的植物有？', opts: ['蒲公英、苍耳、豌豆', '松树、柏树、银杏', '杨树、榕树、梧桐', '以上都是'], answer: 0 },
                            { q: '蒲公英的种子上有什么？', opts: ['降落伞', '翅膀', '刺', '毛'], answer: 0 },
                            { q: '苍耳挂在动物身上是为了？', opts: ['传播种子', '保暖', '装饰', '玩耍'], answer: 0 },
                        ]
                    },
                    {
                        name: '第3层：识字迷宫 (BOSS)',
                        mobCount: 1,
                        mobTypes: ['bossMonster'],
                        bossName: '语文BOSS - 汉字魔王',
                        questions: [
                            { q: '"场景歌"中"一方鱼塘"的"一"是？', opts: ['数量词', '名词', '动词', '形容词'], answer: 0 },
                            { q: '《树之歌》中"银杏水杉活化石"是什么意思？', opts: ['它们很古老', '它们是化石', '它们很珍贵', '它们会说话'], answer: 0 },
                            { q: '"松柏四季披绿装"说明松柏什么特点？', opts: ['四季常青', '春天发芽', '秋天落叶', '夏天开花'], answer: 0 },
                            { q: '《拍手歌》中"你拍五"提到什么动物？', opts: ['雄鹰', '猛虎', '熊猫', '百灵'], answer: 1 },
                            { q: '《田家四季歌》中"春季里，春风吹"下一句是？', opts: ['麦苗儿多嫩', '稻上场', '雪初晴', '农事忙'], answer: 0 },
                            { q: '《场景歌》中"一（ ）军舰"填什么量词？', opts: ['艘', '只', '条', '座'], answer: 0 },
                            { q: '《树之歌》中"杨树高，（ ）壮"', opts: ['榕树', '枫树', '松树', '柏树'], answer: 0 },
                            { q: '《拍手歌》"你拍一，我拍一"下一句是？', opts: ['动物世界很新奇', '孔雀锦鸡是伙伴', '天空雁群会写字', '保护动物是大事'], answer: 0 },
                            { q: '《田家四季歌》中"夏季里，农事（ ）"', opts: ['忙', '闲', '冷', '热'], answer: 0 },
                        ]
                    }
                ]
            },
            math: {
                name: '🔢 数学副本',
                title: '数学闯关 - 二年级上册',
                floors: 3,
                reward: { item: 'mathCrystal', name: '💎 数学水晶', desc: '智慧结晶，计算力+50%' },
                floors_data: [
                    {
                        name: '第1层：加减法洞窟',
                        mobCount: 3,
                        mobTypes: ['calcMonster'],
                        questions: [
                            { q: '3 + 5 = ?', opts: ['7', '8', '9', '6'], answer: 1 },
                            { q: '10 - 4 = ?', opts: ['4', '5', '6', '3'], answer: 2 },
                            { q: '15 - 7 = ?', opts: ['6', '7', '8', '9'], answer: 2 },
                            { q: '24 + 30 + 41 = ?', opts: ['95', '94', '93', '96'], answer: 0 },
                            { q: '90 - 45 - 25 = ?', opts: ['20', '18', '22', '25'], answer: 0 },
                            { q: '45 + 27 = ?', opts: ['72', '71', '73', '74'], answer: 0 },
                            { q: '72 - 34 = ?', opts: ['38', '37', '39', '40'], answer: 0 },
                        ]
                    },
                    {
                        name: '第2层：乘法迷宫',
                        mobCount: 4,
                        mobTypes: ['numberMonster'],
                        questions: [
                            { q: '2 × 3 = ?', opts: ['5', '6', '7', '8'], answer: 1 },
                            { q: '4 × 4 = ?', opts: ['16', '12', '14', '18'], answer: 0 },
                            { q: '5 × 2 = ?', opts: ['10', '7', '5', '3'], answer: 0 },
                            { q: '3 + 3 + 3 + 3 = ?', opts: ['12', '10', '14', '15'], answer: 0 },
                            { q: '4 × 3 = ?', opts: ['12', '11', '13', '14'], answer: 0 },
                            { q: '二五一十，2 × 5 = ?', opts: ['10', '9', '11', '12'], answer: 0 },
                            { q: '三三得九，3 × 3 = ?', opts: ['9', '8', '10', '11'], answer: 0 },
                        ]
                    },
                    {
                        name: '第3层：综合计算 (BOSS)',
                        mobCount: 1,
                        mobTypes: ['bossMonster'],
                        bossName: '数学BOSS - 计算魔王',
                        questions: [
                            { q: '20 + 5 = ?', opts: ['24', '25', '26', '23'], answer: 1 },
                            { q: '30 - 12 = ?', opts: ['17', '18', '16', '19'], answer: 1 },
                            { q: '25 + 15 = ?', opts: ['35', '40', '45', '50'], answer: 1 },
                            { q: '12 ÷ 2 = ?', opts: ['6', '5', '7', '8'], answer: 0 },
                            { q: '12 ÷ 3 = ?', opts: ['3', '4', '5', '6'], answer: 1 },
                            { q: '1米 = ? 厘米', opts: ['10', '50', '100', '1000'], answer: 2 },
                            { q: '1角 = ? 分', opts: ['1', '5', '10', '100'], answer: 2 },
                            { q: '1元 = ? 分', opts: ['10', '50', '100', '1000'], answer: 2 },
                            { q: '1元 = ? 角', opts: ['1', '5', '10', '100'], answer: 2 },
                        ]
                    }
                ]
            },
            english: {
                name: '🔤 英语副本',
                title: '英语闯关 - 二年级上册',
                floors: 3,
                reward: { item: 'englishGem', name: '🌟 英语宝石', desc: '语言之星，听力+50%' },
                floors_data: [
                    {
                        name: '第1层：五官五感',
                        mobCount: 3,
                        mobTypes: ['pinyinMonster'],
                        questions: [
                            { q: '"eye" 的中文意思是？', opts: ['眼睛', '耳朵', '鼻子', '嘴巴'], answer: 0 },
                            { q: '"ear" 的中文意思是？', opts: ['眼睛', '耳朵', '鼻子', '手'], answer: 1 },
                            { q: '"nose" 的中文意思是？', opts: ['嘴巴', '手', '鼻子', '耳朵'], answer: 2 },
                            { q: '"hand" 的中文意思是？', opts: ['脚', '手', '手指', '头'], answer: 1 },
                            { q: '"I can see" 的中文意思是？', opts: ['我能听见', '我能看见', '我能闻到', '我能摸到'], answer: 1 },
                            { q: '"I can smell" 的中文意思是？', opts: ['我能闻到', '我能尝到', '我能看见', '我能摸到'], answer: 0 },
                            { q: '"hard" 的反义词是？', opts: ['soft', 'big', 'small', 'good'], answer: 0 },
                        ]
                    },
                    {
                        name: '第2层：玩具与周围',
                        mobCount: 4,
                        mobTypes: ['bookMonster'],
                        questions: [
                            { q: '"toy" 的中文意思是？', opts: ['玩具', '球', '书', '车'], answer: 0 },
                            { q: '"robot" 的中文意思是？', opts: ['洋娃娃', '机器人', '小汽车', '球'], answer: 1 },
                            { q: '"favourite" 的中文意思是？', opts: ['最喜欢的', '最大的', '最好的', '最漂亮的'], answer: 0 },
                            { q: '"home" 的中文意思是？', opts: ['学校', '公园', '家', '商店'], answer: 2 },
                            { q: '"park" 的中文意思是？', opts: ['商店', '学校', '公园', '家'], answer: 2 },
                            { q: '"school" 的中文意思是？', opts: ['学校', '公园', '商店', '家'], answer: 0 },
                            { q: '"There is a park" 意思是？', opts: ['有一个公园', '有一个商店', '有一所学校', '有一棵树'], answer: 0 },
                        ]
                    },
                    {
                        name: '第3层：农场与中秋BOSS',
                        mobCount: 1,
                        mobTypes: ['bossMonster'],
                        bossName: '英语BOSS - 词汇魔王',
                        questions: [
                            { q: '"cow" 的中文意思是？', opts: ['奶牛', '猪', '鸭子', '绵羊'], answer: 0 },
                            { q: '"duck" 的中文意思是？', opts: ['小鸡', '鸭子', '猪', '奶牛'], answer: 1 },
                            { q: '"sheep" 的中文意思是？', opts: ['绵羊', '猪', '鸭子', '奶牛'], answer: 0 },
                            { q: '"farm" 的中文意思是？', opts: ['家', '学校', '农场', '公园'], answer: 2 },
                            { q: '"I like the cows" 意思是？', opts: ['我喜欢奶牛', '我喜欢猪', '我喜欢鸭子', '我喜欢羊'], answer: 0 },
                            { q: '"Mid-Autumn Festival" 是？', opts: ['春节', '中秋节', '国庆节', '端午节'], answer: 1 },
                            { q: '"moon cake" 的中文意思是？', opts: ['月亮', '月饼', '灯笼', '星星'], answer: 1 },
                            { q: '"They eat moon cakes" 意思是？', opts: ['他们吃月饼', '他们看月亮', '他们玩灯笼', '他们唱歌'], answer: 0 },
                            { q: '"They look at the moon" 意思是？', opts: ['他们看月亮', '他们吃月饼', '他们玩灯笼', '他们庆祝'], answer: 0 },
                        ]
                    }
                ]
            }
        };

        // 特殊奖励物品
        const SPECIAL_REWARDS = {
            enchantedBook: { name: '魔法书', icon: '📖', color: 0xff88ff, effect: '智慧提升' },
            mathCrystal: { name: '数学水晶', icon: '💎', color: 0x88ffff, effect: '计算提升' },
            englishGem: { name: '英语宝石', icon: '🌟', color: 0xffff00, effect: '听力提升' },
            goldenSword: { name: '黄金剑', icon: '⚔️', color: 0xffdd00, effect: '伤害+5' },
            diamondArmor: { name: '钻石护甲', icon: '🛡️', color: 0x88ffff, effect: '防御+5' },
        };

        // 副本状态
        let dungeonState = {
            active: false,
            completed: false, // 是否已完成副本
            currentDungeon: null,
            currentFloor: 0,
            questions: [],
            answered: false,
            questionsAnswered: 0,
            dungeonMobs: [],
            dungeonFloor: null,
            chestLabel: null,
            rewards: [],
            playerPos: null,
            bossActive: false,
            entrancePos: null,
        };

        // 副本入口位置
        let dungeonEntrances = [];
        // 副本传送门对象
        let dungeonPortals = [];
        // 副本退出传送门
        let dungeonExitPortal = null;
        let dungeonExitPortalGroup = null;
        
        // 城市传送点
        const CITY_TELEPORTS = [
            // 八大主城（四角 + 四方，形成大十字网格，任意两点 ≥50 格）
            { name: '北京', pinyin: 'Běijīng', x: -150, z: -150, icon: '🏛️', color: 0xff4444 },
            { name: '上海', pinyin: 'Shànghǎi', x:  150, z: -150, icon: '🌃', color: 0x4488ff },
            { name: '广州', pinyin: 'Guǎngzhōu', x: -150, z:  150, icon: '🌴', color: 0x44ff44 },
            { name: '深圳', pinyin: 'Shēnzhèn', x:  150, z:  150, icon: '🏙️', color: 0xffaa00 },
            { name: '成都', pinyin: 'Chéngdū', x: -250, z:    0, icon: '🐼', color: 0xff88ff },
            { name: '杭州', pinyin: 'Hángzhōu', x:  250, z:    0, icon: '🏞️', color: 0x88ffff },
            { name: '西安', pinyin: 'Xī\'ān', x:    0, z: -250, icon: '🏯', color: 0xffdd00 },
            { name: '武汉', pinyin: 'Wǔhàn', x:    0, z:  250, icon: '🌉', color: 0xff8800 },
            // 广东省城市（东南象限分散，任意两点 ≥78 格，避免地图标记重合）
            { name: '东莞', pinyin: 'Dǒngguǎn', x:  270, z:  110, icon: '🏭', color: 0xffcc00 },
            { name: '佛山', pinyin: 'Fóshān', x:  -60, z:  170, icon: '🏯', color: 0xff6644 },
            { name: '珠海', pinyin: 'Zhūhǎi', x:  210, z:  370, icon: '⛵', color: 0x00aaff },
            { name: '汕头', pinyin: 'Shàntóu', x:  390, z:  200, icon: '🌊', color: 0x44ddff },
            { name: '惠州', pinyin: 'Huìzhōu', x:  100, z:  380, icon: '⛰️', color: 0x88cc44 },
            { name: '中山', pinyin: 'Zhōngshān', x:  10, z:  450, icon: '🌅', color: 0xffaa66 },
            { name: '湛江', pinyin: 'Zhànjiāng', x: -130, z:  390, icon: '🏖️', color: 0x00ffcc },
            { name: '江门', pinyin: 'Jiāngmén', x:  300, z:  430, icon: '🌉', color: 0x66aaff },
            { name: '韶关', pinyin: 'Shǎoguān', x: -220, z:  250, icon: '⛰️', color: 0x99cc66 },
            { name: '梅州', pinyin: 'Méizhōu', x:  360, z:   60, icon: '🍊', color: 0xff8800 },
            // 甘肃省城市（西北象限分散，任意两点 ≥78 格）
            { name: '兰州', pinyin: 'Lánzhōu', x: -200, z:  -60, icon: '🌉', color: 0x4488cc },
            { name: '天水', pinyin: 'Tiānshuǐ', x: -100, z: -280, icon: '⛰️', color: 0x66aa88 },
            { name: '酒泉', pinyin: 'Jiǔquán', x: -380, z: -100, icon: '🚀', color: 0xff4444 },
            { name: '张掖', pinyin: 'Zhāngyē', x: -260, z: -260, icon: '🏜️', color: 0xddaa44 },
            { name: '敦煌', pinyin: 'Dūnhuáng', x: -460, z:  -40, icon: '🏛️', color: 0xffaa00 },
            { name: '嘉峪关', pinyin: 'Jiāyùguǎn', x: -420, z: -200, icon: '🏯', color: 0xcc8844 },
            { name: '定西', pinyin: 'Dìngxī', x: -120, z: -380, icon: '🏔️', color: 0x88ccaa },
            { name: '陇南', pinyin: 'Lǒngnán', x: -300, z:  100, icon: '🌳', color: 0x44aa66 },
            { name: '平凉', pinyin: 'Píngliáng', x:  -20, z: -380, icon: '🐪', color: 0xccaa88 },
            { name: '庆阳', pinyin: 'Qìngyáng', x:   60, z: -440, icon: '🏞️', color: 0xaa88cc },
            { name: '武威', pinyin: 'Wǔwēi', x: -220, z: -380, icon: '🌵', color: 0x88cc44 },
        ];
        let cityTeleportMarkers = [];
        let cityTeleportUnlocked = new Set(['深圳']); // 出生城市默认解锁

        // 搜索陆地位置的辅助函数（全局）
        function findLandNear(targetX, targetZ) {
            // 先检查目标位置是否在陆地上（水面以上2格才算陆地）
            const h = getTerrainHeight(targetX, targetZ);
            if (h > WATER_LEVEL + 1) return { x: targetX, z: targetZ };
            // 大范围搜索（半径50，步长2），确保找到陆地
            for (let radius = 2; radius <= 50; radius += 2) {
                for (let dx = -radius; dx <= radius; dx += 2) {
                    for (let dz = -radius; dz <= radius; dz += 2) {
                        const x = targetX + dx, z = targetZ + dz;
                        if (getTerrainHeight(x, z) > WATER_LEVEL + 1) {
                            return { x, z };
                        }
                    }
                }
            }
            // 找不到陆地，直接返回目标位置（不生成方块，避免阻塞主线程）
            return { x: targetX, z: targetZ };
        }
        
        // 准备传送门场地：平整地面 + 清除上方方块
        function preparePortalSite(x, z, radius) {
            const targetY = Math.max(getGroundY(x, z), WATER_LEVEL + 2);
            const floorY = Math.floor(targetY);
            
            // 平整地面到目标高度
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const bx = x + dx, bz = z + dz;
                    const currentH = getTerrainHeight(bx, bz);
                    if (currentH < floorY) {
                        for (let y = Math.floor(currentH) + 1; y <= floorY; y++) {
                            const type = y === floorY ? BLOCK_TYPES.GRASS : (y < floorY - 1 ? BLOCK_TYPES.STONE : BLOCK_TYPES.DIRT);
                            addBlock(bx, y, bz, type);
                        }
                    }
                }
            }
            
            // 清除传送门上方方块（传送门高约7格，球体到8格）
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    for (let ty = floorY + 1; ty < floorY + 10; ty++) {
                        const key = `${x + dx},${ty},${z + dz}`;
                        if (blocksMap.has(key)) {
                            forceRemoveBlock(key);
                        }
                    }
                }
            }
        }
        
        // 初始化副本入口（创建传送门）
        function initDungeonEntrances() {
            const entrances = [
                { type: 'chinese', name: '语文副本', color: 0xff4488 },
                { type: 'math', name: '数学副本', color: 0x4488ff },
                { type: 'english', name: '英语副本', color: 0x44ff88 },
            ];
            
            // 传送门位置：远离出生点(0,0)、远离所有城市传送点(±250格内)，分散在地图远端陆地
            const targets = [
                { x: 380, z: 80 },    // 语文：东侧远陆（远离东莞/珠海）
                { x: -380, z: -80 },  // 数学：西侧远陆（远离酒泉/嘉峪关）
                { x: 100, z: 380 },   // 英语：北侧远陆（远离惠州/中山）
            ];
            
            dungeonEntrances = [];
            dungeonPortals = [];
            
            entrances.forEach((entrance, i) => {
                const land = findLandNear(targets[i].x, targets[i].z);
                // 准备传送门场地：平整地面 + 清除上方方块
                preparePortalSite(land.x, land.z, 5);
                const entranceData = { ...entrance, x: land.x, z: land.z };
                dungeonEntrances.push(entranceData);
                
                // 创建传送门
                const groundY = getGroundY(land.x, land.z);
                const portalGroup = createPortal(entrance.color, land.x, groundY, land.z, entrance.name);
                scene.add(portalGroup);
                dungeonPortals.push({ group: portalGroup, entrance: entranceData });
            });
            
            // 初始化城市传送点
            initCityTeleports();
        }
        
        // 创建传送门
        function createPortal(color, x, groundY, z, name) {
            const group = new THREE.Group();
            
            // 传送门框架（两个柱子）
            const pillarGeo = new THREE.BoxGeometry(0.5, 5, 0.5);
            const pillarMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
            pillarL.position.set(-1.5, groundY + 2.5, 0);
            group.add(pillarL);
            const pillarR = pillarL.clone();
            pillarR.position.x = 1.5;
            group.add(pillarR);
            
            // 顶部横梁
            const beamGeo = new THREE.BoxGeometry(3.5, 0.5, 0.5);
            const beam = new THREE.Mesh(beamGeo, pillarMat);
            beam.position.set(0, groundY + 5, 0);
            group.add(beam);
            
            // 传送门光效（半透明平面）
            const portalGeo = new THREE.PlaneGeometry(2.5, 4.5);
            const portalMat = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const portal = new THREE.Mesh(portalGeo, portalMat);
            portal.position.set(0, groundY + 2.5, 0);
            portal.userData = { isPortal: true, portalColor: color, portalName: name };
            group.add(portal);
            
            // 名字标签
            const label = makeNameTag(name, '#' + color.toString(16).padStart(6, '0'), 'chuán sòng mén');
            label.position.set(0, groundY + 6, 0);
            label.scale.set(2.5, 0.7, 1);
            group.add(label);
            
            group.position.set(x, 0, z);
            return group;
        }
        
        // 初始化城市传送点
        function initCityTeleports() {
            cityTeleportMarkers = [];
            CITY_TELEPORTS.forEach(city => {
                const land = findLandNear(city.x, city.z);
                if (!land) return;
                // 准备传送门场地：平整地面 + 清除上方方块
                preparePortalSite(land.x, land.z, 5);
                const groundY = getGroundY(land.x, land.z);
                const marker = createCityTeleport(city, land.x, groundY, land.z);
                scene.add(marker);
                cityTeleportMarkers.push({ marker, city: { ...city, x: land.x, z: land.z, groundY } });
                // 在城市附近放置教育标识牌
                placeEducationalSigns(land.x, land.z, groundY);
            });
        }
        
        // === 世界教育标识牌系统 ===
        const EDUCATIONAL_SIGNS = [
            // ===== 语文类（来自二年级上册语文教材）=====
            { subject: '语文', text: '📖 小蝌蚪找妈妈\n池塘里有一群小蝌蚪，大大的脑袋\n黑灰色的身子，甩着长长的尾巴\n先长两条后腿，再长前腿\n最后变成小青蛙，跟妈妈捉害虫', color: 0x44ff44 },
            { subject: '语文', text: '📖 曹冲称象\n曹操得到一头大象，很想知道它有多重\n曹冲才七岁，说把大象赶到大船上\n看船下沉多少，沿水面画一条线\n再装石头到同一水位，称石头即知象重', color: 0x44ff44 },
            { subject: '语文', text: '📖 坐井观天\n青蛙坐在井底，小鸟飞来\n青蛙说天不过井口那么大\n小鸟说天无边无际，大得很哪！\n看问题要全面，不要只看一面', color: 0x44ff44 },
            { subject: '语文', text: '📖 古诗 · 登鹳雀楼\n白日依山尽，黄河入海流\n欲穷千里目，更上一层楼\n作者：王之涣（唐代）\n寓意：站得高看得远，要不断进取', color: 0x44ff44 },
            { subject: '语文', text: '📖 古诗 · 敕勒歌\n敕勒川，阴山下。天似穹庐\n天苍苍，野茫茫\n风吹草低见牛羊\n北朝民歌，描写草原辽阔', color: 0x44ff44 },
            { subject: '语文', text: '📖 植物妈妈有办法\n蒲公英妈妈准备了降落伞，乘着风出发\n苍耳妈妈给孩子穿上带刺的铠甲\n挂住动物皮毛去田野、山洼\n豆荚妈妈让豆荚晒太阳，炸开后蹦跳', color: 0x44ff44 },
            { subject: '语文', text: '📖 我是什么\n太阳一晒，我变成汽，升到天空变成云\n变成雨、冰雹、雪\n平常在池子里睡觉，在小溪里散步\n在江河里奔跑，在海洋里跳舞唱歌', color: 0x44ff44 },
            { subject: '语文', text: '📖 树之歌 · 田家四季歌\n杨树高，榕树壮，梧桐叶像手掌\n枫树秋叶红，松柏四季绿\n春季麦苗嫩，夏季农事忙\n秋季稻上场，冬季雪初晴', color: 0x44ff44 },
            { subject: '语文', text: '📖 大禹治水\n禹吸取父亲治水失败的教训\n采用疏导的办法，开通很多河道\n让洪水通过河道流到大海里\n洪水退了，百姓过上了安居乐业的生活', color: 0x44ff44 },
            { subject: '语文', text: '📖 狐假虎威\n老虎逮住一只狐狸\n狐狸说老天爷派它管百兽\n老虎半信半疑，跟着狐狸走\n其实野兽是害怕老虎才跑掉的', color: 0x44ff44 },
            // ===== 英语类（来自沪教牛津二年级上册英语）=====
            { subject: '英语', text: '🔤 Unit 1 Five Senses\neye/ear/nose/mouth/hand/finger\nsee/hear/smell/taste/touch/feel\nhard=硬的 soft=软的\nI can see an ant. I can hear birds.', color: 0x4488ff },
            { subject: '英语', text: '🔤 Unit 2 My Family\nfather=爸爸 mother=妈妈\nbrother=兄弟 sister=姐妹\ngrandpa=爷爷 grandma=奶奶\nWho is he? He is my father.', color: 0x4488ff },
            { subject: '英语', text: '🔤 Unit 3 My Favourite Toy\ntoy=玩具 doll=洋娃娃\nball=球 car=小汽车 robot=机器人\nfavourite=最喜欢的\nWhat is your favourite toy?', color: 0x4488ff },
            { subject: '英语', text: '🔤 Unit 4 Around My Home\nhome=家 park=公园\nshop=商店 school=学校\ntree=树 flower=花\nThere is a park near my home.', color: 0x4488ff },
            { subject: '英语', text: '🔤 Unit 5 The Farm\nfarm=农场 cow=奶牛\npig=猪 duck=鸭子\nchicken=小鸡 sheep=绵羊\nWhat do you like about farms?\nI like the cows.', color: 0x4488ff },
            { subject: '英语', text: '🔤 Unit 6 Mid-Autumn Festival\nmoon=月亮 moon cake=月饼\nlantern=灯笼 celebrate=庆祝\nThey eat moon cakes.\nThey look at the moon.', color: 0x4488ff },
            // ===== 数学类（来自北师大版二年级上册数学）=====
            { subject: '数学', text: '🔢 第一单元 加与减\n连加：24+30+41=95（从左往右算）\n连减：90-45-25=20\n加减混合：52-9+15=58\n相同数位对齐，进位加1退位减1', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第二单元 购物\n人民币单位：元、角、分\n1元=10角 1角=10分 1元=100分\n付出的钱-物价=找回的钱\n例：8元买5元本子，找回3元', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第三单元 乘法初步\n4个3相加：3+3+3+3=12\n写成乘法：3×4=12 或 4×3=12\n乘法是求几个相同加数和的简便运算\n乘数×乘数=积', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第五单元 2-5口诀\n2的口诀：一二得二…二九十八\n3的口诀：一三得三…三五十五\n4的口诀：一四得四…四五二十\n5的口诀：一五得五…五五二十五', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第六单元 测量\n较短物体用厘米(cm)，较长用米(m)\n1米=100厘米\n量物体时一端对准0刻度\n线段是直的，有两个端点', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第七单元 除法\n平均分：每份分得同样多\n12根香蕉平均分成2份，每份6根\n12÷2=6（被除数÷除数=商）\n用口诀求商：三四十二，12÷3=4', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第四单元 图形变化\n轴对称：对折两边完全重合\n折痕叫对称轴\n平移：沿直线移动，形状大小不变\n旋转：绕一个点转动（如风车）', color: 0xffaa00 },
            { subject: '数学', text: '🔢 第八单元 6-9口诀\n6的口诀：一六得六…六六三十六\n7的口诀：一七得七…七七四十九\n8的口诀：一八得八…八八六十四\n9的口诀：一九得九…九九八十一', color: 0xffaa00 },
        ];
        
        let educationalSigns = [];
        
        function placeEducationalSigns(cityX, cityZ, groundY) {
            // 在城市附近随机放置2-3块教育标识牌
            const signCount = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < signCount; i++) {
                const signData = EDUCATIONAL_SIGNS[Math.floor(Math.random() * EDUCATIONAL_SIGNS.length)];
                const angle = Math.random() * Math.PI * 2;
                const dist = 8 + Math.random() * 12;
                const sx = cityX + Math.cos(angle) * dist;
                const sz = cityZ + Math.sin(angle) * dist;
                const sy = getGroundY(sx, sz);
                if (sy > WATER_LEVEL + 1) {
                    const sign = createEducationalSign(signData, sx, sy, sz);
                    scene.add(sign);
                    educationalSigns.push({ sign, x: sx, z: sz, subject: signData.subject, text: signData.text });
                }
            }
        }
        
        function createEducationalSign(data, x, groundY, z) {
            const group = new THREE.Group();
            
            // 木牌（加高，承载更大的标牌）
            const postGeo = new THREE.BoxGeometry(0.2, 2.0, 0.2);
            const postMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.y = 1.0;
            group.add(post);
            
            // 牌子（增大到 2.0 x 1.2，容纳多行文字）
            const lineCount = data.text.split('\n').length;
            const signW = 2.0;
            const signH = Math.max(0.8, 0.4 + lineCount * 0.3);
            const signGeo = new THREE.BoxGeometry(signW, signH, 0.08);
            const signMat = new THREE.MeshLambertMaterial({ color: data.color, emissive: data.color, emissiveIntensity: 0.3 });
            const signMesh = new THREE.Mesh(signGeo, signMat);
            signMesh.position.y = 1.5;
            group.add(signMesh);
            
            // 文字标签（使用多行标签函数）
            const label = makeSignLabel(data.text, '#' + data.color.toString(16).padStart(6, '0'));
            label.position.set(0, 1.5, 0.1);
            group.add(label);
            
            group.position.set(x, groundY, z);
            group.rotation.y = Math.random() * Math.PI * 2;
            
            return group;
        }
        
        // 检测玩家是否靠近教育标识牌
        let lastSignReadTime = 0;
        function checkEducationalSigns() {
            if (!gameActive || !playerModel) return;
            const now = Date.now();
            if (now - lastSignReadTime < 5000) return; // 5秒冷却
            
            const pos = getPlayerPos();
            for (const signData of educationalSigns) {
                const dx = pos.x - signData.x;
                const dz = pos.z - signData.z;
                if (Math.sqrt(dx * dx + dz * dz) < 3.0) {
                    lastSignReadTime = now;
                    const char = READING_CHARACTERS.find(c => c.subject === signData.subject);
                    if (char) {
                        // 从标识牌标题提取课文名，查找完整课文朗读
                        const titleLine = signData.text.split('\n')[0];
                        const rawTitle = titleLine.replace(/^[^a-zA-Z\u4e00-\u9fa5]+/, '').trim();
                        const passages = TEXTBOOK_PASSAGES[signData.subject];
                        let fullText = signData.text.replace(/\n/g, ' ');
                        if (passages) {
                            // 查找完整课文：按标题匹配
                            let match = passages.find(p => 
                                p.title.includes(rawTitle) || 
                                rawTitle.includes(p.title.replace(/（.*?）/, '')) ||
                                p.title.replace(/（.*?）/, '').includes(rawTitle)
                            );
                            // 英语：按单元编号匹配（排除 Story）
                            if (!match && signData.subject === '英语') {
                                const m = rawTitle.match(/Unit\s*(\d+)/i);
                                if (m) match = passages.find(p => p.title.includes(`Unit ${m[1]}`) && !p.title.includes('Story'));
                            }
                            // 数学：按单元编号匹配
                            if (!match && signData.subject === '数学') {
                                const m = rawTitle.match(/第([一二三四五六七八])单元/);
                                const cnNums = ['','一','二','三','四','五','六','七','八','九'];
                                if (m) {
                                    const idx = cnNums.indexOf(m[1]);
                                    if (idx > 0 && idx <= passages.length) match = passages[idx - 1];
                                }
                            }
                            if (match) {
                                fullText = `${match.title}。${match.text}`;
                            }
                        }
                        const text = `${char.name}朗读${char.subject}课文：${fullText}`;
                        showStatus(`📖 ${char.icon} ${signData.subject}标识牌：${titleLine}`);
                        speakText(text, char.voiceRate);
                    }
                    break;
                }
            }
        }
        
        // 创建城市传送门（门型结构）
        function createCityTeleport(city, x, groundY, z) {
            const group = new THREE.Group();
            
            // 两根柱子（门框）
            const pillarGeo = new THREE.BoxGeometry(0.6, 5.5, 0.6);
            const pillarMat = new THREE.MeshLambertMaterial({ color: city.color, emissive: city.color, emissiveIntensity: 0.2 });
            const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
            pillarL.position.set(-1.5, groundY + 2.75, 0);
            group.add(pillarL);
            const pillarR = pillarL.clone();
            pillarR.position.x = 1.5;
            group.add(pillarR);
            
            // 顶部横梁
            const beamGeo = new THREE.BoxGeometry(3.6, 0.6, 0.6);
            const beam = new THREE.Mesh(beamGeo, pillarMat);
            beam.position.set(0, groundY + 5.8, 0);
            group.add(beam);
            
            // 装饰：柱顶小球
            const capGeo = new THREE.SphereGeometry(0.35, 8, 8);
            const capMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const capL = new THREE.Mesh(capGeo, capMat);
            capL.position.set(-1.5, groundY + 6.0, 0);
            group.add(capL);
            const capR = capL.clone();
            capR.position.x = 1.5;
            group.add(capR);
            
            // 传送门光效（半透明平面，城市颜色）
            const portalGeo = new THREE.PlaneGeometry(2.8, 4.8);
            const portalMat = new THREE.MeshBasicMaterial({ 
                color: city.color, 
                transparent: true, 
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const portal = new THREE.Mesh(portalGeo, portalMat);
            portal.position.set(0, groundY + 2.8, 0);
            portal.userData = { isCityPortal: true, cityColor: city.color };
            group.add(portal);
            
            // 底部光环（旋转装饰）
            const ringGeo = new THREE.RingGeometry(1.5, 1.9, 16);
            const ringMat = new THREE.MeshBasicMaterial({ color: city.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(0, groundY + 0.1, 0);
            group.add(ring);
            
            // 城市名字标签
            const label = makeNameTag(city.name, '#' + city.color.toString(16).padStart(6, '0'), city.pinyin);
            label.position.set(0, groundY + 7, 0);
            label.scale.set(2.8, 0.7, 1);
            group.add(label);
            
            group.position.set(x, 0, z);
            return group;
        }

        // 检查玩家是否靠近副本入口
        function checkNearDungeon() {
            const playerPos = getPlayerPos();
            for (const entrance of dungeonEntrances) {
                const dx = playerPos.x - entrance.x;
                const dz = playerPos.z - entrance.z;
                if (Math.sqrt(dx * dx + dz * dz) < 4) {
                    return entrance;
                }
            }
            return null;
        }

        // 创建副本退出传送门
        function createExitPortal() {
            const group = new THREE.Group();
            const color = 0x00ff88;
            
            // 传送门框架
            const pillarGeo = new THREE.BoxGeometry(0.5, 5, 0.5);
            const pillarMat = new THREE.MeshLambertMaterial({ color: 0x22ff88, emissive: 0x00ff88, emissiveIntensity: 0.3 });
            const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
            pillarL.position.set(-1.5, 2.5, 0);
            group.add(pillarL);
            const pillarR = pillarL.clone();
            pillarR.position.x = 1.5;
            group.add(pillarR);
            
            const beamGeo = new THREE.BoxGeometry(3.5, 0.5, 0.5);
            const beam = new THREE.Mesh(beamGeo, pillarMat);
            beam.position.set(0, 5, 0);
            group.add(beam);
            
            // 传送门光效
            const portalGeo = new THREE.PlaneGeometry(2.5, 4.5);
            const portalMat = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            const portal = new THREE.Mesh(portalGeo, portalMat);
            portal.position.set(0, 2.5, 0);
            portal.userData = { isExitPortal: true };
            group.add(portal);
            
            // 名字标签
            const label = makeNameTag('✅ 出口传送门', '#00ff88', 'chū kǒu');
            label.position.set(0, 6, 0);
            label.scale.set(3.0, 0.8, 1);
            group.add(label);
            
            // 放在副本角落
            group.position.set(DUNGEON_ORIGIN_X - DUNGEON_HALF + 3, 0, DUNGEON_ORIGIN_Z - DUNGEON_HALF + 3);
            dungeonExitPortal = { x: DUNGEON_ORIGIN_X - DUNGEON_HALF + 3, z: DUNGEON_ORIGIN_Z - DUNGEON_HALF + 3 };
            
            return group;
        }
        
        // 在副本中生成宝箱
        function spawnDungeonChest(floorData, floorIdx) {
            const chestKey = `${DUNGEON_ORIGIN_X + 8},${1},${DUNGEON_ORIGIN_Z + 8}`;
            addBlock(DUNGEON_ORIGIN_X + 8, 1, DUNGEON_ORIGIN_Z + 8, BLOCK_TYPES.DUNGEON_CHEST);
            const rewardData = DUNGEON_CHEST_REWARDS[dungeonState.currentDungeon];
            const chestLabel = makeNameTag('🎁 副本宝箱', '#ffaa00', 'fù běn bǎo xiāng');
            chestLabel.position.set(DUNGEON_ORIGIN_X + 8.5, 2.5, DUNGEON_ORIGIN_Z + 8.5);
            scene.add(chestLabel);
            dungeonState.chestLabel = chestLabel;
            showStatus(`🎁 宝箱已出现在第${floorIdx + 1}层！挖掘可获得奖励！`);
        }
        
        // 生成副本楼层（3D空间）
        function createDungeonFloor(floorData, centerX, centerZ) {
            const dungeonGroup = new THREE.Group();
            const floorSize = 30;
            const halfSize = floorSize / 2;
            
            // 地板
            const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
            const floorMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = 0;
            dungeonGroup.add(floor);
            
            // 墙壁
            const wallMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
            const wallGeo = new THREE.BoxGeometry(floorSize, 4, 0.5);
            const wallFront = new THREE.Mesh(wallGeo, wallMat);
            wallFront.position.set(0, 2, -halfSize);
            dungeonGroup.add(wallFront);
            const wallBack = new THREE.Mesh(wallGeo, wallMat);
            wallBack.position.set(0, 2, halfSize);
            dungeonGroup.add(wallBack);
            
            const wallSideGeo = new THREE.BoxGeometry(0.5, 4, floorSize);
            const wallLeft = new THREE.Mesh(wallSideGeo, wallMat);
            wallLeft.position.set(-halfSize, 2, 0);
            dungeonGroup.add(wallLeft);
            const wallRight = new THREE.Mesh(wallSideGeo, wallMat);
            wallRight.position.set(halfSize, 2, 0);
            dungeonGroup.add(wallRight);
            
            // 楼层标题
            const title = makeNameTag(floorData.name, '#ffd700', 'dìng ceng');
            title.position.set(0, 4.5, 0);
            title.scale.set(4.0, 1.0, 1);
            dungeonGroup.add(title);
            
            // 位置标签
            const posLabel = makeNameTag('副本内', '#88aaff', 'fù běn nèi');
            posLabel.position.set(0, 3.5, -halfSize + 0.3);
            posLabel.scale.set(3.0, 0.8, 1);
            dungeonGroup.add(posLabel);
            
            dungeonGroup.position.set(centerX, 0, centerZ);
            scene.add(dungeonGroup);
            
            return dungeonGroup;
        }

        // 在副本中生成怪物
        function spawnDungeonMobs(floorData, dungeonPos) {
            dungeonState.dungeonMobs = [];
            const mobCount = floorData.mobCount;
            const mobTypes = floorData.mobTypes;
            
            for (let i = 0; i < mobCount; i++) {
                const mobKey = mobTypes[Math.floor(Math.random() * mobTypes.length)];
                const mobType = DUNGEON_MOBS[mobKey];
                if (!mobType) continue;
                
                const mesh = createMobMesh(mobType);
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetZ = (Math.random() - 0.5) * 20;
                mesh.position.set(dungeonPos.x + offsetX, 0, dungeonPos.z + offsetZ);
                scene.add(mesh);
                
                const mob = {
                    type: mobType,
                    mesh: mesh,
                    hp: mobType.hp,
                    maxHp: mobType.hp,
                    dungeonMob: true,
                    alive: true,
                    healthBar: createHealthBar(mobType.hp),
                    wanderTimer: Math.random() * 2,
                    wanderDirX: (Math.random() - 0.5) * 0.3,
                    wanderDirZ: (Math.random() - 0.5) * 0.3,
                };
                mesh.add(mob.healthBar);
                mobs.push(mob);
                dungeonState.dungeonMobs.push(mob);
            }
            return dungeonState.dungeonMobs.length;
        }

        // 清理副本怪物和楼层
        function clearDungeon() {
            // 移除怪物
            for (const mob of dungeonState.dungeonMobs) {
                if (mob.mesh && mob.mesh.parent) {
                    scene.remove(mob.mesh);
                }
            }
            // 从全局 mobs 数组中移除
            for (let i = mobs.length - 1; i >= 0; i--) {
                if (mobs[i].dungeonMob) {
                    mobs.splice(i, 1);
                }
            }
            dungeonState.dungeonMobs = [];
            
            // 移除宝箱标签
            if (dungeonState.chestLabel) {
                scene.remove(dungeonState.chestLabel);
                dungeonState.chestLabel = null;
            }
            
            // 移除楼层
            if (dungeonState.dungeonFloor) {
                scene.remove(dungeonState.dungeonFloor);
                dungeonState.dungeonFloor = null;
            }
        }

        // 进入副本（传送到远程独立空间）
        function enterDungeon(dungeonType) {
            if (dungeonState.active) return;
            const dungeon = DUNGEONS[dungeonType];
            if (!dungeon) return;
            
            dungeonState.active = true;
            dungeonState.completed = false;
            dungeonState.currentDungeon = dungeonType;
            dungeonState.currentFloor = 0;
            dungeonState.questionsAnswered = 0;
            dungeonState.answered = false;
            dungeonState.bossActive = false;
            
            // 保存玩家当前位置（用于退出时返回）
            const pos = getPlayerPos();
            dungeonState.playerPos = { x: pos.x, y: pos.y, z: pos.z };
            dungeonState.entrancePos = { x: pos.x, z: pos.z };
            
            // 创建第一层（远程独立空间）
            const floorData = dungeon.floors_data[0];
            dungeonState.questions = floorData.questions;
            
            dungeonState.dungeonFloor = createDungeonFloor(floorData, DUNGEON_ORIGIN_X, DUNGEON_ORIGIN_Z);
            spawnDungeonMobs(floorData, { x: DUNGEON_ORIGIN_X, z: DUNGEON_ORIGIN_Z });
            spawnDungeonChest(floorData, 0);
            
            // 传送玩家到副本内
            pos.x = DUNGEON_ORIGIN_X;
            pos.z = DUNGEON_ORIGIN_Z;
            pos.y = 0.6;
            velocity.set(0, 0, 0);
            
            // 显示副本UI
            document.getElementById('dungeon-title').textContent = dungeon.title;
            document.getElementById('dungeon-reward').style.display = 'none';
            document.getElementById('dungeon-status').textContent = `👾 第${dungeonState.currentFloor + 1}层！击杀怪物 + 找宝箱！按 T 答题`;
            document.getElementById('dungeon-monster-count').textContent = `第${dungeonState.currentFloor + 1}层 | 怪物：${dungeonState.dungeonMobs.length}`;
            
            renderDungeonProgress();
            
            // 暂停游戏控制
            if (gameActive) {
                gameActive = false;
                controls.unlock();
            }
            
            showStatus('⚔️ 进入副本！击杀怪物+开宝箱+答题！完成所有层才能退出！');
            
            // 自动打开地图
            setTimeout(() => {
                const mapOverlay = document.getElementById('world-map-overlay');
                if (mapOverlay) {
                    mapOverlay.style.display = 'flex';
                    renderWorldMap();
                    showStatus('🗺️ 地图已打开，按 N 或 ESC 关闭');
                }
            }, 100);
        }

        // 渲染副本进度
        function renderDungeonProgress() {
            const progressEl = document.getElementById('dungeon-progress');
            progressEl.innerHTML = '';
            const dungeon = DUNGEONS[dungeonState.currentDungeon];
            for (let i = 0; i < dungeon.floors; i++) {
                const floor = document.createElement('div');
                floor.className = 'dungeon-floor' + (i === dungeonState.currentFloor ? ' active' : '') + (i < dungeonState.currentFloor ? ' done' : '');
                floor.textContent = `第${i + 1}层`;
                progressEl.appendChild(floor);
            }
        }

        // 答题（怪物全部击杀后）-> 与点击选项的 answerDungeonQuestion(idx, optEl) 区分
        function startDungeonQuestion() {
            if (!dungeonState.active) return;
            
            // 检查是否还有怪物
            const aliveMobs = dungeonState.dungeonMobs.filter(m => m.alive);
            if (aliveMobs.length > 0) {
                showStatus(`还有 ${aliveMobs.length} 只怪物，先击杀它们！`);
                return;
            }
            
            // 弹出答题界面
            const question = dungeonState.questions[dungeonState.questionsAnswered % dungeonState.questions.length];
            
            document.getElementById('dungeon-title').textContent = '📝 答题挑战';
            document.getElementById('dungeon-question').textContent = question.q;
            speakText(question.q, 0.85); // 怪物朗读题目
            document.getElementById('dungeon-options').innerHTML = '';
            document.getElementById('dungeon-reward').style.display = 'none';
            
            question.opts.forEach((opt, idx) => {
                const optEl = document.createElement('div');
                optEl.className = 'question-option';
                optEl.textContent = opt;
                optEl.addEventListener('click', () => {
                    const options = document.querySelectorAll('.question-option');
                    if (idx === question.answer) {
                        optEl.classList.add('correct');
                        playSound('triangle', 600, 0.1);
                        document.getElementById('dungeon-status').textContent = '✅ 答对！获得增益！';
                        speakText('答对了！真棒！', 1.0); // 怪物夸奖
                        // 给予增益：恢复HP
                        health = Math.min(maxHealth, health + 5);
                        updateVitalsUI();
                        dungeonState.questionsAnswered++;
                        setTimeout(() => {
                            advanceFloor();
                        }, 1000);
                    } else {
                        optEl.classList.add('wrong');
                        options[question.answer].classList.add('correct');
                        playSound('sawtooth', 200, 0.15);
                        document.getElementById('dungeon-status').textContent = '❌ 答错！怪物恢复1点HP，再试！';
                        speakText('答错了，再想想吧！', 1.0); // 怪物鼓励
                        // 恢复怪物HP
                        if (dungeonState.dungeonMobs.length > 0) {
                            const mob = dungeonState.dungeonMobs[0];
                            if (mob.hp < mob.maxHp) {
                                mob.hp++;
                                updateHealthBar(mob.healthBar, mob.hp);
                            }
                        }
                        setTimeout(() => {
                            document.getElementById('dungeon-options').innerHTML = '';
                            dungeonState.answered = false;
                            renderDungeonQuestion();
                        }, 1500);
                    }
                    options.forEach(o => o.classList.add('disabled'));
                });
                document.getElementById('dungeon-options').appendChild(optEl);
            });
            
            document.getElementById('dungeon-overlay').classList.add('visible');
            // 答题时玩家不受怪物攻击
            playerInvulnerable = true;
            dungeonState.answered = true;
        }

        // 渲染副本问题（注意：与教材关卡系统的 renderQuestion 同名会互相覆盖，故加 Dungeon 前缀）
        function renderDungeonQuestion() {
            // 答题时玩家不受怪物攻击
            playerInvulnerable = true;
            if (dungeonState.questionsAnswered >= 3) {
                advanceFloor();
                return;
            }
            
            const question = dungeonState.questions[dungeonState.questionsAnswered];
            document.getElementById('dungeon-question').textContent = question.q;
            speakText(question.q, 0.85); // 怪物朗读题目
            
            const optionsEl = document.getElementById('dungeon-options');
            optionsEl.innerHTML = '';
            
            question.opts.forEach((opt, idx) => {
                const optEl = document.createElement('div');
                optEl.className = 'question-option';
                optEl.textContent = opt;
                optEl.addEventListener('click', () => answerDungeonQuestion(idx, optEl));
                optionsEl.appendChild(optEl);
            });
            
            dungeonState.answered = false;
        }

        // 回答副本问题（与教材关卡系统的 answerQuestion 同名会互相覆盖，故加 Dungeon 前缀）
        function answerDungeonQuestion(idx, optEl) {
            if (dungeonState.answered) return;
            dungeonState.answered = true;
            
            const question = dungeonState.questions[dungeonState.questionsAnswered];
            const options = document.querySelectorAll('.question-option');
            
            if (idx === question.answer) {
                optEl.classList.add('correct');
                // 🎓 副本答题正确获得 XP
                addXP(12, '副本答题');
                playSound('triangle', 600, 0.1);
                document.getElementById('dungeon-status').textContent = '✅ 答对！';
                speakText('答对了！太厉害了！', 1.0); // 怪物夸奖
                // 击杀一只副本怪物
                if (dungeonState.dungeonMobs.length > 0) {
                    const mob = dungeonState.dungeonMobs[0];
                    if (mob.mesh && mob.mesh.parent) scene.remove(mob.mesh);
                    mob.alive = false;
                    dungeonState.dungeonMobs.shift();
                    document.getElementById('dungeon-monster-count').textContent = `剩余怪物：${dungeonState.dungeonMobs.length} 只`;
                }
                dungeonState.questionsAnswered++;
                setTimeout(() => {
                    if (dungeonState.questionsAnswered >= 3) {
                        advanceFloor();
                    } else {
                        renderDungeonQuestion();
                    }
                }, 1000);
            } else {
                optEl.classList.add('wrong');
                options[question.answer].classList.add('correct');
                playSound('sawtooth', 200, 0.15);
                document.getElementById('dungeon-status').textContent = '❌ 答错！再试一次';
                speakText('答错了，没关系，再试一次！', 1.0); // 怪物鼓励
                setTimeout(() => {
                    document.getElementById('dungeon-options').innerHTML = '';
                    dungeonState.answered = false;
                    renderDungeonQuestion();
                }, 1500);
            }
            
            options.forEach(o => o.classList.add('disabled'));
        }

        // 进入下一层
        function advanceFloor() {
            const dungeon = DUNGEONS[dungeonState.currentDungeon];
            dungeonState.currentFloor++;
            
            if (dungeonState.currentFloor >= dungeon.floors) {
                completeDungeon();
                return;
            }
            
            // 清理当前层
            clearDungeon();
            
            // 创建新楼层（同一远程空间）
            const floorData = dungeon.floors_data[dungeonState.currentFloor];
            dungeonState.questions = floorData.questions;
            dungeonState.questionsAnswered = 0;
            
            dungeonState.dungeonFloor = createDungeonFloor(floorData, DUNGEON_ORIGIN_X, DUNGEON_ORIGIN_Z);
            spawnDungeonMobs(floorData, { x: DUNGEON_ORIGIN_X, z: DUNGEON_ORIGIN_Z });
            spawnDungeonChest(floorData, dungeonState.currentFloor);
            
            // 检查是否是BOSS层
            if (floorData.mobTypes.includes('bossMonster')) {
                dungeonState.bossActive = true;
            }
            
            // 传送玩家到新楼层入口
            const pos = getPlayerPos();
            pos.x = DUNGEON_ORIGIN_X;
            pos.z = DUNGEON_ORIGIN_Z;
            pos.y = 0.6;
            velocity.set(0, 0, 0);
            
            document.getElementById('dungeon-status').textContent = `👾 第${dungeonState.currentFloor + 1}层！击杀怪物+找宝箱！按 T 答题`;
            document.getElementById('dungeon-monster-count').textContent = `第${dungeonState.currentFloor + 1}层 | 怪物：${dungeonState.dungeonMobs.length}`;
            
            renderDungeonProgress();
            document.getElementById('dungeon-overlay').classList.remove('visible');
            playerInvulnerable = false;
            
            showStatus(`⚔️ 进入第${dungeonState.currentFloor + 1}层！找宝箱+击杀怪物！`);
        }

        // 完成副本
        function completeDungeon() {
            const dungeon = DUNGEONS[dungeonState.currentDungeon];
            const reward = dungeon.reward;
            
            dungeonState.completed = true; // 标记完成
            
            document.getElementById('dungeon-question').textContent = '🎉 恭喜你通过副本！';
            document.getElementById('dungeon-options').innerHTML = '';
            
            const rewardEl = document.getElementById('dungeon-reward');
            rewardEl.style.display = 'block';
            rewardEl.innerHTML = `<div class="reward-item">🎁 获得奖励：${reward.name}</div><div style="font-size:14px;color:#aaa">${reward.desc}</div>`;
            
            // 给予奖励
            if (dungeonState.currentDungeon === 'chinese') {
                inventory.enchantedBook = (inventory.enchantedBook || 0) + 1;
            } else if (dungeonState.currentDungeon === 'math') {
                inventory.mathCrystal = (inventory.mathCrystal || 0) + 1;
            } else if (dungeonState.currentDungeon === 'english') {
                inventory.englishGem = (inventory.englishGem || 0) + 1;
            }
            
            // 解锁城市传送点（完成副本解锁新城市，探索过的已自动解锁）
            if (dungeonState.currentDungeon === 'chinese') {
                cityTeleportUnlocked.add('北京');
                cityTeleportUnlocked.add('上海');
            } else if (dungeonState.currentDungeon === 'math') {
                cityTeleportUnlocked.add('广州');
                cityTeleportUnlocked.add('成都');
            } else if (dungeonState.currentDungeon === 'english') {
                cityTeleportUnlocked.add('杭州');
                cityTeleportUnlocked.add('西安');
            }
            
            playCraftSound();
            document.getElementById('dungeon-status').textContent = '✅ 副本完成！传送门已开启！走过去退出！';
            
            // 生成退出传送门
            if (!dungeonExitPortalGroup) {
                dungeonExitPortalGroup = createExitPortal();
                scene.add(dungeonExitPortalGroup);
            }
        }

        // 退出副本（传回入口位置）
        function exitDungeon() {
            // 检查是否已完成副本（只有完成才能退出）
            if (!dungeonState.completed) {
                showStatus('❌ 必须先完成所有关卡才能退出副本！');
                document.getElementById('dungeon-status').textContent = '❌ 完成所有关卡后才能退出！继续加油！';
                return;
            }
            
            clearDungeon();
            // 移除退出传送门
            if (dungeonExitPortalGroup) {
                scene.remove(dungeonExitPortalGroup);
                dungeonExitPortalGroup = null;
                dungeonExitPortal = null;
            }
            dungeonState.active = false;
            dungeonState.completed = false;
            document.getElementById('dungeon-overlay').classList.remove('visible');
            playerInvulnerable = false;
            
            // 恢复玩家位置（传回入口）
            if (dungeonState.playerPos) {
                const pos = getPlayerPos();
                pos.x = dungeonState.playerPos.x;
                pos.y = dungeonState.playerPos.y;
                pos.z = dungeonState.playerPos.z;
                velocity.set(0, 0, 0);
            }
            
            // 恢复游戏
            gameActive = true;
            if (!fallbackMode) controls.lock();
            showStatus('🎉 副本完成！获得奖励！');
        }

        // 关闭副本（UI）
        function closeDungeon() {
            exitDungeon();
        }
        
        // 关闭死亡复活界面（不检查副本完成状态）
        function closeDeathOverlay() {
            document.getElementById('dungeon-overlay').classList.remove('visible');
            playerInvulnerable = false;
            // 恢复游戏
            gameActive = true;
            if (!fallbackMode) controls.lock();
        }

        // === 死亡出题复活系统 ===
        const REVIVAL_QUESTIONS = [
            { q: '语文：拼音"mā"对应的汉字是？', opts: ['妈', '马', '麻', '吗'], answer: 0 },
            { q: '语文："白日依山尽"下一句是？', opts: ['黄河入海流', '欲穷千里目', '更上一层楼', '手可摘星辰'], answer: 0 },
            { q: '语文："风吹草低见牛羊"出自？', opts: ['《敕勒歌》', '《登鹳雀楼》', '《望庐山瀑布》', '《夜宿山寺》'], answer: 0 },
            { q: '数学：3 + 5 = ?', opts: ['7', '8', '9', '6'], answer: 1 },
            { q: '数学：10 - 4 = ?', opts: ['4', '5', '6', '3'], answer: 2 },
            { q: '数学：2 × 3 = ?', opts: ['5', '6', '7', '8'], answer: 1 },
            { q: '数学：15 - 7 = ?', opts: ['6', '7', '8', '9'], answer: 2 },
            { q: '数学：4 × 4 = ?', opts: ['16', '12', '14', '18'], answer: 0 },
            { q: '数学：5 × 2 = ?', opts: ['10', '7', '5', '3'], answer: 0 },
            { q: '数学：25 + 15 = ?', opts: ['35', '40', '45', '50'], answer: 1 },
        ];

        function showDeathQuestion() {
            const question = REVIVAL_QUESTIONS[Math.floor(Math.random() * REVIVAL_QUESTIONS.length)];
            
            document.getElementById('dungeon-title').textContent = '💀 死亡复活挑战';
            document.getElementById('dungeon-progress').innerHTML = '<div class="dungeon-floor active">💡 点击下方选项答题，答对即可复活</div>';
            document.getElementById('dungeon-question').textContent = question.q;
            speakText(question.q, 0.85); // 朗读题目帮助玩家
            document.getElementById('dungeon-status').textContent = '你已死亡！点击下方的选项回答问题，答对即可复活（答错会在出生点重生）';
            document.getElementById('dungeon-options').innerHTML = '';
            document.getElementById('dungeon-reward').style.display = 'none';
            document.getElementById('dungeon-monster-count').textContent = '';
            
            question.opts.forEach((opt, idx) => {
                const optEl = document.createElement('div');
                optEl.className = 'question-option';
                optEl.textContent = opt;
                optEl.addEventListener('click', () => {
                    const options = document.querySelectorAll('.question-option');
                    if (idx === question.answer) {
                        optEl.classList.add('correct');
                        playSound('triangle', 600, 0.1);
                        document.getElementById('dungeon-status').textContent = '✅ 答对！获得复活！';
                        health = Math.floor(maxHealth * 0.5);
                        hunger = Math.floor(maxHunger * 0.5);
                        playerDead = false;
                        const pos = getPlayerPos();
                        if (dungeonState.active) {
                            // 副本内复活：保持位置，确保在地面上
                            pos.y = 0.6;
                        } else {
                            const respawnY = getGroundY(pos.x, pos.z);
                            pos.y = Math.max(respawnY, WATER_LEVEL_Y + 0.6);
                        }
                        velocity.set(0, 0, 0);
                        showStatus('💚 复活成功！');
                        updateVitalsUI();
                        setTimeout(() => {
                            closeDeathOverlay();
                            saveGame();
                        }, 1500);
                    } else {
                        optEl.classList.add('wrong');
                        options[question.answer].classList.add('correct');
                        playSound('sawtooth', 200, 0.15);
                        // 答错：在出生点重生（副本内则在副本内重生）
                        const inDungeon = dungeonState.active;
                        document.getElementById('dungeon-status').textContent = inDungeon 
                            ? '❌ 答错！在副本入口重生...' 
                            : '❌ 答错！在出生点重生...';
                        setTimeout(() => {
                            health = maxHealth;
                            hunger = maxHunger;
                            playerDead = false;
                            const pos = getPlayerPos();
                            if (inDungeon) {
                                pos.x = DUNGEON_ORIGIN_X;
                                pos.y = 0.6;
                                pos.z = DUNGEON_ORIGIN_Z;
                                showStatus('💀 在副本入口重生');
                            } else {
                                pos.set(0, getGroundY(0, 0), 0);
                                showStatus('💀 在出生点重生');
                            }
                            velocity.set(0, 0, 0);
                            updateVitalsUI();
                            closeDeathOverlay();
                            saveGame();
                        }, 2000);
                    }
                    options.forEach(o => o.classList.add('disabled'));
                });
                document.getElementById('dungeon-options').appendChild(optEl);
            });
            
            document.getElementById('dungeon-overlay').classList.add('visible');
            // 答题时玩家不受怪物攻击
            playerInvulnerable = true;
            if (gameActive) {
                gameActive = false;
                controls.unlock();
            }
        }

        // 初始化副本入口（在 terrain 生成后调用）
        // initDungeonEntrances();

        // 添加副本入口事件监听
        document.getElementById('dungeon-close').addEventListener('click', closeDungeon);
        
        // 朗读题目按钮（点击重新朗读当前题目）
        document.getElementById('dungeon-speak-btn').addEventListener('click', () => {
            const qEl = document.getElementById('dungeon-question');
            if (qEl && qEl.textContent) {
                speakText(qEl.textContent, 0.85);
            }
        });

        // 传送门确认提示
        let portalPromptActive = false;
        let portalPromptCallback = null;
        
        function showPortalPrompt(text, onYes, onNo) {
            if (portalPromptActive) return;
            portalPromptActive = true;
            portalPromptCallback = null;
            document.getElementById('portal-prompt-text').textContent = text;
            const overlay = document.getElementById('portal-prompt-overlay');
            const yesBtn = document.getElementById('portal-yes-btn');
            const noBtn = document.getElementById('portal-no-btn');
            yesBtn.textContent = '✅ 进入副本';
            noBtn.textContent = '❌ 取消';
            
            // 用 addEventListener 替代 onclick（更可靠，支持 stopPropagation）
            const onYesClick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanupHandlers();
                hidePortalPrompt();
                if (onYes) onYes();
            };
            const onNoClick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                cleanupHandlers();
                hidePortalPrompt();
                if (onNo) onNo();
            };
            const cleanupHandlers = () => {
                yesBtn.removeEventListener('click', onYesClick);
                noBtn.removeEventListener('click', onNoClick);
            };
            
            yesBtn.addEventListener('click', onYesClick);
            noBtn.addEventListener('click', onNoClick);
            overlay.classList.add('visible');
            if (gameActive) { gameActive = false; controls.unlock(); }
        }
        
        function hidePortalPrompt() {
            portalPromptActive = false;
            document.getElementById('portal-prompt-overlay').classList.remove('visible');
            if (!playerDead) {
                gameActive = true;
                setTimeout(() => { if (!fallbackMode && gameActive) controls.lock(); }, 50);
            }
        }
        
        // === 城市传送门确认弹窗 ===
        let cityPortalPromptActive = false;
        let cityPortalPromptTimer = 0; // 冷却计时器，避免重复弹出
        
        function showCityPortalPrompt(city) {
            if (cityPortalPromptActive) return;
            cityPortalPromptActive = true;
            document.getElementById('city-portal-prompt-text').innerHTML =
                `📍 ${city.icon} ${city.name} <span style="color:#888;font-size:13px">(${city.pinyin})</span><br>` +
                `穿过传送门即可到达该城市！`;
            
            const overlay = document.getElementById('city-portal-prompt-overlay');
            const yesBtn = document.getElementById('city-portal-yes-btn');
            const noBtn = document.getElementById('city-portal-no-btn');
            
            const onYes = (e) => {
                e.stopPropagation(); e.preventDefault();
                cleanupCity();
                hideCityPortalPrompt();
                teleportToCity(city.name);
            };
            const onNo = (e) => {
                e.stopPropagation(); e.preventDefault();
                cleanupCity();
                hideCityPortalPrompt();
            };
            const cleanupCity = () => {
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
            };
            
            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
            overlay.classList.add('visible');
            if (gameActive) { gameActive = false; controls.unlock(); }
        }
        
        function hideCityPortalPrompt() {
            cityPortalPromptActive = false;
            document.getElementById('city-portal-prompt-overlay').classList.remove('visible');
            // 设置冷却，避免立即再次弹出
            cityPortalPromptTimer = 5; // 5秒冷却
            if (!playerDead) {
                gameActive = true;
                setTimeout(() => { if (!fallbackMode && gameActive) controls.lock(); }, 50);
            }
        }
        
        // 在 updateChunks 后检查副本入口
        let portalPromptShown = false;
        const origUpdateChunks = updateChunks;
        updateChunks = function() {
            origUpdateChunks();
            const playerPos = getPlayerPos();
            
            // 检测是否靠近副本传送门
            if (!portalPromptActive && !dungeonState.active) {
                for (const entrance of dungeonEntrances) {
                    const dx = playerPos.x - entrance.x;
                    const dz = playerPos.z - entrance.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 4) {
                        if (!portalPromptShown) {
                            portalPromptShown = true;
                            showPortalPrompt(
                                `⚔️ 是否进入${entrance.name}？`,
                                () => { enterDungeon(entrance.type); portalPromptShown = false; },
                                () => { portalPromptShown = false; }
                            );
                        }
                        break;
                    }
                }
                // 离开传送门范围后重置提示标记
                let nearAny = false;
                for (const entrance of dungeonEntrances) {
                    const dx = playerPos.x - entrance.x;
                    const dz = playerPos.z - entrance.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 6) { nearAny = true; break; }
                }
                if (!nearAny) portalPromptShown = false;
            }
            
            // 副本内检测退出传送门
            if (dungeonState.active && dungeonState.completed && dungeonExitPortal) {
                const edx = playerPos.x - dungeonExitPortal.x;
                const edz = playerPos.z - dungeonExitPortal.z;
                if (Math.sqrt(edx * edx + edz * edz) < 3) {
                    if (!portalPromptShown) {
                        portalPromptShown = true;
                        showPortalPrompt(
                            '✅ 副本已完成！是否退出副本？',
                            () => { exitDungeon(); portalPromptShown = false; },
                            () => { portalPromptShown = false; }
                        );
                    }
                }
            }
        };

        // T 键：副本内答题
        const origOnKeyDown = onKeyDown;
        onKeyDown = function(event) {
            if (event.code === 'KeyT' && dungeonState.active && gameActive) {
                startDungeonQuestion();
                return;
            }
            origOnKeyDown(event);
        };
        // 不再需要重新绑定：line 3783 的包装器会自动调用当前 onKeyDown

        // ============================================================
        // 教材闯关系统（二年级上册：语文 / 数学 / 英语）
        // 按单元设计关卡，覆盖所有知识点；通关按得分获得青铜/白银/黄金宝箱
        // ============================================================

        // === 题库：按学科 → 单元 → 知识点 ===
        const LEVEL_BANK = [
            {
                subject: '语文', icon: '📖', color: '#55aa44',
                units: [
                    {
                        name: '第一单元 课文', kp: '小蝌蚪找妈妈 · 我是什么 · 植物妈妈有办法',
                        questions: [
                            { q: '《小蝌蚪找妈妈》中小蝌蚪最后长成了什么？', opts: ['小鱼','青蛙','乌龟','螃蟹'], answer: 1, explain: '小蝌蚪长出四条腿、尾巴变短，变成了青蛙' },
                            { q: '小蝌蚪先长出的是哪条腿？', opts: ['前腿','后腿','两条一起','没有腿'], answer: 1, explain: '小蝌蚪先长出两条后腿，再长前腿' },
                            { q: '鲤鱼阿姨说青蛙妈妈有什么特征？', opts: ['四条腿，宽嘴巴','大眼睛，绿衣裳','长长的尾巴','披着白雪'], answer: 0, explain: '鲤鱼说：你们的妈妈四条腿，宽嘴巴' },
                            { q: '《我是什么》一文中"我"是什么？', opts: ['太阳','水','风','云'], answer: 1, explain: '我会变成汽、云、雨、冰雹、雪，"我"是水' },
                            { q: '蒲公英妈妈用什么办法传播种子？', opts: ['风','水','动物皮毛','太阳晒'], answer: 0, explain: '蒲公英妈妈准备了降落伞，让孩子们乘着风出发' },
                            { q: '苍耳妈妈让孩子怎样旅行？', opts: ['挂在动物的皮毛上','乘着风飞','随水漂流','炸开豆荚'], answer: 0, explain: '苍耳给孩子穿上带刺的铠甲，挂住动物皮毛' },
                            { q: '《植物妈妈有办法》告诉我们什么道理？', opts: ['植物都能飞','仔细观察才有知识','种子都很重','风很大'], answer: 1, explain: '那里有许许多多的知识，粗心的小朋友却得不到它' }
                        ]
                    },
                    {
                        name: '第二单元 识字', kp: '场景歌 · 树之歌 · 拍手歌 · 田家四季歌',
                        questions: [
                            { q: '"（ ）海鸥，一片沙滩"括号里填什么？', opts: ['一只','一艘','一方','一孔'], answer: 0, explain: '量词"只"用于鸟，一只海鸥' },
                            { q: '《树之歌》中"枫树秋天叶儿（ ）"', opts: ['绿','红','黄','白'], answer: 1, explain: '枫树秋天叶儿红' },
                            { q: '《树之歌》中"松柏四季披（ ）"', opts: ['彩衣','绿装','白雪','红装'], answer: 1, explain: '松柏四季披绿装' },
                            { q: '"你拍七，我拍七，（ ）熊猫在嬉戏"', opts: ['山中','竹林','树林','丛林'], answer: 1, explain: '你拍七，我拍七，竹林熊猫在嬉戏' },
                            { q: '《拍手歌》中说人和动物是什么关系？', opts: ['敌人','朋友','主人','陌生人'], answer: 1, explain: '你拍九，我拍九，人和动物是朋友' },
                            { q: '《田家四季歌》中"春季里，春风吹，（ ）"', opts: ['麦苗儿多嫩','桑叶儿正肥','稻上场','雪初晴'], answer: 0, explain: '春季里，春风吹，麦苗儿多嫩，桑叶儿正肥' },
                            { q: '《田家四季歌》中"秋季里，稻上场，（ ）"', opts: ['谷像黄金粒粒香','身体虽辛苦','早起勤耕作','大家笑盈盈'], answer: 0, explain: '秋季里，稻上场，谷像黄金粒粒香' }
                        ]
                    },
                    {
                        name: '第三单元 课文', kp: '曹冲称象 · 玲玲的画 · 一封信 · 妈妈睡了',
                        questions: [
                            { q: '《曹冲称象》中曹冲用什么称出大象的重量？', opts: ['大秤','船和石头','天平','吊车'], answer: 1, explain: '把大象赶到船上画线，再装石头到同一水位，称石头即知象重' },
                            { q: '曹冲称象时第一步是什么？', opts: ['把大象赶到船上','称石头','造大秤','砍大树'], answer: 0, explain: '先沿水面在船舷上画一条线' },
                            { q: '《玲玲的画》中弄脏的画最后变成什么样？', opts: ['扔掉了','画得更好了','更糟了','重画一张'], answer: 1, explain: '玲玲在弄脏的地方画了一只小花狗，整张画更好了' },
                            { q: '《一封信》中妈妈帮露西把信改成了什么？', opts: ['难过的话','积极的话','更长的信','简短的信'], answer: 1, explain: '妈妈说"我们过得挺好"，把消极内容改成积极内容' },
                            { q: '《妈妈睡了》中妈妈睡觉前在做什么？', opts: ['哄我午睡','看电视','做饭','散步'], answer: 0, explain: '妈妈哄我午睡的时候，自己先睡着了' },
                            { q: '《妈妈睡了》中"睡梦中的妈妈真（ ）"', opts: ['累','美丽','温柔','困'], answer: 1, explain: '睡梦中的妈妈真美丽' }
                        ]
                    },
                    {
                        name: '第四单元 课文', kp: '古诗二首 · 黄山奇石 · 日月潭 · 葡萄沟',
                        questions: [
                            { q: '《登鹳雀楼》的作者是谁？', opts: ['李白','王之涣','杜甫','白居易'], answer: 1, explain: '《登鹳雀楼》是唐代王之涣的作品' },
                            { q: '《望庐山瀑布》的作者是谁？', opts: ['李白','杜甫','王之涣','王维'], answer: 0, explain: '《望庐山瀑布》是李白的作品' },
                            { q: '"日照香炉生（ ）"括号里填什么？', opts: ['白雪','紫烟','绿水','清风'], answer: 1, explain: '日照香炉生紫烟' },
                            { q: '《黄山奇石》中"猴子观海"中的猴子在做什么？', opts: ['抱着腿蹲在山头','跳海','吃桃子','睡觉'], answer: 0, explain: '两只胳膊抱着腿，一动不动地蹲在山头' },
                            { q: '《日月潭》中的日月潭在哪个省？', opts: ['福建','浙江','台湾','广东'], answer: 2, explain: '日月潭是我国台湾省最大的一个湖' },
                            { q: '《日月潭》中被光华岛分成日潭和月潭，日潭像什么？', opts: ['弯弯的月亮','圆圆的太阳','一条河','一座山'], answer: 1, explain: '北边像圆圆的太阳，叫日潭' },
                            { q: '《葡萄沟》在哪个地方？', opts: ['云南','新疆吐鲁番','内蒙古','四川'], answer: 1, explain: '新疆吐鲁番有个地方叫葡萄沟' },
                            { q: '《葡萄沟》中葡萄是在几月份成熟的？', opts: ['五六月','七八月','八九月份','十二月份'], answer: 2, explain: '到了八九月份，人们最喜爱的葡萄成熟了' }
                        ]
                    },
                    {
                        name: '第五单元 寓言', kp: '坐井观天 · 寒号鸟 · 我要的是葫芦',
                        questions: [
                            { q: '《坐井观天》中青蛙认为天有多大？', opts: ['井口那么大','无边无际','很大','看不到边'], answer: 0, explain: '青蛙说：天不过井口那么大' },
                            { q: '《坐井观天》中谁说的是对的天有多大？', opts: ['青蛙','小鸟','乌龟','兔子'], answer: 1, explain: '小鸟说：天无边无际，大得很哪！青蛙弄错了' },
                            { q: '《寒号鸟》中寒号鸟最后怎么样了？', opts: ['做窝了','冻死了','飞走了','搬家了'], answer: 1, explain: '寒号鸟不听劝告不做窝，最后在夜里冻死了' },
                            { q: '《寒号鸟》中谁做了温暖的窝？', opts: ['喜鹊','寒号鸟','乌鸦','麻雀'], answer: 0, explain: '喜鹊衔回枯草忙着做窝，冬天住在温暖的窝里' },
                            { q: '《我要的是葫芦》中种葫芦的人只盯着什么？', opts: ['葫芦','叶子','虫子','花'], answer: 0, explain: '他盯着小葫芦自言自语，只顾葫芦不理叶子上的蚜虫' },
                            { q: '《我要的是葫芦》最后葫芦怎么样了？', opts: ['变大了','变黄落掉了','摘下来了','开花了'], answer: 1, explain: '蚜虫越来越多，小葫芦慢慢变黄，一个一个都落了' }
                        ]
                    },
                    {
                        name: '第六单元 课文', kp: '大禹治水 · 朱德的扁担 · 难忘的泼水节',
                        questions: [
                            { q: '《大禹治水》中禹用什么办法治水？', opts: ['筑坝挡水','疏导','挖深沟','筑城墙'], answer: 1, explain: '禹吸取教训，采用疏导的办法治水' },
                            { q: '禹的父亲鲧治水用了几年？', opts: ['三年','九年','九年以上','十年'], answer: 1, explain: '鲧只知道筑坝挡水，九年过去了洪水仍然没有消退' },
                            { q: '《朱德的扁担》中扁担上写了什么？', opts: ['朱德的扁担','为人民服务','坚持到底','朱德同志'], answer: 0, explain: '朱德又找来一根扁担，写上"朱德的扁担"五个字' },
                            { q: '《难忘的泼水节》是哪一年的？', opts: ['1949年','1961年','1976年','1950年'], answer: 1, explain: '1961年的泼水节，周总理要和傣族人民一起过' },
                            { q: '《难忘的泼水节》中和傣族人民过节的是谁？', opts: ['毛泽东','周恩来','邓小平','朱德'], answer: 1, explain: '敬爱的周恩来总理要和傣族人民一起过泼水节' }
                        ]
                    },
                    {
                        name: '第七单元 课文', kp: '古诗二首 · 雾在哪里 · 雪孩子',
                        questions: [
                            { q: '《夜宿山寺》的作者是谁？', opts: ['王之涣','李白','杜甫','王安石'], answer: 1, explain: '《夜宿山寺》是唐代李白的作品' },
                            { q: '"危楼高百尺，（ ）"下一句是什么？', opts: ['手可摘星辰','白云生处有人家','黄河入海流','日照香炉生紫烟'], answer: 0, explain: '危楼高百尺，手可摘星辰' },
                            { q: '《敕勒歌》中"风吹草低见（ ）"', opts: ['牛羊','骏马','骆驼','山羊'], answer: 0, explain: '天苍苍，野茫茫，风吹草低见牛羊' },
                            { q: '《雾在哪里》中雾最后怎么样了？', opts: ['消失了','变大了','变成雨','变成雪'], answer: 0, explain: '雾把自己藏了起来，最后不知消失到哪里去了' },
                            { q: '《雪孩子》中雪孩子最后变成了什么？', opts: ['水','白云','冰','雪'], answer: 1, explain: '雪孩子化成水变成水汽，飞上天空变成了一朵白云' },
                            { q: '《雪孩子》中雪孩子救出了谁？', opts: ['兔妈妈','小白兔','小鸭子','小狐狸'], answer: 1, explain: '雪孩子冲进屋里，把小白兔抱了出来，小白兔得救了' }
                        ]
                    },
                    {
                        name: '第八单元 故事', kp: '狐假虎威 · 狐狸分奶酪 · 纸船和风筝 · 风娃娃',
                        questions: [
                            { q: '《狐假虎威》中老虎为什么跟着狐狸走？', opts: ['被狐狸骗了','和狐狸是朋友','想抓狐狸','怕狐狸'], answer: 0, explain: '狐狸说老天爷派它管百兽，老虎半信半疑跟着走，其实受骗了' },
                            { q: '《狐假虎威》中野兽们为什么跑了？', opts: ['害怕狐狸','害怕老虎','想玩','找食物'], answer: 1, explain: '野兽是害怕老虎才跑掉的，老虎信以为真' },
                            { q: '《狐狸分奶酪》中奶酪最后怎么样了？', opts: ['被弟弟吃了','被哥哥吃了','被狐狸吃光了','分好了'], answer: 2, explain: '狐狸咬来咬去，奶酪全被狐狸吃光了' },
                            { q: '《纸船和风筝》中松鼠住在哪里？', opts: ['山顶','山脚','河边','树上'], answer: 0, explain: '松鼠住在山顶，小熊住在山脚' },
                            { q: '《风娃娃》中风娃娃最后明白了什么？', opts: ['力气管用','方法很重要','要睡觉','要吃饭'], answer: 1, explain: '光有好的愿望还不行，还要看是不是真的对别人有用' }
                        ]
                    }
                ]
            },
            {
                subject: '数学', icon: '🔢', color: '#ffaa33',
                units: [
                    {
                        name: '第一单元 加与减', kp: '100以内连加、连减、加减混合',
                        questions: [
                            { q: '24 + 30 + 41 = ?', opts: ['95','94','96','85'], answer: 0, explain: '从左往右依次计算：24+30=54，54+41=95' },
                            { q: '90 - 45 - 25 = ?', opts: ['20','25','15','30'], answer: 0, explain: '从左往右依次计算：90-45=45，45-25=20' },
                            { q: '52 - 9 + 15 = ?', opts: ['58','56','54','68'], answer: 0, explain: '从左往右算：52-9=43，43+15=58' },
                            { q: '连加减的运算顺序是从哪里开始？', opts: ['从左边','从右边','从中间','随便'], answer: 0, explain: '连加连减要从左往右依次计算' },
                            { q: '38 + 27 + 15 = ?', opts: ['80','78','82','90'], answer: 0, explain: '38+27=65，65+15=80' }
                        ]
                    },
                    {
                        name: '第二单元 购物', kp: '人民币单位与换算 · 购物计算',
                        questions: [
                            { q: '1元 = ？角', opts: ['10','100','5','1'], answer: 0, explain: '1元 = 10角' },
                            { q: '1角 = ？分', opts: ['10','100','5','1'], answer: 0, explain: '1角 = 10分' },
                            { q: '1元 = ？分', opts: ['10','100','50','5'], answer: 1, explain: '1元 = 100分' },
                            { q: '1元5角 + 3元 = ？', opts: ['4元5角','3元5角','4元','5元'], answer: 0, explain: '1元5角 + 3元 = 4元5角' },
                            { q: '拿8元买5元的本子，应找回多少钱？', opts: ['3元','2元','5元','8元'], answer: 0, explain: '付出的钱 - 物品价钱 = 找回的钱：8 - 5 = 3元' },
                            { q: '3元6角 + 2元4角 = ？', opts: ['6元','5元10角','6元0角','5元'], answer: 0, explain: '3元6角+2元4角=5元10角=6元' }
                        ]
                    },
                    {
                        name: '第三单元 数一数与乘法', kp: '相同加数连加 · 乘法初步认识',
                        questions: [
                            { q: '3 + 3 + 3 + 3 = ?', opts: ['12','9','16','15'], answer: 0, explain: '4个3相加 = 12' },
                            { q: '5 + 5 + 5 = ？写成乘法算式是？', opts: ['3×5=15','5×3=15','3+5=8','5+3=8'], answer: 0, explain: '3个5相加 = 3×5=15 或 5×3=15' },
                            { q: '2 × 4 = ?', opts: ['8','6','10','7'], answer: 0, explain: '2乘4等于8' },
                            { q: '乘法算式 3 × 5 读作什么？', opts: ['3乘5等于15','5加3等于8','3除以5','3加5'], answer: 0, explain: '读作：3乘5等于15' },
                            { q: '2 × 4 的得数叫什么？', opts: ['积','商','余数','差'], answer: 0, explain: '乘数 × 乘数 = 积，得数叫积' },
                            { q: '4个2相加可以写成？', opts: ['2×4','2+4','4-2','4÷2'], answer: 0, explain: '求几个相同加数的和，可以用乘法：2×4=8' }
                        ]
                    },
                    {
                        name: '第四单元 图形的变化', kp: '轴对称 · 平移 · 旋转',
                        questions: [
                            { q: '图形对折后两边完全重合，折痕叫什么？', opts: ['对称轴','中线','高','底'], answer: 0, explain: '把图形对折，两边完全重合，折痕叫对称轴' },
                            { q: '推拉窗户属于什么运动？', opts: ['平移','旋转','滚动','对称'], answer: 0, explain: '平移：物体沿直线移动，推拉窗户是平移' },
                            { q: '风车转动属于什么运动？', opts: ['旋转','平移','对称','滑动'], answer: 0, explain: '旋转：物体绕一个点转动，风车、钟表指针是旋转' },
                            { q: '平移时图形的形状和大小会怎样？', opts: ['不变','变大','变小','变形'], answer: 0, explain: '平移：物体沿直线移动，形状大小不变' },
                            { q: '钟表指针的运动属于什么？', opts: ['旋转','平移','翻转','静止'], answer: 0, explain: '钟表指针绕中心点转动，属于旋转' }
                        ]
                    },
                    {
                        name: '第五单元 2-5的乘法口诀', kp: '2、3、4、5的乘法口诀',
                        questions: [
                            { q: '三五十五，三五 = ?', opts: ['15','10','20','25'], answer: 0, explain: '三五十五' },
                            { q: '四五二十，四五 = ?', opts: ['20','12','16','18'], answer: 0, explain: '四五二十' },
                            { q: '二五 = ?', opts: ['10','12','8','15'], answer: 0, explain: '二五一十' },
                            { q: '二三 = ?', opts: ['6','8','12','15'], answer: 0, explain: '二三得六' },
                            { q: '二四 = ?', opts: ['8','6','12','10'], answer: 0, explain: '二四得八' },
                            { q: '二六 = ?', opts: ['12','10','8','16'], answer: 0, explain: '二六十二' },
                            { q: '三四 = ?', opts: ['12','16','10','15'], answer: 0, explain: '三四十二' },
                            { q: '三五 = ?（3的口诀）', opts: ['15','12','18','20'], answer: 0, explain: '三五十五' },
                            { q: '一四 = ?', opts: ['4','8','6','12'], answer: 0, explain: '一四得四' },
                            { q: '5辆三轮车，每辆3个轮子，一共有几个轮子？', opts: ['15','12','10','8'], answer: 0, explain: '每辆3个轮子，5辆：3×5=15' },
                            { q: '口诀规律：几的口诀，相邻两句得数相差多少？', opts: ['几','1','2','10'], answer: 0, explain: '相邻两句得数相差"几"' }
                        ]
                    },
                    {
                        name: '第六单元 测量', kp: '厘米与米 · 长度测量',
                        questions: [
                            { q: '测量较短物体用什么单位？', opts: ['厘米','米','千米','分米'], answer: 0, explain: '厘米：测量较短物体' },
                            { q: '测量较长物体用什么单位？', opts: ['米','厘米','毫米','厘米'], answer: 0, explain: '米：测量较长物体' },
                            { q: '1米 = ？厘米', opts: ['100','10','1000','50'], answer: 0, explain: '1米 = 100厘米' },
                            { q: '用尺子量物体时，物体一端要对准什么刻度？', opts: ['0刻度','1刻度','任意刻度','中间'], answer: 0, explain: '物体一端对准尺子0刻度，看另一端对应刻度' },
                            { q: '线段有什么特点？', opts: ['直的，有两个端点','弯曲的','无端点','圆形'], answer: 0, explain: '线段：直的，有两个端点，可以量长度' }
                        ]
                    },
                    {
                        name: '第七单元 分一与除法', kp: '平均分 · 除法算式 · 倍数',
                        questions: [
                            { q: '12 ÷ 2 = ?', opts: ['6','4','8','14'], answer: 0, explain: '12除以2等于6' },
                            { q: '12 ÷ 2 读作什么？', opts: ['12除以2等于6','2除以12','12乘2','2乘12'], answer: 0, explain: '读作：12除以2等于6' },
                            { q: '除法算式 12 ÷ 2 = 6 中，6 叫什么？', opts: ['商','被除数','除数','余数'], answer: 0, explain: '被除数 ÷ 除数 = 商，6是商' },
                            { q: '用口诀求商：三四十二，那么 12 ÷ 3 = ?', opts: ['4','3','2','6'], answer: 0, explain: '除法是乘法逆运算，用口诀三四十二求商得4' },
                            { q: '用口诀求商：三三得九，那么 9 ÷ 3 = ?', opts: ['3','2','4','6'], answer: 0, explain: '三三得九，9÷3=3' },
                            { q: '12是3的几倍？', opts: ['4倍','3倍','2倍','6倍'], answer: 0, explain: '求一个数是另一个数的几倍用除法：12÷3=4' },
                            { q: '20平均分成4份，每份是多少？', opts: ['5','4','16','8'], answer: 0, explain: '总数÷份数=每份数：20÷4=5' }
                        ]
                    },
                    {
                        name: '第八单元 6-9的乘法口诀', kp: '6、7、8、9的乘法口诀',
                        questions: [
                            { q: '六六 = ?', opts: ['36','24','18','42'], answer: 0, explain: '六六三十六' },
                            { q: '七七 = ?', opts: ['49','42','35','56'], answer: 0, explain: '七七四十九' },
                            { q: '八八 = ?', opts: ['64','48','56','72'], answer: 0, explain: '八八六十四' },
                            { q: '九九 = ?', opts: ['81','63','72','90'], answer: 0, explain: '九九八十一' },
                            { q: '六七 = ?', opts: ['42','35','28','21'], answer: 0, explain: '六七四十二' },
                            { q: '七八 = ?', opts: ['56','42','48','64'], answer: 0, explain: '七八五十六' },
                            { q: '六八 = ?', opts: ['48','36','54','42'], answer: 0, explain: '六八四十八' },
                            { q: '八九 = ?', opts: ['72','63','81','54'], answer: 0, explain: '八九七十二' }
                        ]
                    },
                    {
                        name: '第九单元 乘除法应用', kp: '口诀求商 · 综合应用 · 总复习',
                        questions: [
                            { q: '用口诀求商：24 ÷ 3 = ?', opts: ['8','6','9','12'], answer: 0, explain: '三八二十四，所以 24÷3=8' },
                            { q: '用口诀求商：36 ÷ 6 = ?', opts: ['6','5','7','8'], answer: 0, explain: '六六三十六，所以 36÷6=6' },
                            { q: '用口诀求商：54 ÷ 9 = ?', opts: ['6','5','7','8'], answer: 0, explain: '六九五十四，所以 54÷9=6' },
                            { q: '100以内加减混合，要从哪里算起？', opts: ['从左边','从右边','从中间','随便'], answer: 0, explain: '从左往右依次计算' },
                            { q: '买文具用去3元5角，付了5元，应找回多少钱？', opts: ['1元5角','1元','2元5角','5角'], answer: 0, explain: '5元 - 3元5角 = 1元5角' },
                            { q: '48个苹果平均分给6个小朋友，每人几个？', opts: ['8个','6个','4个','12个'], answer: 0, explain: '总数÷份数=每份数：48÷6=8' }
                        ]
                    }
                ]
            },
            {
                subject: '英语', icon: '🅰️', color: '#4499ff',
                units: [
                    {
                        name: 'Unit 1 五官五感', kp: 'eye ear nose mouth hand finger see hear smell taste touch feel',
                        questions: [
                            { q: '眼睛的英文是什么？', opts: ['eye','ear','nose','mouth'], answer: 0, explain: 'eye = 眼睛' },
                            { q: '耳朵的英文是什么？', opts: ['ear','eye','finger','hand'], answer: 0, explain: 'ear = 耳朵' },
                            { q: '鼻子的英文是什么？', opts: ['ear','nose','mouth','finger'], answer: 1, explain: 'nose = 鼻子' },
                            { q: '手的英文是什么？', opts: ['hand','foot','finger','arm'], answer: 0, explain: 'hand = 手' },
                            { q: '"I can see an ant" 的中文意思？', opts: ['我能看见一只蚂蚁','我能听见鸟','我能闻到花','我能尝到糖'], answer: 0, explain: 'see = 看见，ant = 蚂蚁' },
                            { q: '"I can smell the flowers" 的中文意思？', opts: ['我能闻到花香','我能看见花','我能摸到花','我能尝到花'], answer: 0, explain: 'smell = 闻，flowers = 花' },
                            { q: '"hard" 的中文意思是？', opts: ['硬的','软的','快的','慢的'], answer: 0, explain: 'hard = 硬的' },
                            { q: '"soft" 的中文意思是？', opts: ['软的','硬的','热的','冷的'], answer: 0, explain: 'soft = 软的' }
                        ]
                    },
                    {
                        name: 'Unit 2 我的家人', kp: 'family father mother brother sister grandpa grandma',
                        questions: [
                            { q: '爸爸的英文是什么？', opts: ['father','mother','brother','grandpa'], answer: 0, explain: 'father = 爸爸' },
                            { q: '妈妈的英文是什么？', opts: ['mother','father','sister','grandma'], answer: 0, explain: 'mother = 妈妈' },
                            { q: '爷爷/外公的英文是什么？', opts: ['grandpa','grandma','father','uncle'], answer: 0, explain: 'grandpa = 爷爷；外公' },
                            { q: '"Who\'s he?" 的中文意思是？', opts: ['他是谁？','她是谁？','他是我的','我是谁？'], answer: 0, explain: 'Who\'s he? = 他是谁？' },
                            { q: '"He\'s my father" 的中文意思是？', opts: ['他是我的爸爸','她是我的妈妈','他是我的哥哥','他是我的爷爷'], answer: 0, explain: 'He\'s my father = 他是我的爸爸' },
                            { q: '姐姐/妹妹的英文是什么？', opts: ['sister','brother','mother','grandma'], answer: 0, explain: 'sister = 姐妹' }
                        ]
                    },
                    {
                        name: 'Unit 3 我最喜欢的玩具', kp: 'toy doll ball car robot favourite',
                        questions: [
                            { q: '玩具的英文是什么？', opts: ['toy','car','ball','doll'], answer: 0, explain: 'toy = 玩具' },
                            { q: '洋娃娃的英文是什么？', opts: ['doll','ball','car','robot'], answer: 0, explain: 'doll = 洋娃娃' },
                            { q: '机器人的英文是什么？', opts: ['robot','toy','car','doll'], answer: 0, explain: 'robot = 机器人' },
                            { q: '"favourite" 的中文意思是？', opts: ['最喜欢的','最大的','最好的','最漂亮的'], answer: 0, explain: 'favourite = 最喜欢的' },
                            { q: '"What\'s your favourite toy?" 的中文意思是？', opts: ['你最喜欢的玩具是什么？','你最喜欢什么动物？','你家有什么？','你喜欢什么？'], answer: 0, explain: 'What\'s your favourite toy? = 你最喜欢的玩具是什么？' },
                            { q: '"My favourite toy is a doll" 的中文意思是？', opts: ['我最喜欢的玩具是洋娃娃','我最喜欢的玩具是小汽车','我最喜欢的玩具是机器人','我最喜欢的玩具是球'], answer: 0, explain: 'My favourite toy is a doll = 我最喜欢的玩具是洋娃娃' }
                        ]
                    },
                    {
                        name: 'Unit 4 我周围有什么', kp: 'home park shop school tree flower There is a...',
                        questions: [
                            { q: '家的英文是什么？', opts: ['home','house','school','shop'], answer: 0, explain: 'home = 家' },
                            { q: '公园的英文是什么？', opts: ['park','shop','school','home'], answer: 0, explain: 'park = 公园' },
                            { q: '学校的英文是什么？', opts: ['school','shop','park','home'], answer: 0, explain: 'school = 学校' },
                            { q: '"There is a park" 的中文意思是？', opts: ['有一个公园','有一家商店','有一所学校','有一棵树'], answer: 0, explain: 'There is a park = 有一个公园' },
                            { q: '"What is around your home?" 的中文意思是？', opts: ['你家周围有什么？','你家在哪里？','你喜欢什么？','你家有什么？'], answer: 0, explain: 'around = 在……周围' },
                            { q: '花的英文是什么？', opts: ['flower','tree','shop','school'], answer: 0, explain: 'flower = 花' }
                        ]
                    },
                    {
                        name: 'Unit 5 农场动物', kp: 'farm cow pig duck chicken sheep I like the...',
                        questions: [
                            { q: '农场的英文是什么？', opts: ['farm','home','school','park'], answer: 0, explain: 'farm = 农场' },
                            { q: '奶牛的英文是什么？', opts: ['cow','pig','duck','sheep'], answer: 0, explain: 'cow = 奶牛' },
                            { q: '鸭子的英文是什么？', opts: ['duck','chicken','pig','cow'], answer: 0, explain: 'duck = 鸭子' },
                            { q: '绵羊的英文是什么？', opts: ['sheep','pig','duck','cow'], answer: 0, explain: 'sheep = 绵羊' },
                            { q: '"I like the cows" 的中文意思是？', opts: ['我喜欢奶牛','我喜欢猪','我喜欢鸭子','我喜欢羊'], answer: 0, explain: 'I like the cows = 我喜欢奶牛' },
                            { q: '小鸡的英文是什么？', opts: ['chicken','duck','sheep','pig'], answer: 0, explain: 'chicken = 小鸡' }
                        ]
                    },
                    {
                        name: 'Unit 6 中秋节', kp: 'Mid-Autumn Festival moon moon cake lantern celebrate',
                        questions: [
                            { q: '中秋节的英文是什么？', opts: ['Mid-Autumn Festival','New Year','Spring Festival','Christmas'], answer: 0, explain: 'Mid-Autumn Festival = 中秋节' },
                            { q: '月亮的英文是什么？', opts: ['moon','sun','star','sky'], answer: 0, explain: 'moon = 月亮' },
                            { q: '月饼的英文是什么？', opts: ['moon cake','moon','lantern','light'], answer: 0, explain: 'moon cake = 月饼' },
                            { q: '灯笼的英文是什么？', opts: ['lantern','moon','cake','light'], answer: 0, explain: 'lantern = 灯笼' },
                            { q: '"They eat moon cakes" 的中文意思是？', opts: ['他们吃月饼','他们看月亮','他们玩灯笼','他们唱歌'], answer: 0, explain: 'They eat moon cakes = 他们吃月饼' },
                            { q: '"They look at the moon" 的中文意思是？', opts: ['他们看月亮','他们吃月饼','他们玩灯笼','他们庆祝'], answer: 0, explain: 'They look at the moon = 他们看月亮' },
                            { q: '"They play with lanterns" 的中文意思是？', opts: ['他们玩灯笼','他们看月亮','他们吃月饼','他们唱歌'], answer: 0, explain: 'They play with lanterns = 他们玩灯笼' }
                        ]
                    }
                ]
            }
        ];

        // ============================================================
        // === 本地教材动态加载系统 ===
        // 从 教材/二年级上册/*.txt 实时读取，解析为朗读课文与词汇
        // 修改 .txt 文件后刷新页面即可生效，无需改代码
        // 加载失败时静默回退到下方硬编码的 TEXTBOOK_PASSAGES
        // ============================================================
        const LOCAL_TEXTBOOK = {
            loaded: false,
            filesFound: 0,
            raw: {},
            // 异步加载三份教材
            async load() {
                const paths = {
                    '语文': '教材/二年级上册/语文.txt',
                    '数学': '教材/二年级上册/数学.txt',
                    '英语': '教材/二年级上册/英语.txt'
                };
                for (const [subj, p] of Object.entries(paths)) {
                    try {
                        const resp = await fetch(p);
                        if (resp.ok) {
                            this.raw[subj] = await resp.text();
                            this.filesFound++;
                        }
                    } catch (e) { /* file:// 协议或无服务器时静默跳过 */ }
                }
                this.loaded = true;
                if (this.filesFound > 0) this.integrate();
            },
            // 解析语文：按课文编号分割，提取标题+正文+生字表
            parseChinese() {
                const txt = this.raw['语文']; if (!txt) return [];
                const out = [];
                // 匹配 "数字 标题" 或 "识字数字 标题" 开头的课文
                const parts = txt.split(/\n(?=(?:\d+|识字\d+)\s)/);
                for (let part of parts) {
                    part = part.trim(); if (!part) continue;
                    // 第一行是标题
                    const lines = part.split('\n');
                    const firstLine = lines[0].trim();
                    // 跳过单元标题行（如"第一单元"）
                    if (/^第[一二三四五六七八]单元/.test(firstLine) || /^部编版/.test(firstLine)) continue;
                    // 提取课文标题
                    const titleMatch = firstLine.match(/^(?:\d+|识字\d+)\s+(.+)$/);
                    if (!titleMatch) continue;
                    let title = titleMatch[1].trim();
                    // 提取正文：跳过标题行、写字表/识字表行、空行
                    const bodyLines = [];
                    for (let i = 1; i < lines.length; i++) {
                        const ln = lines[i].trim();
                        if (!ln || /^写字表/.test(ln) || /^识字表/.test(ln) || /^二年级上册\s+识字表/.test(ln) || /^二年级上册\s+写字表/.test(ln)) continue;
                        if (/^第[一二三四五六七八]单元/.test(ln)) continue;
                        bodyLines.push(ln);
                    }
                    const body = bodyLines.join('').replace(/\s+/g, '');
                    if (body.length < 10) continue; // 过短的跳过
                    // 截取片段（前200字）
                    const frag = body.length > 200 ? body.substring(0, 200) + '……' : body;
                    out.push({ title: title + '（教材原文）', text: frag });
                }
                return out;
            },
            // 解析英语：按 Unit N 分割
            parseEnglish() {
                const txt = this.raw['英语']; if (!txt) return [];
                const out = [];
                const parts = txt.split(/\n(?=Unit\s+\d+)/i);
                for (let part of parts) {
                    part = part.trim(); if (!part) continue;
                    const firstLine = part.split('\n')[0].trim();
                    if (!/^Unit\s+\d+/i.test(firstLine)) continue;
                    // 提取听力原文和课文内容（跳过"单词"标题行和词汇列表）
                    const bodyLines = [];
                    for (const ln of part.split('\n').slice(1)) {
                        const t = ln.trim();
                        if (!t || t === '单词' || t === 'Let\'s talk' || t === 'Let\'s learn' || t === 'Let\'s play' || t === '听力原文' || /^听力\d/.test(t)) continue;
                        // 跳过纯词汇行（英文 中文 格式，含多词短语如 "five senses 五种感官"）
                        if (/^[\w\s\-]+ [\u4e00-\u9fa5]/.test(t) && t.length < 30) continue;
                        // 跳过听力小节标题行（如 "A Listen, then point and say（听力原文）"）
                        if (/^[A-Z]\s+Listen/.test(t) || /^B\s+Listen/.test(t) || /^C\s+Look/.test(t) || /^Story:/.test(t)) continue;
                        // 跳过纯数字编号行
                        if (/^\d+\.\s*$/.test(t)) continue;
                        bodyLines.push(t);
                    }
                    const body = bodyLines.join(' ').replace(/\s+/g, ' ').trim();
                    if (body.length < 15) continue;
                    const frag = body.length > 250 ? body.substring(0, 250) + '...' : body;
                    out.push({ title: firstLine, text: frag });
                }
                return out;
            },
            // 解析数学：按"第N单元"分割
            parseMath() {
                const txt = this.raw['数学']; if (!txt) return [];
                const out = [];
                const parts = txt.split(/\n(?=第[一二三四五六七八九]单元)/);
                for (let part of parts) {
                    part = part.trim(); if (!part) continue;
                    const firstLine = part.split('\n')[0].trim();
                    const unitMatch = firstLine.match(/^(第[一二三四五六七八九]单元\s+.+)$/);
                    if (!unitMatch) continue;
                    // 提取内容行（跳过标题和"需要我"等提示）
                    const bodyLines = [];
                    for (const ln of part.split('\n').slice(1)) {
                        const t = ln.trim();
                        if (!t || /^需要我/.test(t) || /^总复习/.test(t)) continue;
                        bodyLines.push(t);
                    }
                    const body = bodyLines.join(' ').replace(/\s+/g, ' ').trim();
                    if (body.length < 10) continue;
                    const frag = body.length > 250 ? body.substring(0, 250) + '……' : body;
                    out.push({ title: unitMatch[1].trim() + '（教材原文）', text: frag });
                }
                return out;
            },
            // 将解析结果融入 TEXTBOOK_PASSAGES（替换数组内容）
            integrate() {
                const yw = this.parseChinese();
                const yy = this.parseEnglish();
                const sx = this.parseMath();
                if (yw.length > 0) { TEXTBOOK_PASSAGES['语文'].length = 0; TEXTBOOK_PASSAGES['语文'].push(...yw); }
                if (yy.length > 0) { TEXTBOOK_PASSAGES['英语'].length = 0; TEXTBOOK_PASSAGES['英语'].push(...yy); }
                if (sx.length > 0) { TEXTBOOK_PASSAGES['数学'].length = 0; TEXTBOOK_PASSAGES['数学'].push(...sx); }
                // 在 HUD 显示加载状态
                setTimeout(() => {
                    const el = document.getElementById('textbook-status');
                    if (el) el.textContent = `📚 本地教材已加载(${this.filesFound}/3)：语文${yw.length}篇 英语${yy.length}篇 数学${sx.length}篇`;
                }, 500);
            }
        };

        // === 教材课文朗读系统 ===
        // 爷爷→语文 / 奶奶→英语 / 泽宇→数学，轮流朗读
        const TEXTBOOK_PASSAGES = {
            '语文': [
                { title: '小蝌蚪找妈妈（片段）', text: '池塘里有一群小蝌蚪，大大的脑袋，黑灰色的身子，甩着长长的尾巴，快活地游来游去。小蝌蚪游哇游，过了几天，长出了两条后腿。他们看见鲤鱼妈妈在教小鲤鱼捕食，就迎上去，问：鲤鱼阿姨，我们的妈妈在哪里？鲤鱼妈妈说：你们的妈妈四条腿，宽嘴巴。你们到那边去找吧！' },
                { title: '我是什么（片段）', text: '我会变。太阳一晒，我就变成汽。升到天空，我又变成无数极小极小的点儿，连成一片，在空中飘浮。平常我在池子里睡觉，在小溪里散步，在江河里奔跑，在海洋里跳舞、唱歌、开大会。小朋友，你们猜猜，我是什么？' },
                { title: '植物妈妈有办法（片段）', text: '蒲公英妈妈准备了降落伞，把它送给自己的娃娃。只要有风轻轻吹过，孩子们就乘着风纷纷出发。苍耳妈妈有个好办法，她给孩子穿上带刺的铠甲。只要挂住动物的皮毛，孩子们就能去田野、山洼。豌豆妈妈更有办法，她让豆荚晒在太阳底下。' },
                { title: '场景歌（朗读）', text: '一只海鸥，一片沙滩。一艘军舰，一条帆船。一方鱼塘，一块稻田。一行垂柳，一座花园。一道小溪，一孔石桥。一丛翠竹，一群飞鸟。' },
                { title: '树之歌（朗读）', text: '杨树高，榕树壮，梧桐树叶像手掌。枫树秋天叶儿红，松柏四季披绿装。木棉喜暖在南方，桦树耐寒守北疆。银杏水杉活化石，金桂开花满院香。' },
                { title: '拍手歌（朗读）', text: '你拍一，我拍一，动物世界很新奇。你拍二，我拍二，孔雀锦鸡是伙伴。你拍三，我拍三，雄鹰飞翔云彩间。你拍四，我拍四，天空雁群会写字。' },
                { title: '田家四季歌（朗读）', text: '春季里，春风吹，麦苗儿多嫩，桑叶儿正肥。夏季里，农事忙，采了蚕桑又插秧。秋季里，稻上场，谷像黄金粒粒香。冬季里，雪初晴，新制棉衣暖又轻。' },
                { title: '曹冲称象（片段）', text: '曹冲才七岁，他站出来，说：我有个办法。把大象赶到一艘大船上，看船身下沉多少，就沿着水面，在船舷上画一条线。再把大象赶上岸，往船上装石头，装到船下沉到画线的地方为止。然后称一称船上的石头。石头一共有多重，大象就有多重。' },
                { title: '玲玲的画（片段）', text: '爸爸拿起画，仔细地看了看，说：别哭，孩子。在这儿画点什么，不是很好吗？玲玲想了想，拿起笔，在弄脏的地方画了一只小花狗。爸爸高兴地说：好多事情并不像我们想象的那么糟。只要肯动脑筋，坏事有时也能变成好事。' },
                { title: '一封信（片段）', text: '妈妈说：我们一起重新写吧！露西边说边写：亲爱的爸爸，我们过得挺好。露西想到了小狗希比希，写道：阳光下，我们的希比希又蹦又跳。' },
                { title: '妈妈睡了（片段）', text: '妈妈睡了。妈妈哄我午睡的时候，自己先睡着了，睡得好熟，好香。睡梦中的妈妈真美丽。明亮的眼睛闭上了，紧紧地闭着；弯弯的眉毛，也在睡觉。' },
                { title: '登鹳雀楼（朗读）', text: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。' },
                { title: '望庐山瀑布（朗读）', text: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。' },
                { title: '黄山奇石（片段）', text: '就说仙桃石吧，它好像从天上飞下来的一个大桃子，落在山顶的石盘上。在一座陡峭的山峰上，有一只猴子。它两只胳膊抱着腿，一动不动地蹲在山头，望着翻滚的云海。这就是有趣的猴子观海。' },
                { title: '日月潭（片段）', text: '日月潭很深，湖水碧绿。湖中央有个美丽的小岛，叫光华岛。小岛把湖水分成两半，北边像圆圆的太阳，叫日潭；南边像弯弯的月亮，叫月潭。' },
                { title: '葡萄沟（片段）', text: '新疆吐鲁番有个地方叫葡萄沟。到了秋季，葡萄一大串一大串地挂在绿叶底下，有红的、白的、紫的、淡绿的，五光十色，美丽极了。葡萄沟真是个好地方。' },
                { title: '坐井观天（片段）', text: '青蛙坐在井里。小鸟飞来，落在井沿上。青蛙说：天不过井口那么大，还用飞那么远吗？小鸟说：你弄错了。天无边无际，大得很哪！' },
                { title: '寒号鸟（片段）', text: '喜鹊说：寒号鸟，别睡了，大好晴天，赶快做窝。寒号鸟不听劝告，躺在崖缝里说：傻喜鹊，不要吵，太阳高照，正好睡觉。寒冬腊月，大雪纷飞。寒号鸟重复地哀嚎：哆啰啰，哆啰啰，寒风冻死我，明天就做窝。' },
                { title: '我要的是葫芦（片段）', text: '从前，有个人种了一棵葫芦。细长的葫芦藤上长满了绿叶，开出了几朵雪白的小花。花谢以后，藤上挂了几个小葫芦。那个人每天都要去看几次。' },
                { title: '大禹治水（片段）', text: '禹吸取了鲧治水失败的教训，采用疏导的办法治水。他和千千万万的人一起，开通了很多河道，让洪水通过河道，最后流到大海里去。洪水终于退了，百姓重新过上了安居乐业的生活。' },
                { title: '朱德的扁担（片段）', text: '朱德同志也跟战士们一块儿去挑粮。他穿着草鞋，戴着斗笠，挑起粮食，跟大家一块儿爬山。不料，朱德同志又找来一根扁担，写上朱德的扁担五个字。' },
                { title: '难忘的泼水节（片段）', text: '一九六一年的泼水节，傣族人民特别高兴，因为敬爱的周恩来总理要和他们一起过泼水节。周总理一手端着盛满清水的银碗，一手拿着柏树枝蘸了水，向人们泼洒，为人们祝福。' },
                { title: '夜宿山寺（朗读）', text: '危楼高百尺，手可摘星辰。不敢高声语，恐惊天上人。' },
                { title: '敕勒歌（朗读）', text: '敕勒川，阴山下。天似穹庐，笼盖四野。天苍苍，野茫茫，风吹草低见牛羊。' },
                { title: '雾在哪里（片段）', text: '有一天，雾飞到海上。我要把大海藏起来。于是，他把大海藏了起来。雾来到岸边。我要把海岸藏起来。雾把海岸藏了起来，同时也把城市藏了起来。' },
                { title: '雪孩子（片段）', text: '雪孩子看见小白兔家着火了，就飞快地跑过去。他一边跑一边喊：小白兔，小白兔！你快醒醒！雪孩子冲进屋里，把小白兔抱了出来。太阳出来了，雪孩子变成了水汽，飞上天空，变成了一朵白云。' },
                { title: '狐假虎威（片段）', text: '老虎逮住一只狐狸。狐狸说：老天爷派我来管你们百兽，你吃了我，就是违抗了老天爷的命令。老虎半信半疑，跟着狐狸朝森林深处走去。其实他受骗了。原来，野兽是害怕老虎才跑掉的。' },
                { title: '狐狸分奶酪（片段）', text: '狐狸兄弟俩捡到一块奶酪，奶酪掰成两半，一块大一块小。狐狸跑过来说：我来帮你们分。就这样咬来咬去，奶酪全被狐狸吃光了。' },
                { title: '纸船和风筝（片段）', text: '松鼠住在山顶，小熊住在山脚。松鼠折了一只纸船，纸船里放着一个小松果，上面写着：祝你快乐！小熊很高兴，把一只风筝放到天上。风筝上写着：祝你幸福！' },
                { title: '风娃娃（片段）', text: '风妈妈说：到田野去吧，帮人们做事情。风娃娃来到田野，对着风车用力一吹。风车飞快地转起来，水流哗哗地流进田里。风妈妈说：做事情光有好的愿望还不行，还要看是不是真的对别人有用。' },
            ],
            '英语': [
                { title: 'Unit 1 What can you do with your five senses?', text: 'I can feel the rabbit. I can see an ant. I can smell the flowers. I can hear the birds. I can taste the lollipop. I can touch and feel with my hands and fingers. I can see and hear with my eyes and ears. I can smell and taste with my nose and tongue.' },
                { title: 'Unit 1 Story', text: 'What can you see? Listen! I can hear a kitten. You are right. I can smell flowers here. Now feel this. It is hard.' },
                { title: 'Unit 2 What do you like about your family?', text: 'Who is he? He is my father. Who is she? She is my mother. Who is he? He is my grandpa. Who is she? She is my grandma.' },
                { title: 'Unit 3 What is your favourite toy?', text: 'What is your favourite toy? My favourite toy is a doll. What is your favourite toy? My favourite toy is a robot.' },
                { title: 'Unit 4 What is around your home?', text: 'What is around your home? There is a park. What is around your home? There is a school. There is a park near my home. There is a shop near my school.' },
                { title: 'Unit 5 What do you like about farms?', text: 'What do you like about farms? I like the cows. What do you like about farms? I like the ducks. I can see cows, pigs, ducks, chickens and sheep on the farm.' },
                { title: 'Unit 6 How do people celebrate the Mid-Autumn Festival?', text: 'How do people celebrate the Mid-Autumn Festival? They eat moon cakes. They look at the moon. They play with lanterns.' },
            ],
            '数学': [
                { title: '连加连减', text: '24 加 30 加 41 等于多少？我们先算 24 加 30 等于 54，再算 54 加 41 等于 95。连加连减要从左往右依次计算。90 减 45 减 25 等于多少？先算 90 减 45 等于 45，再算 45 减 25 等于 20。相同数位对齐，从个位算起，进位要加1，退位要减1。' },
                { title: '加减混合', text: '52 减 9 加 15 等于多少？从左往右算，先算 52 减 9 等于 43，再算 43 加 15 等于 58。加减混合也是从左往右算，有括号先算括号里。' },
                { title: '购物与人民币', text: '人民币单位有元、角、分。1 元等于 10 角。1 角等于 10 分。1 元等于 100 分。小明有 8 元，买了一个 5 元的本子，应找回 3 元。计算方法：付出的钱减去物品的价钱，就是应找回的钱。' },
                { title: '乘法初步认识', text: '3 加 3 加 3 加 3 等于 12。这是 4 个 3 相加。我们可以写成 4 乘 3 等于 12，也可以写成 3 乘 4 等于 12。乘法就是求几个相同加数的和的简便运算。乘数乘乘数等于积。' },
                { title: '图形的变化', text: '把图形对折，两边完全重合，折痕叫对称轴，这就是轴对称图形。平移是物体沿直线移动，形状大小不变，比如推拉窗户。旋转是物体绕一个点转动，比如风车、钟表指针。' },
                { title: '2的乘法口诀', text: '一二得二，二二得四，二三得六，二四得八，二五一十，二六十二，二七十四，二八十六，二九十八。' },
                { title: '3和4的乘法口诀', text: '一三得三，二三得六，三三得九，三四十二，三五十五。一四得四，二四得八，三四十二，四四十六，四五二十。' },
                { title: '5的乘法口诀', text: '一五得五，二五一十，三五十五，四五二十，五五二十五。几的口诀，相邻两句得数相差几。' },
                { title: '测量', text: '测量较短的物体用厘米作单位，测量较长的物体用米作单位。1 米等于 100 厘米。用尺子量物体时，物体的一端要对准 0 刻度，看另一端对应的刻度是多少。线段是直的，有两个端点，可以量长度。' },
                { title: '平均分', text: '平均分就是每份分得同样多。比如 12 根香蕉，平均分成 2 份，每份 6 根。分糖果时，大数目平均分，可以用表格记录分的过程。' },
                { title: '除法初步', text: '12 除以 2 等于 6。读作：12 除以 2 等于 6。12 是被除数，2 是除数，6 是商。用口诀求商：三四十二，所以 12 除以 3 等于 4。除法是乘法的逆运算。' },
                { title: '倍的认识', text: '12 是 3 的几倍？用除法计算：12 除以 3 等于 4，所以 12 是 3 的 4 倍。求一个数是另一个数的几倍，用除法。' },
                { title: '6的乘法口诀', text: '一六得六，二六十二，三六十八，四六二十四，五六三十，六六三十六。' },
                { title: '7的乘法口诀', text: '一七得七，二七十四，三七二十一，四七二十八，五七三十五，六七四十二，七七四十九。' },
                { title: '8的乘法口诀', text: '一八得八，二八十六，三八二十四，四八三十二，五八四十，六八四十八，七八五十六，八八六十四。' },
                { title: '9的乘法口诀', text: '一九得九，二九十八，三九二十七，四九三十六，五九四十五，六九五十四，七九六十三，八九七十二，九九八十一。' },
                { title: '乘除法的应用', text: '用乘法口诀可以解决除法实际问题。比如 48 个苹果平均分给 6 个小朋友，用口诀六八四十八，48 除以 6 等于 8，每人 8 个。综合运用乘除法可以解决生活中的问题。' },
                { title: '总复习', text: '100以内加减混合计算从左往右依次计算。人民币换算：1元等于10角，1角等于10分。乘法意义和2到9的乘法口诀。平移、旋转、轴对称。厘米和米的长度单位。平均分、除法和倍数问题。' },
            ]
        };

        // 朗读角色与学科对应
        const READING_CHARACTERS = [
            { name: '爷爷', key: 'GRANDPA', subject: '语文', icon: '👴', voiceRate: 0.85, voicePitch: 0.9 },
            { name: '奶奶', key: 'GRANDMA', subject: '英语', icon: '👵', voiceRate: 0.8, voicePitch: 1.2 },
            { name: '泽宇', key: 'RABBIT', subject: '数学', icon: '🐰', voiceRate: 0.9, voicePitch: 1.3 }
        ];

        let currentReadingIndex = 0;  // 当前轮到谁读
        let currentPassageIndex = {}; // 每个学科已读到的课文索引
        READING_CHARACTERS.forEach(c => { currentPassageIndex[c.subject] = 0; });

        function getReadingCharacter() {
            return READING_CHARACTERS[currentReadingIndex % READING_CHARACTERS.length];
        }

        // 在指定角色旁边朗读课文（轮转角色，顺序朗读课文，循环播放）
        function startGuardianReading() {
            if (!gameActive) return;
            
            // 轮转角色（爷爷→奶奶→泽宇→爷爷→...）
            const char = READING_CHARACTERS[currentReadingIndex % READING_CHARACTERS.length];
            currentReadingIndex++;
            const passages = TEXTBOOK_PASSAGES[char.subject];
            if (!passages || passages.length === 0) {
                showStatus(`❌ ${char.subject}课文未找到`);
                return;
            }
            
            // 顺序朗读：从当前索引开始，读完最后一篇后循环回第一篇
            const passageIdx = currentPassageIndex[char.subject] || 0;
            const passage = passages[passageIdx % passages.length];
            // 朗读后推进索引，循环
            currentPassageIndex[char.subject] = (passageIdx + 1) % passages.length;
            
            // 找到对应的角色模型（用于显示头顶标签）
            const playerPos = getPlayerPos();
            let targetMob = null;
            const typeName = char.key === 'RABBIT' ? 'RABBIT' : char.key;
            for (const mob of mobs) {
                if (!mob.alive || !mob.mesh.visible) continue;
                const mobName = (typeName === 'GRANDPA' ? '爷爷' : typeName === 'GRANDMA' ? '奶奶' : '泽宇');
                if ((mob.type && mob.type.name === mobName) || (mob.guardian && mob.type && mob.type.name === mobName)) {
                    const dx = playerPos.x - mob.mesh.position.x;
                    const dz = playerPos.z - mob.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 15) {
                        targetMob = mob;
                        break;
                    }
                }
            }
            
            // 朗读课文（使用 TTS）
            const fullText = `${char.name}朗读${char.subject}课文：${passage.title}。${passage.text}`;
            showStatus(`${char.icon} ${char.name}开始朗读${char.subject}：${passage.title}`);
            speakText(fullText, char.voiceRate);
            
            // 在角色头顶显示提示
            if (targetMob && targetMob.mesh) {
                const label = makeNameTag(`${char.icon} ${char.subject}朗读中...`, '#ffcc00', `${char.subject} lǎng dú`, null);
                label.position.y = 8.0;
                label.scale.set(2, 2, 2);
                targetMob.mesh.add(label);
                setTimeout(() => {
                    if (targetMob.mesh && label.parent) {
                        label.parent.remove(label);
                    }
                }, 5000);
            }
        }

        // === 课文朗读面板 UI ===
        let readingPanelOpen = false;
        let readingPanelSubject = '语文';
        let readingPanelPassageIdx = 0;

        function toggleReadingPanel() {
            const overlay = document.getElementById('reading-overlay');
            if (!overlay) return;
            readingPanelOpen = !readingPanelOpen;
            overlay.style.display = readingPanelOpen ? 'flex' : 'none';
            if (readingPanelOpen) {
                renderReadingPanel();
                if (gameActive) {
                    gameActive = false;
                    if (controls) controls.unlock();
                }
            } else {
                // 关闭面板，恢复游戏
                if (!playerDead) {
                    gameActive = true;
                    if (controls) controls.lock();
                }
            }
        }

        function renderReadingPanel() {
            // 渲染标签
            const tabsEl = document.getElementById('reading-tabs');
            if (tabsEl) {
                tabsEl.innerHTML = '';
                READING_CHARACTERS.forEach((c, i) => {
                    const btn = document.createElement('button');
                    const progress = getLearningProgress(c.subject);
                    const progressStr = `${progress.read}/${progress.total}`;
                    btn.textContent = `${c.icon} ${c.name}·${c.subject} (${progressStr})`;
                    btn.style.cssText = `padding:6px 14px;border:2px solid ${readingPanelSubject === c.subject ? '#ffd700' : '#333'};background:${readingPanelSubject === c.subject ? '#ffd700' : '#1a1a2e'};color:#fff;border-radius:4px;cursor:pointer;font-size:13px;`;
                    btn.onclick = () => {
                        readingPanelSubject = c.subject;
                        readingPanelPassageIdx = 0;
                        renderReadingPanel();
                    };
                    tabsEl.appendChild(btn);
                });
            }

            // 渲染学习进度
            const progressEl = document.getElementById('reading-progress');
            if (progressEl) {
                const progress = getLearningProgress(readingPanelSubject);
                progressEl.innerHTML = `
                    <div style="text-align:center;margin:10px 0;padding:8px;background:rgba(255,255,255,0.1);border-radius:8px;">
                        <div style="font-size:14px;color:#ffd700;margin-bottom:5px;">📊 学习进度</div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="flex:1;height:12px;background:#333;border-radius:6px;overflow:hidden;">
                                <div style="height:100%;width:${progress.pct}%;background:linear-gradient(90deg,#4caf50,#8bc34a);transition:width 0.3s;"></div>
                            </div>
                            <div style="font-size:13px;color:#fff;min-width:80px;">${progress.read}/${progress.total} (${progress.pct}%)</div>
                        </div>
                    </div>
                `;
            }

            // 渲染课文
            const contentEl = document.getElementById('reading-content');
            if (contentEl) {
                const passages = TEXTBOOK_PASSAGES[readingPanelSubject] || [];
                const idx = readingPanelPassageIdx % passages.length;
                const passage = passages[idx];
                const char = READING_CHARACTERS.find(c => c.subject === readingPanelSubject);
                const isRead = learningProgress[readingPanelSubject] && learningProgress[readingPanelSubject].has(idx);
                if (passage) {
                    contentEl.innerHTML = `<div style="text-align:center;margin-bottom:10px;"><span style="font-size:18px;color:#ffd700;">${char ? char.icon : '📖'} ${passage.title} ${isRead ? '✅' : '📖'}</span></div>
                        <div style="font-size:15px;line-height:1.8;color:#ddd;">${passage.text}</div>
                        <div style="text-align:center;margin-top:12px;color:#888;font-size:12px;">${char ? char.name : ''} · 第 ${idx + 1} / ${passages.length} 篇 ${isRead ? '（已学）' : '（未学）'}</div>`;
                } else {
                    contentEl.innerHTML = '<div style="text-align:center;color:#888;">暂无课文</div>';
                }
            }
        }

        function readingPanelPrev() {
            const passages = TEXTBOOK_PASSAGES[readingPanelSubject] || [];
            readingPanelPassageIdx = (readingPanelPassageIdx - 1 + passages.length) % passages.length;
            renderReadingPanel();
        }

        function readingPanelNext() {
            const passages = TEXTBOOK_PASSAGES[readingPanelSubject] || [];
            readingPanelPassageIdx = (readingPanelPassageIdx + 1) % passages.length;
            renderReadingPanel();
        }

        function readingPanelSpeak() {
            const passages = TEXTBOOK_PASSAGES[readingPanelSubject] || [];
            const idx = readingPanelPassageIdx % passages.length;
            const passage = passages[idx];
            const char = READING_CHARACTERS.find(c => c.subject === readingPanelSubject);
            if (passage && char) {
                const fullText = `${char.name}朗读${char.subject}课文：${passage.title}。${passage.text}`;
                showStatus(`${char.icon} ${char.name}开始朗读${char.subject}课文：${passage.title}`);
                speakText(fullText, char.voiceRate);
                // 标记为已读
                markPassageRead(readingPanelSubject, idx);
                renderReadingPanel();
            }
        }
        
        // === 学习进度系统 ===
        let learningProgress = {
            '语文': new Set(),
            '英语': new Set(),
            '数学': new Set()
        };
        
        function markPassageRead(subject, idx) {
            if (!learningProgress[subject]) learningProgress[subject] = new Set();
            learningProgress[subject].add(idx);
            // 🎓 朗读课文获得 XP
            addXP(15, '朗读课文');
            if (subject === '语文') xpywCount++;
            else if (subject === '数学') xpsxCount++;
            else if (subject === '英语') xpyyCount++;
        }
        
        function getLearningProgress(subject) {
            const passages = TEXTBOOK_PASSAGES[subject] || [];
            const readCount = learningProgress[subject] ? learningProgress[subject].size : 0;
            const total = passages.length;
            const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;
            return { read: readCount, total, pct };
        }

        // 绑定朗读面板按钮
        (function initReadingPanel() {
            const closeBtn = document.getElementById('reading-close');
            if (closeBtn) closeBtn.onclick = () => { toggleReadingPanel(); if (gameActive) { gameActive = true; if (controls) controls.lock(); } };
            const prevBtn = document.getElementById('reading-prev');
            if (prevBtn) prevBtn.onclick = readingPanelPrev;
            const nextBtn = document.getElementById('reading-next');
            if (nextBtn) nextBtn.onclick = readingPanelNext;
            const speakBtn = document.getElementById('reading-speak');
            if (speakBtn) speakBtn.onclick = readingPanelSpeak;
        })();

        // === 采集方块时随机朗读教材内容 ===
        let lastCollectReadTime = 0;
        let collectReadCount = 0;  // 采集朗读次数计数
        function maybeReadOnCollect() {
            const now = Date.now();
            collectReadCount++;
            
            // 首次采集必定朗读
            if (collectReadCount === 1) {
                lastCollectReadTime = now;
                doCollectRead();
                return;
            }
            
            // 至少间隔1.5秒才朗读一次
            if (now - lastCollectReadTime < 1500) return;
            // 70%几率触发朗读
            if (Math.random() > 0.70) return;
            
            doCollectRead();
        }
        
        function doCollectRead() {
            // 随机选择一个角色（爷爷/奶奶/泽宇）
            const char = READING_CHARACTERS[Math.floor(Math.random() * READING_CHARACTERS.length)];
            const passages = TEXTBOOK_PASSAGES[char.subject];
            if (!passages || passages.length === 0) return;
            
            // 随机选择一篇课文
            const passage = passages[Math.floor(Math.random() * passages.length)];
            if (!passage) return;
            
            // 从课文中随机提取一句话/词组
            const text = extractRandomFragment(passage.text, char.subject);
            if (!text) return;
            
            lastCollectReadTime = Date.now();
            
            // 🎓 采集朗读获得少量 XP
            addXP(3, '采集朗读');
            
            // 朗读内容
            const fullText = `${char.name}朗读：${text}`;
            showStatus(`📖 ${char.icon} ${char.name}朗读${char.subject}：${text}`);
            speakText(fullText, char.voiceRate);
        }
        
        // === 采集里程碑系统：50块解锁答题、100块解锁矿石、200块解锁金箍棒 ===
        function checkCollectionMilestones() {
            // 50块：解锁答题挑战
            if (totalCollected >= 50 && !_collectedMilestones.has(50)) {
                _collectedMilestones.add(50);
                showStatus('🎉 累计采集50块材料！已解锁答题挑战（采集时可能触发）');
                speakText('累计采集50块材料！已解锁答题挑战', 1.0);
            }
            // 100块：解锁铁矿/煤矿
            if (totalCollected >= 100 && !_collectedMilestones.has(100)) {
                _collectedMilestones.add(100);
                showStatus('⛏️ 累计采集100块材料！铁矿和煤矿已解锁！');
                speakText('累计采集100块材料！铁矿和煤矿已解锁', 1.0);
            }
            // 200块：解锁金箍棒特殊武器
            if (totalCollected >= 200 && !_collectedMilestones.has(200)) {
                _collectedMilestones.add(200);
                if (!inventory.ruyiJbg) {
                    inventory.ruyiJbg = true;
                    // 把金箍棒加入快捷栏（如果尚未加入）
                    if (!hotbarItems.find(i => i.name === TOOLS.RUZI.name)) {
                        hotbarItems.push(TOOLS.RUZI);
                    }
                    refreshHotbarSlots();
                    showStatus('🪄 累计采集200块材料！获得特殊武器——金箍棒（伤害20）！');
                    speakText('累计采集200块材料！获得特殊武器金箍棒！', 1.0);
                    playSound('triangle', 523, 0.1);
                    setTimeout(() => playSound('triangle', 659, 0.1), 120);
                    setTimeout(() => playSound('triangle', 784, 0.15), 240);
                } else {
                    showStatus('🪄 累计采集200块材料！金箍棒已在你的背包里');
                }
            }
            try { saveGame(); } catch(e) {}
        }

        // === 🎮 金币系统 ===
        // 金币变更标记（延迟存档，避免每帧写 localStorage 导致卡顿）
        let _coinsDirty = false;
        function addCoins(amount, reason) {
            coins += amount;
            if (amount > 0) totalCoinsEarned += amount;
            if (reason && amount >= 5) showCoinPopup(amount, reason); // 只在 ≥5 金币时弹窗
            updateCoinsUI();
            _coinsDirty = true; // 标记脏数据，由自动存档处理
        }
        function spendCoins(amount) {
            if (coins < amount) { showStatus('💰 金币不足！'); return false; }
            coins -= amount;
            updateCoinsUI();
            _coinsDirty = true;
            return true;
        }
        function showCoinPopup(amount, reason) {
            // 轻量弹窗：右下角短暂显示，不覆盖画面中心，不触发布局重排
            const popup = document.createElement('div');
            popup.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:9999;font-size:18px;color:#ffd700;text-shadow:0 0 4px #000;font-weight:bold;pointer-events:none;animation:coinFloat 1.2s ease-out forwards;';
            popup.textContent = `💰 +${amount}`;
            document.body.appendChild(popup);
            setTimeout(() => popup.remove(), 1200);
        }
        function updateCoinsUI() {
            const el = document.getElementById('coins-val');
            if (el) el.textContent = coins;
        }

        // === 📋 每日任务系统 ===
        const DAILY_TASK_POOL = [
            { id: 'mine10', desc: '挖10个方块⛏️', target: 10, type: 'mine', reward: 20 },
            { id: 'mine30', desc: '挖30个方块⛏️', target: 30, type: 'mine', reward: 50 },
            { id: 'walk200', desc: '走200步🚶', target: 200, type: 'walk', reward: 15 },
            { id: 'walk500', desc: '走500步🚶', target: 500, type: 'walk', reward: 30 },
            { id: 'mob3', desc: '击败3只怪物⚔️', target: 3, type: 'mob', reward: 40 },
            { id: 'explore3', desc: '探索3个新场景🧭', target: 3, type: 'explore', reward: 35 },
            { id: 'place10', desc: '放置10个方块🧱', target: 10, type: 'place', reward: 20 },
        ];
        function getTodayDate() {
            const d = new Date();
            return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
        }
        function refreshDailyTasks() {
            const today = getTodayDate();
            if (dailyTaskDate === today && dailyTasks.length > 0) return; // 已今日任务
            dailyTaskDate = today;
            // 随机选 3 个不同类型任务
            const types = [...new Set(DAILY_TASK_POOL.map(t => t.type))];
            const picked = [];
            for (const tp of types) {
                const candidates = DAILY_TASK_POOL.filter(t => t.type === tp);
                if (candidates.length > 0 && picked.length < 3) {
                    picked.push({ ...candidates[Math.floor(Math.random() * candidates.length)], progress: 0, done: false });
                }
            }
            // 不足3个则补
            while (picked.length < 3) {
                const t = DAILY_TASK_POOL[Math.floor(Math.random() * DAILY_TASK_POOL.length)];
                if (!picked.find(p => p.id === t.id)) picked.push({ ...t, progress: 0, done: false });
            }
            dailyTasks = picked;
            dailyTasksDone = 0;
            stepsToday = 0;
            blocksMinedToday = 0;
            mobsDefeatedToday = 0;
            showStatus('📋 今日任务已刷新！按 T 查看任务板');
            try { saveGame(); } catch(e) {}
        }
        function updateDailyTask(type, amount) {
            if (dailyTasks.length === 0) return;
            for (const task of dailyTasks) {
                if (task.done) continue;
                if (task.type === type) {
                    task.progress = Math.min(task.target, task.progress + amount);
                    if (task.progress >= task.target) {
                        task.done = true;
                        dailyTasksDone++;
                        totalDailyTasksDone++;
                        totalCoinsEarned += task.reward;
                        addCoins(task.reward, `任务完成：${task.desc}`);
                        showStatus(`✅ 任务完成！${task.desc} 奖励 ${task.reward} 金币`);
                        speakText(`任务完成，奖励${task.reward}金币`, 1.0);
                        playSound('triangle', 523, 0.08);
                        setTimeout(() => playSound('triangle', 659, 0.08), 100);
                        setTimeout(() => playSound('triangle', 784, 0.12), 200);
                        // 全部完成额外奖励
                        if (dailyTasksDone === dailyTasks.length) {
                            addCoins(50, '全部任务完成！');
                            showStatus('🎉 今日全部任务完成！额外奖励 50 金币！');
                        }
                    }
                }
            }
        }
        function toggleDailyTaskPanel() {
            const panel = document.getElementById('daily-task-overlay');
            if (!panel) return;
            if (panel.style.display === 'flex') {
                panel.style.display = 'none';
                gameActive = true;
                if (controls && !fallbackMode) controls.lock();
            } else {
                renderDailyTaskPanel();
                panel.style.display = 'flex';
                gameActive = false;
                if (controls) controls.unlock();
            }
        }
        function renderDailyTaskPanel() {
            refreshDailyTasks();
            const list = document.getElementById('daily-task-list');
            if (!list) return;
            let html = '';
            for (const task of dailyTasks) {
                const pct = Math.round(task.progress / task.target * 100);
                const barColor = task.done ? '#5f5' : '#ff5';
                html += `<div style="background:rgba(40,40,60,0.8);border-radius:8px;padding:10px;margin:6px 0;border-left:4px solid ${barColor};">
                    <div style="font-size:14px;color:#fff;">${task.done ? '✅' : '⬜'} ${task.desc}</div>
                    <div style="background:#333;border-radius:4px;height:12px;margin:4px 0;overflow:hidden;">
                        <div style="background:${barColor};height:100%;width:${pct}%;transition:width 0.3s;"></div>
                    </div>
                    <div style="font-size:11px;color:#aaa;">进度：${task.progress}/${task.target} | 奖励：💰${task.reward}</div>
                </div>`;
            }
            html += `<div style="text-align:center;margin-top:8px;font-size:12px;color:#ffd700;">💰 当前金币：${coins}</div>`;
            html += `<div style="text-align:center;margin-top:4px;font-size:11px;color:#888;">完成全部任务额外奖励 50 金币！</div>`;
            list.innerHTML = html;
        }

        // === 🏆 成就徽章系统 ===
        const BADGES = [
            { id: 'firstBlock', name: '初出茅庐', icon: '🥉', desc: '采集第1个方块', cond: () => totalCollected >= 1 },
            { id: 'mine50', name: '矿工新手', icon: '⛏️', desc: '采集50个方块', cond: () => totalCollected >= 50 },
            { id: 'mine200', name: '矿工达人', icon: '🏆', desc: '采集200个方块', cond: () => totalCollected >= 200 },
            { id: 'mine500', name: '挖矿大师', icon: '👑', desc: '采集500个方块', cond: () => totalCollected >= 500 },
            { id: 'biome3', name: '初探世界', icon: '🧭', desc: '发现3种场景', cond: () => discoveredBiomes.size >= 3 },
            { id: 'biome6', name: '探险家', icon: '🗺️', desc: '发现6种场景', cond: () => discoveredBiomes.size >= 6 },
            { id: 'biome10', name: '世界旅人', icon: '🌍', desc: '发现10种场景', cond: () => discoveredBiomes.size >= 10 },
            { id: 'mob10', name: '勇士', icon: '⚔️', desc: '击败10只怪物', cond: () => totalMobsDefeated >= 10 },
            { id: 'mob50', name: '战神', icon: '🔥', desc: '击败50只怪物', cond: () => totalMobsDefeated >= 50 },
            { id: 'place50', name: '建造师', icon: '🏗️', desc: '放置50个方块', cond: () => totalBlocksPlaced >= 50 },
            { id: 'place200', name: '建造大师', icon: '🏛️', desc: '放置200个方块', cond: () => totalBlocksPlaced >= 200 },
            { id: 'daily3', name: '勤奋好学', icon: '📅', desc: '完成3个每日任务', cond: () => totalDailyTasksDone >= 3 },
            { id: 'daily10', name: '持之以恒', icon: '⭐', desc: '完成10个每日任务', cond: () => totalDailyTasksDone >= 10 },
            { id: 'gold100', name: '小富翁', icon: '💰', desc: '累计获得100金币', cond: () => totalCoinsEarned >= 100 },
            { id: 'gold500', name: '财主', icon: '💎', desc: '累计获得500金币', cond: () => totalCoinsEarned >= 500 },
        ];
        let totalMobsDefeated = 0;
        let totalBlocksPlaced = 0;
        let totalDailyTasksDone = 0;
        let totalCoinsEarned = 0;

        // === 🎓 学习 XP / 等级系统 ===
        let playerXP = 0;
        let playerLevel = 1;
        let xpPerLevel = 100; // 升级所需 XP
        let xpywCount = 0; // 语文已完成数
        let xpsxCount = 0; // 数学已完成数
        let xpyyCount = 0; // 英语已完成数

        function addXP(amount, reason) {
            if (amount <= 0) return;
            playerXP += amount;
            // 检查升级
            while (playerXP >= xpPerLevel) {
                playerXP -= xpPerLevel;
                playerLevel++;
                xpPerLevel = Math.floor(xpPerLevel * 1.2); // 每级所需 XP 增长 20%
                showStatus(`🎉 升级！当前等级 LV.${playerLevel}！经验值 +${amount} (${reason})`);
                speakText(`升级，当前等级${playerLevel}级`, 1.0);
                playSound('triangle', 523, 0.1);
                setTimeout(() => playSound('triangle', 659, 0.1), 100);
                setTimeout(() => playSound('triangle', 784, 0.15), 200);
            }
            // 更新 UI
            const levelEl = document.getElementById('xp-level');
            const xpCurrentEl = document.getElementById('xp-current');
            const xpNextEl = document.getElementById('xp-next');
            const xpBarEl = document.getElementById('xp-bar');
            const xpywEl = document.getElementById('xp-yw-count');
            const xpsxEl = document.getElementById('xp-sx-count');
            const xpyyEl = document.getElementById('xp-yy-count');
            if (levelEl) levelEl.textContent = playerLevel;
            if (xpCurrentEl) xpCurrentEl.textContent = playerXP;
            if (xpNextEl) xpNextEl.textContent = xpPerLevel;
            if (xpBarEl) xpBarEl.style.width = Math.min(100, (playerXP / xpPerLevel) * 100) + '%';
            if (xpywEl) xpywEl.textContent = xpywCount;
            if (xpsxEl) xpsxEl.textContent = xpsxCount;
            if (xpyyEl) xpyyEl.textContent = xpyyCount;
        }
        function checkBadges() {
            for (const badge of BADGES) {
                if (!unlockedBadges.has(badge.id) && badge.cond()) {
                    unlockedBadges.add(badge.id);
                    showStatus(`🏆 解锁徽章！${badge.icon} ${badge.name} — ${badge.desc}`);
                    speakText(`解锁徽章${badge.name}`, 1.0);
                    playSound('triangle', 523, 0.1);
                    setTimeout(() => playSound('triangle', 784, 0.15), 150);
                    addCoins(10, `徽章奖励：${badge.name}`);
                }
            }
        }
        function toggleBadgePanel() {
            const panel = document.getElementById('badge-overlay');
            if (!panel) return;
            if (panel.style.display === 'flex') {
                panel.style.display = 'none';
                gameActive = true;
                if (controls && !fallbackMode) controls.lock();
            } else {
                renderBadgePanel();
                panel.style.display = 'flex';
                gameActive = false;
                if (controls) controls.unlock();
            }
        }
        function renderBadgePanel() {
            const list = document.getElementById('badge-list');
            if (!list) return;
            let html = '';
            let unlockedCount = 0;
            for (const badge of BADGES) {
                const unlocked = unlockedBadges.has(badge.id);
                if (unlocked) unlockedCount++;
                html += `<div style="display:inline-block;width:100px;margin:6px;text-align:center;background:rgba(40,40,60,${unlocked ? 0.9 : 0.4});border-radius:8px;padding:8px;${unlocked ? '' : 'filter:grayscale(1);opacity:0.5;'}">
                    <div style="font-size:28px;">${badge.icon}</div>
                    <div style="font-size:11px;color:${unlocked ? '#ffd700' : '#666'};margin:2px 0;">${badge.name}</div>
                    <div style="font-size:9px;color:#888;">${badge.desc}</div>
                </div>`;
            }
            html = `<div style="text-align:center;margin-bottom:8px;"><span style="font-size:16px;color:#ffd700;">已解锁 ${unlockedCount}/${BADGES.length} 个徽章</span></div>` + html;
            list.innerHTML = html;
        }

        // === 🗺️ 场景图鉴系统 ===
        function discoverBiome(biome) {
            if (discoveredBiomes.has(biome)) return;
            discoveredBiomes.add(biome);
            const name = BIOME_NAMES[biome] || biome;
            showStatus(`🧭 发现新场景！${name}！已加入图鉴`);
            speakText(`发现新场景${name}`, 1.0);
            addCoins(5, `发现新场景：${name}`);
            checkBadges();
        }
        function toggleBiomePanel() {
            const panel = document.getElementById('biome-overlay');
            if (!panel) return;
            if (panel.style.display === 'flex') {
                panel.style.display = 'none';
                gameActive = true;
                if (controls && !fallbackMode) controls.lock();
            } else {
                renderBiomePanel();
                panel.style.display = 'flex';
                gameActive = false;
                if (controls) controls.unlock();
            }
        }
        function renderBiomePanel() {
            const list = document.getElementById('biome-list');
            if (!list) return;
            let html = `<div style="text-align:center;margin-bottom:8px;"><span style="font-size:16px;color:#88ff88;">已发现 ${discoveredBiomes.size}/${Object.keys(BIOME_NAMES).length} 种场景</span></div>`;
            for (const [key, name] of Object.entries(BIOME_NAMES)) {
                const discovered = discoveredBiomes.has(key);
                html += `<div style="display:inline-block;width:110px;margin:5px;text-align:center;background:rgba(40,40,60,${discovered ? 0.9 : 0.4});border-radius:8px;padding:8px;${discovered ? '' : 'filter:grayscale(1);opacity:0.5;'}">
                    <div style="font-size:24px;">${discovered ? '🌿' : '❓'}</div>
                    <div style="font-size:12px;color:${discovered ? '#8f8' : '#666'};">${discovered ? name : '？？？'}</div>
                </div>`;
            }
            list.innerHTML = html;
        }

        // === ✨ 挖矿收集特效 ===
        function onMobDefeated(mob) {
            totalMobsDefeated++;
            mobsDefeatedToday++;
            const reward = mob.type.hostile ? 5 : 2;
            addCoins(reward, `击败${mob.type.name}`);
            updateDailyTask('mob', 1);
            checkBadges();
            // 怪物位置粒子特效
            if (mob.mesh) {
                const p = mob.mesh.position;
                spawnCollectEffect(p.x, p.y, p.z, mob.type.bodyColor);
            }
        }

        // === 🐾 宠物驯服系统 ===
        const TAMABLE_MOBS = ['WOLF', 'COW', 'SHEEP', 'PIG', 'CHICKEN', 'RABBIT', 'CAT'];
        function tryTameMob(mob) {
            if (mob.guardian) {
                // 守护神：触发对话
                talkToGuardian(mob);
                return;
            }
            if (mob.pet) { showStatus(`🐾 ${mob.type.name} 已经是你的宠物了！`); return; }
            if (!TAMABLE_MOBS.includes(mob.type.textureKey) && mob.type.textureKey !== 'WOLF') {
                showStatus(`❌ ${mob.type.name} 不能被驯服！`);
                return;
            }
            if (pets.length >= 3) {
                showStatus('❌ 最多只能有 3 只宠物！先让一只离开（右键长按）');
                return;
            }
            const cost = 15;
            if (!spendCoins(cost)) { showStatus(`💰 驯服需要 ${cost} 金币（买食物）！`); return; }
            mob.pet = true;
            mob.hostile = false;
            pets.push(mob);
            showStatus(`🐾 成功驯服 ${mob.type.name}！它会跟随你！`);
            speakText(`成功驯服${mob.type.name}`, 1.0);
            playSound('triangle', 523, 0.08);
            setTimeout(() => playSound('triangle', 784, 0.12), 150);
            // 驯服特效
            const p = mob.mesh.position;
            spawnCollectEffect(p.x, p.y, p.z, 0xffdd44);
            addCoins(0); // 更新UI
            checkBadges();
            try { saveGame(); } catch(e) {}
        }
        // 宠物跟随逻辑（在怪物 AI 更新中调用）
        function updatePetBehavior(mob, delta) {
            if (!mob.pet || !mob.mesh || !playerModel) return true; // 返回 true 表示已处理（跳过正常AI）
            const target = playerModel.position;
            const dx = target.x - mob.mesh.position.x;
            const dz = target.z - mob.mesh.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 3) {
                // 跟随玩家
                const speed = mob.type.speed * 0.8;
                mob.mesh.position.x += (dx / dist) * speed * delta;
                mob.mesh.position.z += (dz / dist) * speed * delta;
                mob.mesh.lookAt(target.x, mob.mesh.position.y, target.z);
            } else if (dist < 1.5) {
                // 太近，稍微后退
                mob.mesh.position.x -= (dx / dist) * 0.3 * delta;
                mob.mesh.position.z -= (dz / dist) * 0.3 * delta;
            }
            // 宠物不能受到伤害（无敌）
            return true;
        }

        // === 👴 守护神对话系统 ===
        const GUARDIAN_DIALOGUES = [
            { text: ' 孩子，好好学习，天天向上！', type: '鼓励' },
            { text: ' 白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', type: '古诗' },
            { text: ' 敕勒川，阴山下。天似穹庐，笼盖四野。', type: '古诗' },
            { text: ' 风吹草低见牛羊——你看，远处的草原多美啊！', type: '古诗' },
            { text: ' 做人要像曹冲一样聪明，遇到困难多动脑筋！', type: '故事' },
            { text: ' 大禹治水三过家门而不入，我们要学习他坚持不懈的精神！', type: '故事' },
            { text: ' 狐假虎威的故事告诉我们，不要借别人的威风欺负人哦！', type: '故事' },
            { text: ' 蒲公英妈妈准备了降落伞，乘着风出发啦——植物真聪明！', type: '科普' },
            { text: ' 太阳一晒，水变成汽升到天空变成云，再变成雨落下来——这就是水循环！', type: '科普' },
        ];
        function talkToGuardian(mob) {
            const now = Date.now();
            if (now < guardianTalkCooldown) {
                showStatus('⏳ 守护神正在休息，稍后再来...');
                return;
            }
            guardianTalkCooldown = now + 5000; // 5秒冷却
            const dialogue = GUARDIAN_DIALOGUES[Math.floor(Math.random() * GUARDIAN_DIALOGUES.length)];
            const guardianName = mob.type.name;
            showStatus(`👴 ${guardianName}：${dialogue.text}`);
            speakText(dialogue.text, 0.9);
            // 对话奖励
            addCoins(3, `${guardianName}的教导`);
            // 概率恢复生命
            if (Math.random() < 0.5) {
                health = Math.min(maxHealth, health + 3);
                showStatus(`💚 ${guardianName}为你恢复了3点生命！`);
                updateVitalsUI();
            }
        }

        // 共享几何体（避免每次挖矿创建新对象导致 GC 卡顿）
        const _effectGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        function spawnCollectEffect(x, y, z, color) {
            // 在方块位置生成飞散粒子（复用共享几何体，仅创建轻量材质）
            const c = color || 0xffff88;
            for (let i = 0; i < 4; i++) {
                const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1.0 });
                const p = new THREE.Mesh(_effectGeo, mat);
                p.position.set(x + 0.5, y + 0.5, z + 0.5);
                p.userData = {
                    vx: (Math.random() - 0.5) * 3,
                    vy: Math.random() * 3 + 1,
                    vz: (Math.random() - 0.5) * 3,
                    life: 0.6
                };
                scene.add(p);
                collectEffects.push(p);
            }
        }
        const collectEffects = [];
        function updateCollectEffects(delta) {
            for (let i = collectEffects.length - 1; i >= 0; i--) {
                const p = collectEffects[i];
                p.userData.life -= delta;
                if (p.userData.life <= 0) {
                    scene.remove(p);
                    p.material.dispose(); // 释放材质防内存泄漏
                    collectEffects.splice(i, 1);
                    continue;
                }
                p.position.x += p.userData.vx * delta;
                p.position.y += p.userData.vy * delta;
                p.position.z += p.userData.vz * delta;
                p.userData.vy -= 6 * delta; // 重力
                p.material.opacity = p.userData.life / 0.6;
                p.rotation.x += delta * 5;
                p.rotation.z += delta * 5;
            }
        }

        function extractRandomFragment(text, subject) {
            if (!text) return '';
            
            let fragments = [];
            
            if (subject === '语文') {
                // 中文：按句号、逗号、感叹号、问号分割
                fragments = text.split(/[。！？，；]/).filter(s => s.trim().length >= 2);
            } else if (subject === '英语') {
                // 英语：按句号、感叹号、问号分割
                fragments = text.split(/[.!?]/).filter(s => s.trim().length >= 3);
            } else if (subject === '数学') {
                // 数学：按句号分割
                fragments = text.split(/[。？]/).filter(s => s.trim().length >= 5);
            }
            
            if (fragments.length === 0) {
                // 后备：直接返回整段文本的前20个字符
                return text.substring(0, 20) + '...';
            }
            
            // 随机选择2-3个片段组合
            const count = Math.min(fragments.length, Math.floor(Math.random() * 2) + 2);
            const selected = [];
            const usedIdx = new Set();
            for (let i = 0; i < count; i++) {
                let idx;
                do {
                    idx = Math.floor(Math.random() * fragments.length);
                } while (usedIdx.has(idx));
                usedIdx.add(idx);
                selected.push(fragments[idx].trim());
            }
            return selected.join(' ');
        }
        
        // === 迷你游戏挑战系统 ===
        const MINI_GAMES = {
            math: [
                () => { const a = Math.floor(Math.random() * 10) + 1; const b = Math.floor(Math.random() * 10) + 1; const ans = a + b; const wrong = [ans+1, ans-1, ans+2]; return { q: `${a} + ${b} = ?`, opts: [ans, ...wrong].sort(() => Math.random() - 0.5), answer: ans }; },
                () => { const a = Math.floor(Math.random() * 10) + 5; const b = Math.floor(Math.random() * a) + 1; const ans = a - b; const wrong = [ans+1, ans-1, ans+2]; return { q: `${a} - ${b} = ?`, opts: [ans, ...wrong].sort(() => Math.random() - 0.5), answer: ans }; },
                () => { const a = Math.floor(Math.random() * 5) + 2; const b = Math.floor(Math.random() * 5) + 2; const ans = a * b; const wrong = [ans+2, ans-2, ans+3]; return { q: `${a} × ${b} = ?`, opts: [ans, ...wrong].sort(() => Math.random() - 0.5), answer: ans }; },
            ],
            english: [
                () => { const words = [['eye', '眼睛'], ['ear', '耳朵'], ['nose', '鼻子'], ['hand', '手'], ['cow', '奶牛'], ['pig', '猪'], ['duck', '鸭子'], ['sheep', '绵羊']]; const w = words[Math.floor(Math.random() * words.length)]; const others = words.filter(x => x !== w).slice(0, 3); const opts = [w[1], ...others.map(x => x[1])].sort(() => Math.random() - 0.5); return { q: `"${w[0]}" 的中文意思是？`, opts, answer: w[1] }; },
                () => { const pairs = [['眼睛', 'eyes'], ['耳朵', 'ears'], ['手', 'hands'], ['手指', 'fingers'], ['鼻子', 'nose'], ['嘴巴', 'mouth']]; const p = pairs[Math.floor(Math.random() * pairs.length)]; const others = pairs.filter(x => x !== p).slice(0, 3); const opts = [p[1], ...others.map(x => x[1])].sort(() => Math.random() - 0.5); return { q: `"${p[0]}" 的英文是？`, opts, answer: p[1] }; },
            ],
            chinese: [
                () => { const poems = [['白日依山尽，黄河入海流', '登鹳雀楼', '王之涣'], ['日照香炉生紫烟，遥看瀑布挂前川', '望庐山瀑布', '李白'], ['危楼高百尺，手可摘星辰', '夜宿山寺', '李白']]; const p = poems[Math.floor(Math.random() * poems.length)]; const others = poems.filter(x => x !== p).slice(0, 2); const opts = [p[1], ...others.map(x => x[1])].sort(() => Math.random() - 0.5); return { q: `"${p[0]}" 出自哪首诗？`, opts, answer: p[1] }; },
                () => { const stories = [['小蝌蚪找妈妈', '青蛙', '池塘'], ['曹冲称象', '大象', '船'], ['坐井观天', '青蛙', '井']]; const s = stories[Math.floor(Math.random() * stories.length)]; const others = stories.filter(x => x !== s).slice(0, 2); const opts = [s[0], ...others.map(x => x[0])].sort(() => Math.random() - 0.5); return { q: `"${s[2]}" 和 "${s[1]}" 出现在哪篇课文？`, opts, answer: s[0] }; },
            ]
        };
        
        let miniGameActive = false;
        let miniGameLastTime = 0;
        
        function maybeStartMiniGame() {
            const now = Date.now();
            if (miniGameActive) return;
            // 需累计采集至少50块材料才会触发答题挑战
            if (totalCollected < 50) return;
            if (now - miniGameLastTime < 10000) return; // 10秒冷却
            if (Math.random() > 0.15) return; // 15%几率
            
            miniGameActive = true;
            miniGameLastTime = now;
            // 答题时玩家不受怪物攻击
            playerInvulnerable = true;
            startMiniGame();
        }
        
        function startMiniGame() {
            // 随机选择学科
            const subjects = ['math', 'english', 'chinese'];
            const subject = subjects[Math.floor(Math.random() * subjects.length)];
            const games = MINI_GAMES[subject];
            const gameFn = games[Math.floor(Math.random() * games.length)];
            const game = gameFn();
            
            if (!game) { miniGameActive = false; return; }
            
            // 显示迷你游戏界面
            const overlay = document.createElement('div');
            overlay.id = 'mini-game-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;';
            
            const panel = document.createElement('div');
            panel.style.cssText = 'background:#1a1a2e;border:3px solid #ffd700;border-radius:15px;padding:30px;max-width:500px;text-align:center;box-shadow:0 0 30px rgba(255,215,0,0.3);';
            
            const icon = subject === 'math' ? '🔢' : subject === 'english' ? '🔤' : '📖';
            const subjectName = subject === 'math' ? '数学' : subject === 'english' ? '英语' : '语文';
            
            panel.innerHTML = `
                <div style="font-size:48px;margin-bottom:10px;">${icon}</div>
                <div style="font-size:18px;color:#ffd700;margin-bottom:20px;">${subjectName}小挑战！</div>
                <div id="mini-game-question" style="font-size:20px;color:#fff;margin-bottom:25px;font-weight:bold;">${game.q}</div>
                <div id="mini-game-opts" style="display:flex;flex-direction:column;gap:10px;"></div>
                <div id="mini-game-result" style="margin-top:20px;font-size:16px;"></div>
            `;
            
            const optsContainer = panel.querySelector('#mini-game-opts');
            game.opts.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.textContent = opt;
                btn.style.cssText = 'padding:12px 24px;background:#333;color:#fff;border:2px solid #555;border-radius:8px;cursor:pointer;font-size:16px;transition:all 0.2s;';
                btn.onmouseenter = () => { btn.style.background = '#555'; btn.style.borderColor = '#ffd700'; };
                btn.onmouseleave = () => { btn.style.background = '#333'; btn.style.borderColor = '#555'; };
                btn.onclick = () => answerMiniGame(btn, opt, game.answer, optsContainer, panel);
                optsContainer.appendChild(btn);
            });
            
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
            
            // 朗读题目
            const char = READING_CHARACTERS.find(c => c.subject === subjectName);
            if (char) {
                speakText(`${char.name}出题：${game.q}`, char.voiceRate);
            }
        }
        
        function answerMiniGame(btn, selected, correct, optsContainer, panel) {
            const resultEl = panel.querySelector('#mini-game-result');
            const buttons = optsContainer.querySelectorAll('button');
            buttons.forEach(b => { b.disabled = true; b.style.cursor = 'default'; });
            
            if (selected === correct) {
                btn.style.background = '#4caf50';
                btn.style.borderColor = '#81c784';
                resultEl.innerHTML = '<span style="color:#4caf50;">✅ 答对了！奖励+1木头</span>';
                inventory.wood = (inventory.wood || 0) + 1;
                updateInventoryDisplay();
                showStatus('🎉 挑战成功！+1木头奖励');
                speakText('答对了！你真棒！', 1.0);
            } else {
                btn.style.background = '#f44336';
                btn.style.borderColor = '#ef5350';
                // 高亮正确答案
                buttons.forEach(b => {
                    if (b.textContent === correct) {
                        b.style.background = '#4caf50';
                        b.style.borderColor = '#81c784';
                    }
                });
                resultEl.innerHTML = `<span style="color:#f44336;">❌ 答错了！正确答案是：${correct}</span>`;
                showStatus(`❌ 挑战失败！正确答案是：${correct}`);
                speakText(`答错了，正确答案是${correct}`, 0.9);
            }
            
            // 3秒后关闭
            setTimeout(() => {
                document.getElementById('mini-game-overlay')?.remove();
                miniGameActive = false;
                playerInvulnerable = false;
            }, 3000);
        }
        const LEVEL_TIERS = [
            { tier: 'bronze', name: '青铜宝箱', emoji: '🟫', blockKey: 'CHEST_B', color: '#e0a06a', min: 40,
              rewards: [
                  { key: 'iron',   count: 2, name: '铁矿石', icon: '🟤' },
                  { key: 'coal',   count: 2, name: '煤矿石', icon: '⚫' }
              ],
              desc: '普通矿产奖励' },
            { tier: 'silver', name: '白银宝箱', emoji: '⬜', blockKey: 'CHEST_S', color: '#e8eef5', min: 80,
              rewards: [
                  { key: 'iron',   count: 3, name: '铁矿石', icon: '🟤' },
                  { key: 'coal',   count: 3, name: '煤矿石', icon: '⚫' },
                  { key: 'glass',  count: 2, name: '玻璃',   icon: '🔹' },
                  { key: 'torch',  count: 2, name: '火把',   icon: '🔥' }
              ],
              desc: '稀有矿产奖励' },
            { tier: 'gold', name: '黄金宝箱', emoji: '🟨', blockKey: 'CHEST_G', color: '#ffd84a', min: 95,
              rewards: [
                  { key: 'superWeapon', count: 1, name: '超级武器', icon: '⚔️', rare: true }
              ],
              extra: [
                  { key: 'iron', count: 4, name: '铁矿石', icon: '🟤' },
                  { key: 'coal', count: 4, name: '煤矿石', icon: '⚫' },
                  { key: 'glass', count: 3, name: '玻璃',   icon: '🔹' },
                  { key: 'torch', count: 3, name: '火把',   icon: '🔥' }
              ],
              desc: '超级武器 + 稀有矿产' }
        ];

        // 黄金宝箱随机掉落的超级武器池
        const SUPER_WEAPON_POOL = [
            { key: 'swordD', tool: TOOLS.SWORD_D },
            { key: 'swordG', tool: TOOLS.SWORD_G },
            { key: 'pickD',  tool: TOOLS.PICK_D  },
            { key: 'pickG',  tool: TOOLS.PICK_G  }
        ];

        // === 关卡运行状态 ===
        let currentLevel = null;
        let quizScore = 0;
        let quizIndex = 0;
        let quizTotal = 0;
        let quizQuestions = [];
        let quizBusy = false;

        // 统计总单元数
        LEVEL_BANK.forEach(subject => { levelState.totalUnits += subject.units.length; });

        // === 刷新快捷栏槽位（超级武器获得后重新渲染）===
        function refreshHotbarSlots() {
            const container = document.getElementById('hotbar-container');
            if (!container) return;
            const activeIdx = selectedBlockIndex;
            container.innerHTML = '';
            hotbarItems.forEach((item, index) => {
                const available = isItemAvailable(item);
                const slot = document.createElement('div');
                slot.className = `hotbar-slot ${index === activeIdx && available ? 'active' : ''} ${available ? '' : 'locked'}`;
                slot.dataset.index = index;
                const keyLabel = document.createElement('span');
                keyLabel.className = 'slot-key';
                keyLabel.innerText = index + 1;
                keyLabel.style.opacity = available ? '0.8' : '0.3';
                const icon = document.createElement('div');
                icon.className = 'block-icon';
                if (item.icon) {
                    icon.style.fontFamily = 'monospace';
                    icon.style.fontSize = '20px';
                    icon.style.display = 'flex';
                    icon.style.alignItems = 'center';
                    icon.style.justifyContent = 'center';
                    icon.style.backgroundColor = item.super ? 'rgba(255,215,0,0.5)' : (available ? 'rgba(180,160,80,0.6)' : 'rgba(80,80,80,0.4)');
                    icon.innerText = available ? item.icon : '🔒';
                } else {
                    icon.style.backgroundColor = available ? '#' + item.color.toString(16).padStart(6, '0') : '#333333';
                    if (!available) icon.style.opacity = '0.4';
                }
                // 显示物品名称
                const nameLabel = document.createElement('span');
                nameLabel.className = 'slot-name';
                nameLabel.style.color = available ? '#ddd' : '#666';
                nameLabel.innerText = available ? item.name : '🔒' + item.name;
                slot.appendChild(nameLabel);
                // 显示数量
                const count = getItemCount(item);
                if (count > 0) {
                    const countLabel = document.createElement('span');
                    countLabel.className = 'slot-count';
                    countLabel.innerText = '×' + count;
                    slot.appendChild(countLabel);
                }
                slot.appendChild(keyLabel);
                slot.appendChild(icon);
                slot.addEventListener('click', () => selectSlot(index));
                container.appendChild(slot);
            });
        }

        // === 打开/关闭关卡面板 ===
        function toggleLevelPanel() {
            const overlay = document.getElementById('level-overlay');
            if (!overlay) return;
            if (levelPanelOpen) {
                if (currentLevel) return; // 答题中不关闭
                levelPanelOpen = false;
                overlay.classList.remove('visible');
                if (!playerDead) { gameActive = true; if (controls) controls.lock(); }
            } else {
                levelPanelOpen = true;
                overlay.classList.add('visible');
                if (gameActive) { gameActive = false; if (controls) controls.unlock(); }
                renderLevelTabs(0);
            }
        }

        // === 渲染学科标签 ===
        function renderLevelTabs(subjectIdx) {
            const tabs = document.getElementById('level-tabs');
            const list = document.getElementById('level-unit-list');
            if (!tabs || !list) return;
            tabs.innerHTML = '';
            LEVEL_BANK.forEach((subject, idx) => {
                const tab = document.createElement('div');
                tab.className = 'level-tab' + (idx === subjectIdx ? ' active' : '');
                tab.innerHTML = `${subject.icon} ${subject.subject}`;
                tab.addEventListener('click', () => renderLevelTabs(idx));
                tabs.appendChild(tab);
            });
            renderUnitList(subjectIdx, list);
        }

        // === 渲染单元列表 ===
        function renderUnitList(subjectIdx, listEl) {
            const subject = LEVEL_BANK[subjectIdx];
            listEl.innerHTML = '';
            subject.units.forEach((unit, uidx) => {
                const uid = `${subjectIdx}:${uidx}`;
                const prog = levelState.progress[uid];
                const div = document.createElement('div');
                div.className = 'level-unit';
                let statusHTML;
                if (prog && prog.cleared) {
                    statusHTML = `<span class="lu-score">🏆 ${prog.best}%</span>`;
                } else if (prog) {
                    statusHTML = `<span class="lu-score">最高 ${prog.best}%</span>`;
                } else {
                    statusHTML = `<span style="color:#7a8;font-size:12px;">未挑战</span>`;
                }
                div.innerHTML = `
                    <div class="lu-icon">${subject.icon}</div>
                    <div class="lu-body">
                        <div class="lu-name">${unit.name}</div>
                        <div class="lu-kp">${unit.kp}</div>
                    </div>
                    <div class="lu-status">${statusHTML}</div>
                `;
                div.addEventListener('click', () => startLevel(subjectIdx, uidx));
                listEl.appendChild(div);
            });
        }

        // === 开始关卡 ===
        function startLevel(subjectIdx, unitIdx) {
            const subject = LEVEL_BANK[subjectIdx];
            const unit = subject.units[unitIdx];
            currentLevel = { subject, unit, subjectIdx, unitIdx, id: `${subjectIdx}:${unitIdx}` };
            quizQuestions = unit.questions.slice();
            quizTotal = quizQuestions.length;
            quizIndex = 0;
            quizScore = 0;
            renderQuestion();
        }

        // === 渲染当前题目 ===
        function renderQuestion() {
            const subject = LEVEL_BANK[currentLevel.subjectIdx];
            const unit = subject.units[currentLevel.unitIdx];
            const subjIdx = currentLevel.subjectIdx;
            if (!unit || !unit.questions[quizIndex]) { finishLevel(); return; }

            const q = unit.questions[quizIndex];
            quizBusy = false;

            const listEl = document.getElementById('level-unit-list');
            const tabsEl = document.getElementById('level-tabs');
            tabsEl.innerHTML = `<div class="level-tab active">${subject.icon} ${subject.subject}</div>`;
            listEl.innerHTML = '';

            const box = document.createElement('div');
            box.className = 'level-quiz-box';

            const head = document.createElement('div');
            head.className = 'quiz-head';
            head.innerHTML = `<div class="quiz-progress">第 ${quizIndex + 1} / ${quizTotal} 题</div>
                              <div class="quiz-score">得分：${quizScore}</div>`;
            box.appendChild(head);

            const qEl = document.createElement('div');
            qEl.className = 'quiz-question';
            qEl.innerHTML = `<b>${unit.name}</b><br>${q.q}`;
            box.appendChild(qEl);

            const opts = document.createElement('div');
            opts.className = 'quiz-opts';
            // 打乱选项显示顺序（保留原始索引用于判定正确答案）
            const order = q.opts.map((_, i) => i);
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }

            order.forEach(origIdx => {
                const btn = document.createElement('button');
                btn.className = 'quiz-opt';
                btn.dataset.orig = String(origIdx);
                btn.textContent = q.opts[origIdx];
                btn.addEventListener('click', () => answerQuestion(origIdx === q.answer, q, btn, opts));
                opts.appendChild(btn);
            });
            box.appendChild(opts);

            const explain = document.createElement('div');
            explain.className = 'quiz-explain';
            explain.id = 'quiz-explain';
            box.appendChild(explain);

            const actions = document.createElement('div');
            actions.className = 'quiz-actions';
            const nextBtn = document.createElement('button');
            nextBtn.className = 'quiz-btn';
            nextBtn.id = 'quiz-next';
            nextBtn.textContent = '下一题';
            nextBtn.style.display = 'none';
            nextBtn.addEventListener('click', nextQuestion);
            actions.appendChild(nextBtn);

            const backBtn = document.createElement('button');
            backBtn.className = 'quiz-btn ghost';
            backBtn.style.marginLeft = '8px';
            backBtn.textContent = '退出本关';
            backBtn.addEventListener('click', () => {
                currentLevel = null;
                renderLevelTabs(subjIdx);
            });
            actions.appendChild(backBtn);

            box.appendChild(actions);
            listEl.appendChild(box);
        }

        // === 回答题目 ===
        function answerQuestion(isCorrect, q, btn, optsEl) {
            if (quizBusy) return;
            quizBusy = true;
            const allBtns = optsEl.querySelectorAll('.quiz-opt');
            allBtns.forEach(b => b.classList.add('disabled'));
            const explain = document.getElementById('quiz-explain');

            if (isCorrect) {
                btn.classList.add('correct');
                quizScore++;
                // 🎓 答题正确获得 XP
                addXP(10, '答题正确');
                playSound('sine', 880, 0.12);
                explain.className = 'quiz-explain show ok';
                explain.innerHTML = `✅ 回答正确！<br>${q.explain || ''}`;
            } else {
                btn.classList.add('wrong');
                allBtns.forEach(b => {
                    if (b.textContent === q.opts[q.answer]) b.classList.add('correct');
                });
                // 答题错误也给少量 XP（鼓励继续学习）
                addXP(2, '答题尝试');
                playSound('sawtooth', 180, 0.2);
                explain.className = 'quiz-explain show no';
                explain.innerHTML = `❌ 回答错误<br>正确答案：${q.opts[q.answer]}<br>${q.explain || ''}`;
            }

            const scoreEl = document.querySelector('.quiz-score');
            if (scoreEl) scoreEl.textContent = `得分：${quizScore}`;

            const nextBtn = document.getElementById('quiz-next');
            if (nextBtn) {
                nextBtn.style.display = 'inline-block';
                nextBtn.textContent = (quizIndex + 1 >= quizTotal) ? '🎉 查看结果' : '下一题';
            }
        }

        // === 下一题 / 结束 ===
        function nextQuestion() {
            quizIndex++;
            if (quizIndex >= quizTotal) {
                finishLevel();
            } else {
                renderQuestion();
            }
        }

        // === 结算关卡 ===
        function finishLevel() {
            const subject = LEVEL_BANK[currentLevel.subjectIdx];
            const unit = subject.units[currentLevel.unitIdx];
            const subjIdx = currentLevel.subjectIdx;
            const unitIdx = currentLevel.unitIdx;
            const pct = Math.round((quizScore / quizTotal) * 100);

            // 更新进度（保留最高分）
            const uid = currentLevel.id;
            const prev = levelState.progress[uid];
            if (!prev || pct > prev.best) {
                levelState.progress[uid] = { best: pct, cleared: pct >= 40, ts: Date.now() };
            } else if (pct >= 40) {
                prev.cleared = true;
            }
            levelState.completedUnits = Object.keys(levelState.progress).filter(k => levelState.progress[k].cleared).length;

            // 🎓 完成关卡获得 XP（按得分比例）
            const levelXP = Math.floor(quizScore * 8) + (pct >= 80 ? 30 : pct >= 60 ? 15 : 0);
            addXP(levelXP, '完成关卡');

            // 计算宝箱等级
            const tier = LEVEL_TIERS.filter(t => pct >= t.min).pop() || null;

            const listEl = document.getElementById('level-unit-list');
            const tabsEl = document.getElementById('level-tabs');
            tabsEl.innerHTML = `<div class="level-tab active">${subject.icon} ${subject.subject}</div>`;
            listEl.innerHTML = '';

            const box = document.createElement('div');
            box.className = 'level-result';
            box.innerHTML = `<div style="font-size:34px;">${pct >= 60 ? '🎉' : '😅'}</div>
                <div style="color:#9ad;font-size:14px;">${unit.name} 完成！</div>
                <div class="result-score">${pct}%</div>
                <div class="result-desc">${quizScore} / ${quizTotal} 题正确</div>`;

            if (tier) {
                applyChestRewards(tier);
                box.innerHTML += `
                    <div style="margin-top:6px;">
                        <div class="chest-display">${tier.emoji}</div>
                        <div class="chest-name ${tier.tier}">${tier.name}</div>
                        <div style="color:#9ad;font-size:13px;margin-bottom:10px;">${tier.desc}</div>
                    </div>
                    <div class="chest-loot" id="chest-loot-display"></div>`;

                const lootEl = document.getElementById('chest-loot-display');
                tier.rewards.forEach(r => {
                    const el = document.createElement('div');
                    el.className = 'loot-item' + (r.rare ? ' rare' : '');
                    if (r.key === 'superWeapon') {
                        el.textContent = `${r.icon} ${r.name}（已放入快捷栏）`;
                    } else {
                        el.textContent = `${r.icon} ${r.name} ×${r.count}`;
                    }
                    lootEl.appendChild(el);
                });
                if (tier.extra) {
                    tier.extra.forEach(r => {
                        const el = document.createElement('div');
                        el.className = 'loot-item';
                        el.textContent = `${r.icon} ${r.name} ×${r.count}`;
                        lootEl.appendChild(el);
                    });
                }
                // 在玩家附近生成宝箱方块（可挖开）
                spawnChestBlock(tier);
            } else {
                box.innerHTML += `<div style="color:#ff9;font-size:14px;margin-top:14px;padding:12px;background:rgba(255,215,0,0.1);border-radius:8px;">
                    💪 得分未达到 40%，没有宝箱奖励。再接再厉，下次挑战青铜宝箱！</div>`;
            }

            const actions = document.createElement('div');
            actions.className = 'quiz-actions';
            const again = document.createElement('button');
            again.className = 'quiz-btn';
            again.textContent = '🔁 再挑战一次';
            again.addEventListener('click', () => startLevel(subjIdx, unitIdx));
            const back = document.createElement('button');
            back.className = 'quiz-btn ghost';
            back.style.marginLeft = '8px';
            back.textContent = '返回关卡列表';
            back.addEventListener('click', () => {
                currentLevel = null;
                renderLevelTabs(subjIdx);
            });
            const close = document.createElement('button');
            close.className = 'quiz-btn ghost';
            close.style.marginLeft = '8px';
            close.textContent = '关闭';
            close.addEventListener('click', () => {
                currentLevel = null;
                levelPanelOpen = false;
                document.getElementById('level-overlay').classList.remove('visible');
                if (!playerDead) { gameActive = true; if (controls) controls.lock(); }
            });
            actions.appendChild(again);
            actions.appendChild(back);
            actions.appendChild(close);
            box.appendChild(actions);
            listEl.appendChild(box);

            try { saveGame(); } catch(e) {}
            showStatus(tier ? `🎁 通关得分 ${pct}% → 获得${tier.name}！` : `📚 关卡完成，得分 ${pct}%（未达宝箱门槛）`);
        }

        // === 授予宝箱奖励（关卡结算时调用）===
        function applyChestRewards(tier) {
            tier.rewards.forEach(r => {
                if (r.key === 'superWeapon') {
                    const owned = new Set(levelState.superWeapons);
                    const available = SUPER_WEAPON_POOL.filter(w => !owned.has(w.key));
                    const pool = available.length > 0 ? available : SUPER_WEAPON_POOL;
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    if (pick) {
                        levelState.superWeapons.push(pick.key);
                        inventory[pick.key] = true;
                        if (!hotbarItems.find(i => i === pick.tool)) hotbarItems.push(pick.tool);
                    }
                } else {
                    inventory[r.key] = (inventory[r.key] || 0) + r.count;
                }
            });
            if (tier.extra) {
                tier.extra.forEach(r => {
                    inventory[r.key] = (inventory[r.key] || 0) + r.count;
                });
            }
            refreshHotbarSlots();
        }

        // === 在玩家附近生成宝箱方块 ===
        function spawnChestBlock(tier) {
            if (!playerModel) return;
            const blockType = BLOCK_TYPES[tier.blockKey];
            if (!blockType) return;
            const pos = playerModel.position;
            const chestIds = [BLOCK_TYPES.CHEST_B.id, BLOCK_TYPES.CHEST_S.id, BLOCK_TYPES.CHEST_G.id];
            // 清除玩家附近旧宝箱
            [...blocksMap.entries()].forEach(([key, rec]) => {
                if (chestIds.includes(rec.typeId)) {
                    const parts = key.split(',').map(Number);
                    if (Math.hypot(parts[0] - pos.x, parts[2] - pos.z) < 3) removeBlock(key);
                }
            });
            // 在玩家前方放置宝箱
            const dirs = [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
            const px = Math.floor(pos.x), pz = Math.floor(pos.z);
            let placed = false;
            for (const [dx, dz] of dirs) {
                const tx = px + dx, tz = pz + dz;
                let ty = Math.floor(pos.y);
                while (ty > 1 && blocksMap.has(`${tx},${ty - 1},${tz}`) && !blocksMap.has(`${tx},${ty},${tz}`)) ty -= 1;
                const key = `${tx},${ty},${tz}`;
                if (!blocksMap.has(key)) {
                    addBlock(tx, ty, tz, blockType);
                    placed = true;
                    break;
                }
            }
            showStatus(placed ? `🎁 ${tier.name}已生成在脚边，走过去挖开获得奖励！` : `🎁 ${tier.name}奖励已发放到背包！`);
        }

        // === 挖开宝箱方块：发放奖励 ===
        function giveChestReward(chestTier) {
            const tier = LEVEL_TIERS.find(t => t.tier === chestTier);
            if (!tier) return;
            const msgs = [];
            tier.rewards.forEach(r => {
                if (r.key === 'superWeapon') {
                    const owned = new Set(levelState.superWeapons);
                    const available = SUPER_WEAPON_POOL.filter(w => !owned.has(w.key));
                    const pool = available.length > 0 ? available : SUPER_WEAPON_POOL;
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    if (pick) {
                        levelState.superWeapons.push(pick.key);
                        inventory[pick.key] = true;
                        if (!hotbarItems.find(i => i === pick.tool)) hotbarItems.push(pick.tool);
                        msgs.push(`${pick.tool.icon}${pick.tool.name}（超级武器！）`);
                    }
                } else {
                    inventory[r.key] = (inventory[r.key] || 0) + r.count;
                    msgs.push(`${r.icon}${r.name}×${r.count}`);
                }
            });
            if (tier.extra) {
                tier.extra.forEach(r => {
                    inventory[r.key] = (inventory[r.key] || 0) + r.count;
                    msgs.push(`${r.icon}${r.name}×${r.count}`);
                });
            }
            refreshHotbarSlots();
            showStatus(`🎁 ${tier.name}开箱：${msgs.join('，')}`);
            playSound('triangle', 523, 0.1);
            setTimeout(() => playSound('triangle', 659, 0.1), 120);
            setTimeout(() => playSound('triangle', 784, 0.15), 240);
            try { saveGame(); } catch(e) {}
        }

        // === 恢复存档中的关卡状态 ===
        function restoreLevelState(saved) {
            if (!saved) return;
            if (saved.progress) levelState.progress = saved.progress;
            if (saved.superWeapons) {
                levelState.superWeapons = saved.superWeapons.slice();
                saved.superWeapons.forEach(key => {
                    if (!inventory[key]) inventory[key] = true;
                    // 把已获得的超级武器加入快捷栏（如果尚未加入）
                    const toolName = key === 'swordD' ? TOOLS.SWORD_D.name
                        : key === 'swordG' ? TOOLS.SWORD_G.name
                        : key === 'pickD' ? TOOLS.PICK_D.name
                        : key === 'pickG' ? TOOLS.PICK_G.name
                        : null;
                    if (toolName && !hotbarItems.find(i => i.name === toolName)) {
                        const tool = key === 'swordD' ? TOOLS.SWORD_D : key === 'swordG' ? TOOLS.SWORD_G
                            : key === 'pickD' ? TOOLS.PICK_D : TOOLS.PICK_G;
                        hotbarItems.push(tool);
                    }
                });
            }
            levelState.completedUnits = Object.keys(levelState.progress).filter(k => levelState.progress[k].cleared).length;
            refreshHotbarSlots();
        }

        // === 绑定关卡面板事件 ===
        function initLevelSystem() {
            const btn = document.getElementById('btn-level');
            if (btn) btn.addEventListener('click', toggleLevelPanel);
            const closeBtn = document.getElementById('level-close');
            if (closeBtn) closeBtn.addEventListener('click', () => {
                currentLevel = null;
                levelPanelOpen = false;
                document.getElementById('level-overlay').classList.remove('visible');
                if (!playerDead) { gameActive = true; if (controls) controls.lock(); }
            });
            // L 键切换关卡面板，R 键切换课文朗读面板
            const wrapOnKeyDown = onKeyDown;
            onKeyDown = function(event) {
                if (event.code === 'KeyL' && gameActive && !playerDead) {
                    toggleLevelPanel();
                    return;
                }
                if (event.code === 'KeyR' && gameActive && !playerDead) {
                    toggleReadingPanel();
                    return;
                }
                wrapOnKeyDown(event);
            };
            // 不再需要重新绑定：line 3783 的包装器会自动调用当前 onKeyDown
        }

        // 启动关卡系统
        initLevelSystem();

    