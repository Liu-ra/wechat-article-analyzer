import Segment from 'segment'
import { logger } from './logger'

interface KeywordItem {
  word: string
  weight: number
}

interface ArticleStrength {
  title: string
  description: string
}

interface ArticleWeakness {
  title: string
  description: string
  suggestion: string
}

interface ImageSuggestion {
  position: string
  type: string
  description: string
}

interface AnalysisResult {
  strengths: ArticleStrength[]
  weaknesses: ArticleWeakness[]
  imageSuggestions: ImageSuggestion[]
  newTitle: string
  newContent: string
  keywords: KeywordItem[]
  summary: string
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
  '方法', '过程', '内容', '形式', '特点', '性质', '程度', '范围'
])

export async function analyzeContent(content: string, title?: string): Promise<AnalysisResult> {
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

    // 分析文章优点
    logger.debug('开始分析文章优点')
    const strengths = analyzeStrengths(content, words, keywords)
    logger.info('优点分析完成', { count: strengths.length })

    // 分析文章缺点
    logger.debug('开始分析文章缺点')
    const weaknesses = analyzeWeaknesses(content, words)
    logger.info('缺点分析完成', { count: weaknesses.length })

    // 生成配图建议
    logger.debug('开始生成配图建议')
    const imageSuggestions = generateImageSuggestions(content, keywords)
    logger.info('配图建议生成完成', { count: imageSuggestions.length })

    // 生成新文章
    logger.debug('开始生成新文章')
    const { newTitle, newContent } = generateNewArticle(content, title || '', keywords, weaknesses)
    logger.info('新文章生成完成', { newContentLength: newContent.length })

    const result: AnalysisResult = {
      strengths,
      weaknesses,
      imageSuggestions,
      newTitle,
      newContent,
      keywords,
      summary
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
  const wordFreq = new Map<string, number>()

  for (const word of words) {
    if (stopWords.has(word) || word.length < 2) continue
    if (!/[\u4e00-\u9fa5]/.test(word)) continue
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
  }

  const totalWords = words.length
  const keywords: KeywordItem[] = []

  for (const [word, freq] of wordFreq) {
    const tf = freq / totalWords
    const weight = tf * Math.log(totalWords / freq)
    keywords.push({ word, weight })
  }

  keywords.sort((a, b) => b.weight - a.weight)

  const maxWeight = keywords[0]?.weight || 1
  return keywords.slice(0, 15).map(k => ({
    word: k.word,
    weight: k.weight / maxWeight
  }))
}

// 提取式摘要生成
function generateSummary(content: string): string {
  const sentences = content
    .split(/[。！？\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 200)

  if (sentences.length === 0) {
    return content.slice(0, 200)
  }

  const sentenceScores: { sentence: string; score: number }[] = []

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const positionScore = i < 3 ? 1.5 : (i >= sentences.length - 2 ? 1.3 : 1.0)
    const lengthScore = sentence.length > 30 && sentence.length < 100 ? 1.2 : 1.0

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

  sentenceScores.sort((a, b) => b.score - a.score)

  const summaryCount = Math.min(4, Math.ceil(sentences.length * 0.2))
  const selectedSentences = sentenceScores
    .slice(0, summaryCount)
    .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
    .map(s => s.sentence)

  return selectedSentences.join('。') + '。'
}

// 分析文章优点
function analyzeStrengths(content: string, words: string[], keywords: KeywordItem[]): ArticleStrength[] {
  const strengths: ArticleStrength[] = []

  // 检查文章长度
  if (content.length > 1000) {
    strengths.push({
      title: '内容充实',
      description: `文章字数达到 ${content.length} 字，内容较为充实，能够详细阐述主题。`
    })
  }

  // 检查段落结构
  const paragraphs = content.split(/\n\n|\r\n\r\n/).filter(p => p.trim().length > 0)
  if (paragraphs.length >= 3) {
    strengths.push({
      title: '结构清晰',
      description: `文章分为 ${paragraphs.length} 个段落，层次分明，便于阅读。`
    })
  }

  // 检查关键词密度
  if (keywords.length >= 5) {
    const topKeywords = keywords.slice(0, 5).map(k => k.word).join('、')
    strengths.push({
      title: '主题明确',
      description: `文章围绕"${topKeywords}"等核心关键词展开，主题集中。`
    })
  }

  // 检查是否有数据支撑
  const hasNumbers = /\d+[%％万亿元个件次]/.test(content)
  if (hasNumbers) {
    strengths.push({
      title: '数据支撑',
      description: '文章包含具体数据，增强了内容的说服力和可信度。'
    })
  }

  // 检查是否有引用或例子
  const hasQuotes = content.includes('"') || content.includes('"') || content.includes('例如') || content.includes('比如')
  if (hasQuotes) {
    strengths.push({
      title: '论据丰富',
      description: '文章包含引用或举例说明，使内容更加生动具体。'
    })
  }

  // 如果没有发现明显优点，添加一个通用优点
  if (strengths.length === 0) {
    strengths.push({
      title: '表达通顺',
      description: '文章语言表达较为流畅，基本能够清晰传达信息。'
    })
  }

  return strengths
}

// 分析文章缺点
function analyzeWeaknesses(content: string, words: string[]): ArticleWeakness[] {
  const weaknesses: ArticleWeakness[] = []

  // 检查文章长度
  if (content.length < 500) {
    weaknesses.push({
      title: '内容偏短',
      description: `文章仅有 ${content.length} 字，内容可能不够充实。`,
      suggestion: '建议补充更多细节、案例或数据，使内容更加丰满。'
    })
  }

  // 检查段落结构
  const paragraphs = content.split(/\n\n|\r\n\r\n/).filter(p => p.trim().length > 0)
  if (paragraphs.length < 3) {
    weaknesses.push({
      title: '段落较少',
      description: '文章段落划分不够，可能影响阅读体验。',
      suggestion: '建议将内容分成更多段落，每段聚焦一个小主题，增加层次感。'
    })
  }

  // 检查是否有过长段落
  const longParagraphs = paragraphs.filter(p => p.length > 300)
  if (longParagraphs.length > 0) {
    weaknesses.push({
      title: '段落过长',
      description: `存在 ${longParagraphs.length} 个超过300字的段落，可能造成阅读疲劳。`,
      suggestion: '建议将长段落拆分，每段控制在100-200字，提升可读性。'
    })
  }

  // 检查是否缺少数据
  const hasNumbers = /\d+[%％万亿元个件次]/.test(content)
  if (!hasNumbers) {
    weaknesses.push({
      title: '缺少数据支撑',
      description: '文章缺少具体数据，说服力可能不足。',
      suggestion: '建议添加相关统计数据、研究结果或具体案例来增强论点。'
    })
  }

  // 检查是否有重复词汇
  const wordFreq = new Map<string, number>()
  for (const word of words) {
    if (word.length >= 2 && /[\u4e00-\u9fa5]/.test(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }
  }
  const repeatedWords = Array.from(wordFreq.entries())
    .filter(([_, count]) => count > 10)
    .map(([word]) => word)

  if (repeatedWords.length > 3) {
    weaknesses.push({
      title: '用词重复',
      description: `"${repeatedWords.slice(0, 3).join('、')}"等词重复出现过多。`,
      suggestion: '建议使用同义词替换部分重复词汇，丰富文章语言表达。'
    })
  }

  // 检查开头吸引力
  const firstSentence = content.split(/[。！？]/)[0] || ''
  if (firstSentence.length > 50 || !firstSentence.includes('？') && !firstSentence.includes('！')) {
    weaknesses.push({
      title: '开头吸引力不足',
      description: '文章开头较为平淡，可能不够吸引读者。',
      suggestion: '建议使用提问、惊人事实或故事开头，快速抓住读者注意力。'
    })
  }

  return weaknesses
}

// 生成配图建议
function generateImageSuggestions(content: string, keywords: KeywordItem[]): ImageSuggestion[] {
  const suggestions: ImageSuggestion[] = []
  const paragraphs = content.split(/\n\n|\r\n\r\n/).filter(p => p.trim().length > 0)
  const topKeywords = keywords.slice(0, 3).map(k => k.word)

  // 开头配图建议
  suggestions.push({
    position: '文章开头',
    type: '封面图/题图',
    description: `建议使用与"${topKeywords[0] || '主题'}"相关的高质量图片作为封面，吸引读者点击。可选择风格：简洁大气、色彩鲜明、与标题呼应。`
  })

  // 根据段落内容生成配图建议
  if (paragraphs.length >= 3) {
    // 检查是否有数据相关内容
    const dataPattern = /\d+[%％]|数据|统计|增长|下降|比例/
    for (let i = 0; i < paragraphs.length; i++) {
      if (dataPattern.test(paragraphs[i])) {
        suggestions.push({
          position: `第 ${i + 1} 段后`,
          type: '数据图表',
          description: '该段落包含数据信息，建议添加柱状图、折线图或饼图等可视化图表，让数据更直观。'
        })
        break
      }
    }

    // 检查是否有流程或步骤
    const stepPattern = /第一|第二|首先|其次|然后|最后|步骤|流程/
    for (let i = 0; i < paragraphs.length; i++) {
      if (stepPattern.test(paragraphs[i])) {
        suggestions.push({
          position: `第 ${i + 1} 段后`,
          type: '流程图/步骤图',
          description: '该段落描述了流程或步骤，建议添加流程图或步骤示意图，帮助读者理解。'
        })
        break
      }
    }
  }

  // 中间配图建议
  if (paragraphs.length > 4) {
    const midIndex = Math.floor(paragraphs.length / 2)
    suggestions.push({
      position: `第 ${midIndex} 段后`,
      type: '场景图/示意图',
      description: `在文章中部添加与"${topKeywords[1] || topKeywords[0] || '内容'}"相关的配图，缓解阅读疲劳，增强视觉吸引力。`
    })
  }

  // 结尾配图建议
  if (content.includes('总结') || content.includes('结论') || content.includes('最后')) {
    suggestions.push({
      position: '文章结尾',
      type: '总结图/思维导图',
      description: '建议在结尾添加一张总结性图片或思维导图，帮助读者回顾文章要点。'
    })
  }

  return suggestions
}

// 生成新文章
function generateNewArticle(
  content: string,
  originalTitle: string,
  keywords: KeywordItem[],
  weaknesses: ArticleWeakness[]
): { newTitle: string; newContent: string } {
  const topKeywords = keywords.slice(0, 3).map(k => k.word)

  // 生成新标题
  let newTitle = originalTitle
  if (originalTitle) {
    // 优化标题：添加数字或疑问
    if (!/\d/.test(originalTitle) && !originalTitle.includes('？')) {
      const titleTemplates = [
        `${originalTitle}（深度解析）`,
        `关于${topKeywords[0] || ''}，${originalTitle}`,
        `${originalTitle}：你需要知道的一切`
      ]
      newTitle = titleTemplates[Math.floor(Math.random() * titleTemplates.length)]
    }
  } else {
    newTitle = `深度解析：${topKeywords.join('与')}的关键要点`
  }

  // 生成新文章内容
  const paragraphs = content.split(/\n\n|\r\n\r\n/).filter(p => p.trim().length > 0)

  // 优化开头
  let newIntro = ''
  const originalIntro = paragraphs[0] || ''

  // 添加引人入胜的开头
  if (topKeywords.length > 0) {
    newIntro = `【导读】在${topKeywords[0]}领域，有哪些关键知识点值得关注？本文将为您深入解析。\n\n`
  }

  // 处理正文段落
  const processedParagraphs: string[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    let paragraph = paragraphs[i]

    // 拆分过长段落
    if (paragraph.length > 300) {
      const sentences = paragraph.split(/[。！？]/).filter(s => s.trim())
      const midPoint = Math.floor(sentences.length / 2)
      const firstHalf = sentences.slice(0, midPoint).join('。') + '。'
      const secondHalf = sentences.slice(midPoint).join('。') + '。'
      processedParagraphs.push(firstHalf)
      processedParagraphs.push(secondHalf)
    } else {
      processedParagraphs.push(paragraph)
    }
  }

  // 添加小标题
  const sectioned: string[] = []
  const sectionSize = Math.ceil(processedParagraphs.length / 3)

  for (let i = 0; i < processedParagraphs.length; i++) {
    // 每隔几段添加一个小标题
    if (i > 0 && i % sectionSize === 0) {
      const sectionNum = Math.floor(i / sectionSize)
      const sectionTitles = ['核心要点', '深入分析', '实践建议', '总结思考']
      if (sectionNum < sectionTitles.length) {
        sectioned.push(`\n**${sectionTitles[sectionNum]}**\n`)
      }
    }
    sectioned.push(processedParagraphs[i])
  }

  // 添加结尾总结
  let conclusion = '\n\n**写在最后**\n\n'
  conclusion += `综上所述，关于${topKeywords.slice(0, 2).join('和')}的内容，希望本文能够为您提供有价值的参考。如果您觉得本文有帮助，欢迎分享给更多朋友。`

  // 组合新文章
  const newContent = newIntro + sectioned.join('\n\n') + conclusion

  return { newTitle, newContent }
}
