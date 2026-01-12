import Segment from 'segment'
import { logger } from './logger'

interface KeywordItem {
  word: string
  weight: number
}

interface SentimentResult {
  score: number
  label: 'positive' | 'negative' | 'neutral'
  positiveWords: string[]
  negativeWords: string[]
}

interface AnalysisResult {
  keywords: KeywordItem[]
  summary: string
  sentiment: SentimentResult
}

// 初始化分词器
const segment = new Segment()
segment.useDefault()

// 中文停用词
const stopWords = new Set([
  '的', '了', '和', '是', '就', '都', '而', '及', '与', '着',
  '或', '一个', '没有', '我们', '你们', '他们', '它们', '这个',
  '那个', '这些', '那些', '自己', '什么', '怎么', '如何', '为什么',
  '因为', '所以', '但是', '然而', '虽然', '如果', '那么', '这样',
  '那样', '可以', '能够', '应该', '需要', '必须', '可能', '也许',
  '大概', '一直', '一定', '一样', '一起', '已经', '正在', '将要',
  '曾经', '现在', '以后', '之前', '之后', '时候', '地方', '方面',
  '问题', '情况', '关系', '作用', '影响', '结果', '原因', '目的',
  '方法', '过程', '内容', '形式', '特点', '性质', '程度', '范围',
  '条件', '标准', '要求', '原则', '规定', '规则', '制度', '政策',
  '措施', '办法', '方案', '计划', '目标', '任务', '工作', '活动',
  '会议', '报告', '文件', '资料', '数据', '信息', '知识', '经验',
  '能力', '水平', '质量', '效果', '效率', '效益', '价值', '意义',
  '重要', '主要', '基本', '一般', '具体', '实际', '真正', '完全',
  '非常', '特别', '十分', '相当', '比较', '更加', '最', '很',
  '太', '挺', '蛮', '极', '颇', '稍', '略', '有点'
])

// 情感词典（简化版）
const positiveWords = new Set([
  '好', '优秀', '出色', '卓越', '精彩', '完美', '成功', '进步',
  '提升', '改善', '增长', '发展', '创新', '突破', '领先', '优势',
  '喜欢', '爱', '赞', '棒', '强', '妙', '美', '佳',
  '快乐', '开心', '高兴', '幸福', '满意', '感谢', '支持', '鼓励',
  '希望', '期待', '信心', '机会', '潜力', '前景', '未来', '价值',
  '品质', '专业', '可靠', '稳定', '安全', '健康', '环保', '智能',
  '便捷', '高效', '实用', '免费', '优惠', '惊喜', '推荐', '值得'
])

const negativeWords = new Set([
  '差', '糟', '坏', '劣', '烂', '垃圾', '失败', '错误',
  '问题', '困难', '麻烦', '危险', '风险', '威胁', '损失', '下降',
  '减少', '落后', '弱', '缺点', '缺陷', '不足', '漏洞', '隐患',
  '担心', '焦虑', '紧张', '害怕', '恐惧', '痛苦', '难过', '失望',
  '愤怒', '生气', '讨厌', '反感', '厌恶', '抱怨', '投诉', '批评',
  '否定', '拒绝', '反对', '阻止', '限制', '禁止', '违规', '违法',
  '欺骗', '虚假', '谣言', '骗局', '陷阱', '套路', '坑', '亏'
])

export async function analyzeContent(content: string): Promise<AnalysisResult> {
  logger.info('开始分析文章内容', { contentLength: content.length })

  try {
    // 分词
    logger.debug('开始分词')
    const words = segment.doSegment(content, {
      simple: true,
      stripPunctuation: true
    }) as string[]
    logger.info('分词完成', { wordCount: words.length })

    // 提取关键词
    logger.debug('开始提取关键词')
    const keywords = extractKeywords(words)
    logger.info('关键词提取完成', { keywordCount: keywords.length })

    // 生成摘要
    logger.debug('开始生成摘要')
    const summary = generateSummary(content)
    logger.info('摘要生成完成', { summaryLength: summary.length })

    // 情感分析
    logger.debug('开始情感分析')
    const sentiment = analyzeSentiment(words)
    logger.info('情感分析完成', { sentiment: sentiment.label, score: sentiment.score })

    const result = {
      keywords,
      summary,
      sentiment
    }

    logger.info('文章分析完成')
    return result
  } catch (error) {
    logger.error('文章分析失败', { error: error instanceof Error ? error.message : error })
    throw error
  }
}

