const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO_URL = GITHUB_TOKEN
    ? `https://${GITHUB_TOKEN}@github.com/duke369-lab/hazard-report-system.git`
    : '';

// ========== Git 同步函数 ==========

// 从 GitHub 拉取最新 data.json
function gitPull(cb) {
    if (!GITHUB_TOKEN) return cb && cb(null);
    exec('git pull origin main', { cwd: __dirname }, (err, stdout) => {
        if (err) console.log('[Git] pull 失败（可忽略首次）:', err.message);
        else console.log('[Git] pull 完成');
        if (cb) cb(err);
    });
}

// 将 data.json 推送到 GitHub
function gitPush(cb) {
    if (!GITHUB_TOKEN) return cb && cb(null);
    const cmds = [
        'git add data.json',
        'git diff --quiet --cached || git commit -m "数据更新 ' + new Date().toLocaleString('zh-CN') + '"',
        'git push origin main'
    ].join(' && ');
    exec(cmds, { cwd: __dirname }, (err) => {
        if (err) console.log('[Git] push 失败:', err.message);
        else console.log('[Git] push 完成 ✅');
        if (cb) cb(err);
    });
}

// 启动时初始化 git remote（如果还没配置）
function initGitRemote() {
    if (!GITHUB_TOKEN) return;
    exec('git remote -v', { cwd: __dirname }, (err, stdout) => {
        if (!stdout || !stdout.includes('github.com')) {
            console.log('[Git] 配置 remote...');
            exec(`git remote add origin ${GITHUB_REPO_URL}`, { cwd: __dirname });
        }
        // 首次 pull
        gitPull();
    });
}

// ========== 数据读写 ==========

function loadData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function saveData(data, cb) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    // 异步推送到 GitHub（不阻塞响应）
    if (GITHUB_TOKEN) {
        gitPush();
    }
    if (cb) cb();
}

// ========== 初始化 ==========
function ensureReady() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
}

ensureReady();
initGitRemote();

// 每 60 秒自动从 GitHub 拉取最新数据（多实例协同）
if (GITHUB_TOKEN) {
    setInterval(() => {
        gitPull();
    }, 60000);
}

// ========== Multer 配置（处理图片上传）==========

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `img_${Date.now()}_${uuidv4().slice(0, 6)}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ========== 中间件 ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== 根路径 ==========
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html 未找到');
    }
});

// ===================== API =====================

// 获取所有隐患
app.get('/api/reports', (req, res) => {
    res.json(loadData());
});

// 提交新隐患
app.post('/api/reports', upload.array('photos', 5), (req, res) => {
    const data = loadData();
    const { type, location, description, reporter } = req.body;

    if (!location || !description) {
        return res.status(400).json({ error: '请填写位置和隐患描述' });
    }

    const photos = [];
    if (req.files && req.files.length > 0) {
        req.files.forEach(f => {
            photos.push('/uploads/' + f.filename);
        });
    }

    const getPoints = (t) => t === '重大隐患' ? 50 : t === '较大隐患' ? 30 : 10;

    const newReport = {
        id: uuidv4(),
        type: type || '一般隐患',
        location,
        description,
        reporter: reporter || '匿名同事',
        photos,
        status: '待审核',
        handler: '待派单',
        points: getPoints(type),
        createTime: new Date().toLocaleString('zh-CN'),
        finishPhotos: [],
        reviewComment: '',
        history: []
    };

    data.unshift(newReport);
    saveData(data);
    console.log(`[新上报] ${reporter} - ${type} - ${location}`);
    res.json({ success: true, report: newReport });
});

// 更新隐患（管理员）
app.put('/api/reports/:id', upload.array('finishPhotos', 5), (req, res) => {
    const { password, status, handler, reviewComment } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: '管理员密码错误' });
    }

    const data = loadData();
    const idx = data.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '未找到' });

    const record = data[idx];

    if (status && status !== record.status) {
        record.history.push({
            from: record.status,
            to: status,
            time: new Date().toLocaleString('zh-CN'),
            by: '管理员'
        });
        record.status = status;
    }

    if (handler !== undefined) record.handler = handler;
    if (reviewComment !== undefined) record.reviewComment = reviewComment;

    if (req.files && req.files.length > 0) {
        req.files.forEach(f => {
            record.finishPhotos.push('/uploads/' + f.filename);
        });
    }

    data[idx] = record;
    saveData(data);
    res.json({ success: true, report: record });
});

// 删除隐患（管理员）
app.delete('/api/reports/:id', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: '管理员密码错误' });
    }

    const data = loadData();
    const idx = data.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '未找到' });

    const record = data[idx];
    record.photos.forEach(p => {
        const fp = path.join(__dirname, p);
        if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) { }
    });
    record.finishPhotos.forEach(p => {
        const fp = path.join(__dirname, p);
        if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) { }
    });

    data.splice(idx, 1);
    saveData(data);
    res.json({ success: true });
});

// 管理员登录
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(403).json({ success: false, error: '密码错误' });
    }
});

// 积分排行
app.get('/api/stats/points', (req, res) => {
    const data = loadData();
    const map = {};
    data.forEach(r => {
        if (!map[r.reporter]) map[r.reporter] = 0;
        map[r.reporter] += r.points;
    });
    const ranking = Object.entries(map)
        .map(([name, pts]) => ({ name, points: pts }))
        .sort((a, b) => b.points - a.points);
    res.json(ranking);
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', github: !!GITHUB_TOKEN });
});

// 手动同步 GitHub（管理员）
app.post('/api/sync', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: '管理员密码错误' });
    }
    gitPull((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== 启动 ==========
app.listen(PORT, '0.0.0.0', () => {
    const isCloud = !!process.env.PORT;
    if (isCloud) {
        console.log('========================================');
        console.log('  隐患随手拍系统 · 云端版');
        console.log('========================================');
        console.log('  GitHub 同步:', GITHUB_TOKEN ? '已启用 ✅' : '未配置 ❌');
        console.log('  访问地址:    https://' + (process.env.RENDER_EXTERNAL_HOSTNAME || 'your-app.onrender.com'));
        console.log('========================================');
    } else {
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        let localIP = 'localhost';
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIP = net.address;
                }
            }
        }
        console.log('========================================');
        console.log('  隐患随手拍系统 · 本地版');
        console.log('========================================');
        console.log('  电脑访问:    http://localhost:' + PORT);
        console.log('  手机访问:    http://' + localIP + ':' + PORT);
        console.log('  GitHub 同步:', GITHUB_TOKEN ? '已启用 ✅' : '未配置');
        console.log('========================================');
    }
});
