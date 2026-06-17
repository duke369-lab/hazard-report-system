# 部署到 Render · 获得固定网址

> 按以下步骤操作，5分钟内获得永久固定网址，手机电脑随时访问！

---

## 第一步：注册/登录 Render

1. 打开 https://dashboard.render.com
2. 用 GitHub / Google 账号登录（推荐用 GitHub）
3. 登录后进入控制台面板

---

## 第二步：创建 Web 服务

1. 点击 **「+ New」** → 选择 **「Web Service」**
2. 连接你的 **GitHub 仓库**（如果没有仓库，按第三步操作）

---

## 第三步（如果没仓库）：创建 GitHub 仓库并上传

### 方式A：用 GitHub Desktop（最简单）

1. 安装 GitHub Desktop：https://desktop.github.com/
2. 打开 `hazard-system` 文件夹
3. 点 **「Publish repository」**
4. 给仓库名取名为 `hazard-report-system`
5. 发布到 GitHub

### 方式B：命令行

```bash
cd hazard-system
git init
git add .
git commit -m "隐患随手拍系统 v1"
git remote add origin https://github.com/你的用户名/hazard-report-system.git
git push -u origin main
```

---

## 第四步：配置 Render 服务参数

在 Render 创建 Web Service 时，填写：

| 参数 | 值 |
|------|-----|
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

### 环境变量（Environment Variables）：

| Key | Value | 说明 |
|-----|-------|------|
| `ADMIN_PASSWORD` | `admin123` | 管理员密码（可改） |

> ⚠️ **免费版注意：** Render 免费版文件系统会在重启时重置。
> 上报的数据和图片在服务重启后会丢失。如需持久化存储请升级或联系技术。

---

## 第五步：部署完成

1. Render 自动构建部署（约需 1-3 分钟）
2. 部署成功后，Render 会给你一个固定网址：
   ```
   https://hazard-report-system-xxxx.onrender.com
   ```

3. 这个网址就是**永久固定的**！手机和电脑都可以随时打开使用。

4. 记下这个网址，分享给同事们！

---

## 验证部署成功

打开你获得的网址，应该能看到系统页面。如果看到「Cannot GET /」说明有问题，检查 `index.html` 是否在仓库根目录。

---

## 后续管理

- **修改管理员密码：** 在 Render 控制台的 Environment Variables 里改 `ADMIN_PASSWORD`
- **查看日志：** 在 Render 控制台点 Logs 标签页
- **重新部署：** 在控制台点 Manual Deploy → Clear build cache & redeploy