// TF-IDF 关键词提取
function extractKeywords(words: string[]): KeywordItem[] {
  // 统计词频
  const wordFreq = new Map<string, number>()

  for (const word of words) {
    // 过滤停用词和短词
    if (stopWords.has(word) || word.length < 2) continue

    // 只保留中文词汇
    if (!/[\u4e00-\u9fa5]/.test(word)) continue

    wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
  }

  // 计算权重并排序
  const totalWords = words.length
  const keywords: KeywordItem[] = []

  for (const [word, freq] of wordFreq) {
    // 简化的 TF-IDF 计算
    const tf = freq / totalWords
    const weight = tf * Math.log(totalWords / freq)

    keywords.push({ word, weight })
  }

  // 按权重排序，取前15个
  keywords.sort((a, b) => b.weight - a.weight)

  // 归一化权重
  const maxWeight = keywords[0]?.weight || 1
  return keywords.slice(0, 15).map(k => ({
    word: k.word,
    weight: k.weight / maxWeight
  }))
}

// 提取式摘要生成
function generateSummary(content: string): string {
  // 按句子分割
  const sentences = content
    .split(/[。！？\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 200)

  if (sentences.length === 0) {
    return content.slice(0, 200)
  }

  // 计算句子权重（基于关键词密度和位置）
  const sentenceScores: { sentence: string; score: number }[] = []

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]

    // 位置权重（开头和结尾权重更高）
    const positionScore = i < 3 ? 1.5 : (i >= sentences.length - 2 ? 1.3 : 1.0)

    // 长度权重（适中长度更好）
    const lengthScore = sentence.length > 30 && sentence.length < 100 ? 1.2 : 1.0

    // 包含关键词的权重
    let keywordScore = 1.0
    const importantPatterns = ['重要', '关键', '核心', '首先', '最后', '总结', '结论']
    for (const pattern of importantPatterns) {
      if (sentence.includes(pattern)) {
        keywordScore = 1.3
        break
      }
    }

    sentenceScores.push({
      sentence,
      score: positionScore * lengthScore * keywordScore
    })
  }

  // 按权重排序，选择前3-5句
  sentenceScores.sort((a, b) => b.score - a.score)

  const summaryCount = Math.min(4, Math.ceil(sentences.length * 0.2))
  const selectedSentences = sentenceScores
    .slice(0, summaryCount)
    .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
    .map(s => s.sentence)

  return selectedSentences.join('。') + '。'
}

// 情感分析
function analyzeSentiment(words: string[]): SentimentResult {
  const foundPositive: string[] = []
  const foundNegative: string[] = []

  for (const word of words) {
    if (positiveWords.has(word)) {
      if (!foundPositive.includes(word)) {
        foundPositive.push(word)
      }
    }
    if (negativeWords.has(word)) {
      if (!foundNegative.includes(word)) {
        foundNegative.push(word)
      }
    }
  }

  const positiveCount = foundPositive.length
  const negativeCount = foundNegative.length
  const total = positiveCount + negativeCount

  // 计算情感分数 (-1 到 1)
  let score = 0
  if (total > 0) {
    score = (positiveCount - negativeCount) / total
  }

  // 确定情感标签
  let label: 'positive' | 'negative' | 'neutral' = 'neutral'
  if (score > 0.1) {
    label = 'positive'
  } else if (score < -0.1) {
    label = 'negative'
  }

  return {
    score,
    label,
    positiveWords: foundPositive,
    negativeWords: foundNegative
  }
}
