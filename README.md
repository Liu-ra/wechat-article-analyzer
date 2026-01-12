# 微信公众号文章分析工具

一款强大的微信公众号文章分析工具，支持单篇文章深度分析和公众号批量文章抓取。

## ✨ 主要功能

### 1. 单篇文章分析 📄
- 自动抓取文章内容、标题、作者、发布时间
- 智能提取文章图片（支持Base64转换）
- 使用AI分析文章内容
- 生成专业的PDF分析报告
- 支持Cookie方式获取互动数据（阅读量、点赞数等）

### 2. 批量文章分析 📊
- 从单篇文章链接提取公众号信息
- 生成公众号历史消息页面链接
- 批量抓取公众号所有文章
- 导出专业的Excel数据报告
- 支持自定义抓取数量（1-1000篇）

### 3. 数据统计
- 阅读量
- 点赞数
- 在看数
- 分享数
- 收藏数
- 评论数
- 文章字数

## 🚀 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 7.x

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

构建完成后，安装包位于 `release/` 目录。

## 📖 使用说明

### 单篇文章分析

1. 在微信中打开公众号文章
2. 点击右上角「...」选择「复制链接」
3. 将链接粘贴到应用中
4. 点击「开始分析」

### 批量文章分析

1. 选择「批量分析」模式
2. 输入任意一篇该公众号的文章链接
3. 系统生成公众号历史消息页面链接
4. 在微信中打开该链接
5. 使用抓包工具获取Cookie（如Fiddler、Charles）
6. 将Cookie粘贴到应用中
7. 设置要获取的文章数量
8. 点击「开始获取」
9. 导出Excel报告

### Cookie 获取方法

#### 方法一：Fiddler抓包（推荐）
1. 下载并安装 [Fiddler](https://www.telerik.com/fiddler)
2. 启动Fiddler开始监听网络请求
3. 在微信中打开公众号历史消息页面
4. 在Fiddler中找到 `mp.weixin.qq.com` 的请求
5. 查看请求头中的Cookie字段
6. 复制完整Cookie内容

#### 方法二：微信开发者工具
1. 下载「微信开发者工具」
2. 用公众号账号登录
3. 访问公众号历史消息页面
4. 打开调试器查看Cookie

#### 方法三：浏览器登录公众平台
1. 访问 [mp.weixin.qq.com](https://mp.weixin.qq.com) 登录
2. 按F12打开开发者工具
3. 切换到「Network」标签
4. 刷新页面，找到请求头中的Cookie

## 🛠️ 技术栈

- **Electron** - 桌面应用框架
- **React** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Puppeteer** - 网页自动化
- **ExcelJS** - Excel文件生成
- **PDFKit** - PDF报告生成
- **Axios** - HTTP请求
- **TailwindCSS** - 样式框架

## 📂 项目结构

```
wechat-article-analyzer/
├── electron/               # Electron主进程
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   └── services/          # 服务模块
│       ├── scraper.ts     # 文章抓取
│       ├── analyzer.ts    # AI分析
│       ├── wechatApi.ts   # 微信API
│       ├── batchAnalyzer.ts # 批量分析
│       ├── excelExporter.ts # Excel导出
│       ├── pdfGenerator.ts  # PDF生成
│       └── logger.ts      # 日志系统
├── src/                   # React前端
│   ├── components/        # UI组件
│   ├── types/            # 类型定义
│   └── App.tsx           # 主应用
├── public/               # 静态资源
└── package.json          # 项目配置
```

## ⚠️ 注意事项

1. **Cookie安全**：Cookie包含登录凭证，请勿分享给他人
2. **Cookie过期**：Cookie通常在几小时后过期，需重新获取
3. **请求限制**：建议每次不超过100篇文章，避免被微信限制
4. **网络延迟**：批量获取会有延迟（每批间隔1秒）
5. **数据准确性**：
   - 自动抓取可能无法获取所有互动数据
   - 使用Cookie方式可获取更准确的数据

## 🐛 常见问题

### 1. 页面加载超时
- 检查网络连接
- 尝试多次重试
- 使用Cookie方式获取数据

### 2. 无法获取互动数据
- 微信限制：非作者无法直接获取
- 解决方案：使用Cookie方式获取

### 3. Cookie验证失败
- 确保Cookie完整（包含key或appmsg_token）
- 检查Cookie是否过期
- 重新在微信中打开页面获取新Cookie

### 4. Excel导出失败
- 检查磁盘空间是否充足
- 确保有写入权限
- 查看日志了解详细错误

## 📝 开发计划

- [ ] 支持更多数据源
- [ ] 优化AI分析算法
- [ ] 添加数据可视化图表
- [ ] 支持批量导出PDF
- [ ] 添加定时任务功能
- [ ] 支持多账号管理

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📧 联系方式

如有问题或建议，欢迎通过GitHub Issues联系。

---

**免责声明**：本工具仅供学习和研究使用，请遵守相关法律法规和微信公众平台使用规范。
